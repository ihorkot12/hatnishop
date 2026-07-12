// Логіка преміум-імпорту: парсинг файлів, авто-мапінг колонок, дедуплікація,
// пул завдань із ретраями. Чисті функції без React — тестуються окремо від UI.

export interface ImportDraft {
  key: string;              // стабільний ключ рядка в межах сесії імпорту
  sku: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  category: string;         // slug
  description: string;
  material: string;
  brand: string;
  image: string;            // URL або data URL
  isDuplicate: boolean;     // збіг за назвою з наявним товаром
  enriched: boolean;        // пройшов AI-збагачення
  status: 'draft' | 'enriching' | 'ready' | 'publishing' | 'published' | 'skipped' | 'error';
  error?: string;
}

export type ColumnField =
  | 'sku' | 'name' | 'price' | 'costPrice' | 'stock'
  | 'category' | 'description' | 'image' | 'brand' | 'material' | 'ignore';

export const COLUMN_FIELD_LABELS: Record<ColumnField, string> = {
  sku: 'Артикул / SKU',
  name: 'Назва',
  price: 'Ціна',
  costPrice: 'Собівартість',
  stock: 'Кількість',
  category: 'Категорія',
  description: 'Опис',
  image: 'Фото (URL)',
  brand: 'Бренд',
  material: 'Матеріал',
  ignore: '— пропустити —',
};

const HEADER_PATTERNS: Array<[ColumnField, RegExp]> = [
  ['sku', /артикул|\bsku\b|код\s*товар|штрих/i],
  ['costPrice', /собівар|закуп|\bcost\b|опт/i],
  ['price', /ціна|цена|price|роздріб|вартіст/i],
  ['stock', /кільк|к-сть|залиш|остат|stock|qty|наявн/i],
  ['name', /назв|наимен|name|товар|product/i],
  ['category', /категор|category|розділ|група/i],
  ['description', /опис|описан|descr/i],
  ['image', /фото|image|зображ|картин|photo|img/i],
  ['brand', /бренд|brand|виробник|производ/i],
  ['material', /матеріал|материал|material/i],
];

export const normalizeName = (value: unknown) =>
  String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const parseNumber = (value: unknown) => {
  const cleaned = String(value ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
};

// RFC4180-подібний CSV-парсер: лапки, екрановані лапки, коми/крапки з комою, переноси в лапках.
export const parseCsv = (text: string): string[][] => {
  const body = text.replace(/^﻿/, '');
  const firstLineEnd = body.indexOf('\n') === -1 ? body.length : body.indexOf('\n');
  const firstLine = body.slice(0, firstLineEnd);
  const delimiter =
    (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';'
    : (firstLine.match(/\t/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? '\t'
    : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuotes) {
      if (ch === '"') {
        if (body[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows.map(r => r.map(c => c.trim()));
};

// Визначає, який стовпець що означає, за назвами заголовків.
export const detectColumnMap = (headerRow: string[]): ColumnField[] => {
  const used = new Set<ColumnField>();
  return headerRow.map(header => {
    for (const [field, pattern] of HEADER_PATTERNS) {
      if (pattern.test(header) && !used.has(field)) {
        used.add(field);
        return field;
      }
    }
    return 'ignore';
  });
};

// Чи схожий перший рядок на заголовки (а не на дані).
export const looksLikeHeader = (row: string[]) =>
  row.some(cell => HEADER_PATTERNS.some(([, pattern]) => pattern.test(cell))) &&
  !row.some(cell => /^\d+([.,]\d+)?$/.test(cell));

export interface CategoryOption { slug: string; name: string; }

export const matchCategorySlug = (raw: string, categories: CategoryOption[]): string => {
  const value = normalizeName(raw);
  if (!value) return '';
  const exact = categories.find(c => normalizeName(c.name) === value || c.slug === value);
  if (exact) return exact.slug;
  const partial = categories.find(c =>
    normalizeName(c.name).includes(value) || value.includes(normalizeName(c.name)));
  return partial ? partial.slug : '';
};

export const rowsToDrafts = (
  rows: string[][],
  columnMap: ColumnField[],
  categories: CategoryOption[],
  existingNames: Set<string>,
): ImportDraft[] => {
  const byName = new Map<string, ImportDraft>();

  rows.forEach((row, rowIndex) => {
    const record: Partial<Record<ColumnField, string>> = {};
    columnMap.forEach((field, col) => {
      if (field !== 'ignore' && row[col] !== undefined && record[field] === undefined) {
        record[field] = row[col];
      }
    });

    const name = String(record.name || '').trim();
    const price = parseNumber(record.price);
    if (!name || (!price && !parseNumber(record.stock))) return;

    const key = normalizeName(name);
    const existing = byName.get(key);
    if (existing) {
      existing.stock += Math.max(0, Math.round(parseNumber(record.stock)));
      return;
    }

    byName.set(key, {
      key: `row-${rowIndex}-${key.slice(0, 24)}`,
      sku: String(record.sku || '').trim(),
      name,
      price: Math.max(0, Math.round(price)),
      costPrice: Math.max(0, Math.round(parseNumber(record.costPrice))),
      stock: Math.max(0, Math.round(parseNumber(record.stock))),
      category: matchCategorySlug(String(record.category || ''), categories),
      description: String(record.description || '').trim(),
      material: String(record.material || '').trim(),
      brand: String(record.brand || '').trim(),
      image: String(record.image || '').trim(),
      isDuplicate: existingNames.has(key),
      enriched: false,
      status: 'draft',
    });
  });

  return [...byName.values()];
};

// Чого бракує картці, щоб її можна було впевнено публікувати.
export const draftIssues = (draft: ImportDraft): string[] => {
  const issues: string[] = [];
  if (!draft.name) issues.push('назва');
  if (!(draft.price > 0)) issues.push('ціна');
  if (!draft.category) issues.push('категорія');
  if (!draft.description) issues.push('опис');
  if (!draft.image) issues.push('фото');
  if (draft.isDuplicate) issues.push('дублікат');
  return issues;
};

export interface JobRunnerOptions {
  concurrency?: number;
  retries?: number;
  backoffMs?: number;
  onProgress?: (done: number, total: number) => void;
  shouldStop?: () => boolean;
}

export interface JobResult<R> { index: number; result?: R; error?: string; }

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryable = (error: any) => {
  const status = Number(error?.status || 0);
  return status === 429 || status === 502 || status === 503 || status === 504;
};

// Пул завдань: обмежена конкурентність + експоненційний backoff на 429/5xx.
export const runJobs = async <T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  options: JobRunnerOptions = {},
): Promise<JobResult<R>[]> => {
  const { concurrency = 3, retries = 2, backoffMs = 1500, onProgress, shouldStop } = options;
  const results: JobResult<R>[] = [];
  let cursor = 0;
  let done = 0;

  const lane = async () => {
    while (cursor < items.length) {
      if (shouldStop?.()) return;
      const index = cursor++;
      const item = items[index];
      let lastError = '';
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (shouldStop?.()) return;
        try {
          const result = await worker(item, index);
          results.push({ index, result });
          lastError = '';
          break;
        } catch (error: any) {
          lastError = error?.message || 'Помилка';
          if (attempt < retries && isRetryable(error)) {
            await sleep(backoffMs * Math.pow(2, attempt));
          } else if (!isRetryable(error)) {
            break;
          }
        }
      }
      if (lastError) results.push({ index, error: lastError });
      done++;
      onProgress?.(done, items.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return results.sort((a, b) => a.index - b.index);
};

export const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};
