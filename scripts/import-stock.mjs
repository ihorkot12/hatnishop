import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_BASE_URL = 'https://hatni.shop';
const STOCK_FILE_SIZE = 27198;

const CATEGORY_IMAGES = {
  kitchen: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=800',
  tableware: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&q=80&w=800',
  textile: 'https://images.unsplash.com/photo-1528906819430-d155e7078556?auto=format&fit=crop&q=80&w=800',
  organization: 'https://images.unsplash.com/photo-1594404341023-29419573f5ec?auto=format&fit=crop&q=80&w=800',
  bottles: 'https://images.unsplash.com/photo-1592089416462-2b0cb7da8379?auto=format&fit=crop&q=80&w=800',
  decor: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=800',
};

const REQUIRED_CATEGORIES = [
  { name: 'Кухонне приладдя', slug: 'kitchen', image: CATEGORY_IMAGES.kitchen },
  { name: 'Посуд', slug: 'tableware', image: CATEGORY_IMAGES.tableware },
  { name: 'Текстиль', slug: 'textile', image: CATEGORY_IMAGES.textile },
  { name: 'Організація простору', slug: 'organization', image: CATEGORY_IMAGES.organization },
  { name: 'Термоси та пляшки', slug: 'bottles', image: CATEGORY_IMAGES.bottles },
  { name: 'Декор', slug: 'decor', image: CATEGORY_IMAGES.decor },
];

const ALLOWED_KEYWORDS = [
  'чаш', 'кухоль', 'склян', 'келих', 'таріл', 'салатник', 'блюдо', 'банка', 'ємн',
  'цукорниц', 'масельнич', 'глечик', 'графин', 'чайник', 'контейнер', 'лож',
  'видел', 'ніж', 'нож', 'набір столових', 'лопатк', 'шумівк', 'щипц', 'друшляк',
  'сито', 'кавовар', 'форма', 'деко', 'килимок', 'сервет', 'рушник', 'кошик',
  'підставк', 'піднос', 'блендер', 'міксер', 'дошка', 'миска', 'соусник',
  'сільнич', 'перечниц', 'ополовник', 'вінчик', 'сковор', 'каструл', 'кришк',
  'заварник', 'термос', 'термокруж', 'ополоник', 'сітка', 'щітка', 'коврик',
  'мірна', 'пензлик', 'вирубок', 'фритюр', 'випічк',
];

const SERIES_OR_BRANDS = [
  'ardesto', 'luminarc', 'pasabahce', 'pasabache', 'bormioli', 'club', 'berry',
  'fashion', 'classic', 'crown', 'сельвія', 'flerish', 'roisin', 'solo', 'соло',
  'lara', 'лара', 'dori', 'дорі', 'wood', 'вуд', 'loft', 'лоно', 'leo', 'лео',
  'вузлик', 'кулька', 'бамбук', 'каміння', 'вера', 'італіан', 'италиан',
  'італиян', 'италиян', 'рон', 'нео', 'кози', 'граніт', 'крем', 'граф',
  'стандарт', 'grey', 'грей', 'mono', 'моно', 'pro', 'graffiti', 'water color',
  'helena', 'tivoli', 'тренд', 'шарпей', 'гламур', 'прованс', 'авокадо',
  'котики', 'ромашка', 'медуза', 'амбер', 'colisee', 'lotos', 'aurora',
  'artisan', 'quote', 'everyday', 'trianon', 'diwali', 'ambra', 'green forest',
  'sonia', 'carine', 'eclipse', 'bevande', 'dallas', 'domino', 'epic', 'empire',
  'invitation', 'lvov', 'versailles', 'kyoto', 'nordic', 'parma', 'pavot',
  'bamboo', 'slate',
];

const EXCLUDE_KEYWORDS = [
  'відкривачка', 'штопор', 'дощовик', 'резинк', 'волос', 'свічк', 'свечк',
  'стрічк', 'бант', 'скатертина однораз', 'трубочк', 'шпажк', 'попільниц',
  'пепельниц', 'пакет', 'фольг',
];

const BRAND_LABELS = [
  ['ardesto', 'Ardesto'],
  ['luminarc', 'Luminarc'],
  ['pasabahce', 'Pasabahce'],
  ['pasabache', 'Pasabahce'],
  ['bormioli', 'Bormioli Rocco'],
  ['flerish', 'Flerish'],
  ['roisin', 'Roisin'],
  ['berry', 'Berry'],
  ['classic', 'Classic'],
  ['fashion', 'Fashion'],
  ['crown', 'Crown'],
];

function parseArgs(argv) {
  const args = {
    apply: false,
    baseUrl: process.env.HATNI_BASE_URL || DEFAULT_BASE_URL,
    email: process.env.HATNI_ADMIN_EMAIL || '',
    password: process.env.HATNI_ADMIN_PASSWORD || '',
    file: '',
    limit: 0,
    report: '',
    updateExisting: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--update-existing') args.updateExisting = true;
    else if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--email') args.email = argv[++i];
    else if (arg === '--password') args.password = argv[++i];
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i] || 0);
    else if (arg === '--report') args.report = argv[++i];
    else if (arg === '--help') {
      console.log(`Usage:
  node scripts/import-stock.mjs [--file file.xlsx] [--base-url https://hatni.shop]
  node scripts/import-stock.mjs --apply --email admin@example.com --password "***"

Options:
  --apply             Write products to the site. Without it, dry-run only.
  --update-existing   Update exact existing products instead of only skipping.
  --limit N           Import only first N eligible products.
  --report file.json  Save detailed JSON report.
`);
      process.exit(0);
    }
  }
  return args;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeName(value) {
  return normalizeText(value).toLowerCase();
}

function stripLeadingSku(name) {
  const normalized = normalizeText(name);
  return normalized
    .replace(/^[A-ZА-ЯІЇЄҐ]{1,6}\d{2,}[A-Z0-9-]*\s+/iu, '')
    .replace(/^\d{2,}[A-Z0-9-]*[/-]?\s+/iu, '')
    .replace(/^\d{2,}(?=[А-ЯІЇЄҐ])/u, '')
    .trim();
}

function productNameVariants(name) {
  const clean = stripLeadingSku(name);
  return new Set([normalizeName(name), normalizeName(clean)]);
}

function hasClearIdentifier(name) {
  const lower = name.toLowerCase();
  if (SERIES_OR_BRANDS.some((keyword) => lower.includes(keyword))) return true;
  if (/\b\d{8,13}\b/u.test(name)) return true;
  if (/\b[A-ZА-ЯІЇЄҐ]{1,6}\d{2,}[A-ZА-ЯІЇЄҐ0-9-]*\b/iu.test(name)) return true;
  if (/\d+\s*(мл|л|см|шт|pcs)|[хx*]\s*\d+|[ø∅]\s*\d+/iu.test(name) && name.split(/\s+/u).length >= 5) {
    return true;
  }
  return false;
}

function categoryFor(name) {
  const lower = name.toLowerCase();
  if (/(термос|термокруж|пляшк)/u.test(lower)) return 'bottles';
  if (/(килимок|коврик|сервет|рушник|скатерт)/u.test(lower)) return 'textile';
  if (/(кошик|органайзер)/u.test(lower)) return 'organization';
  if (/(чаш|кухоль|склян|келих|таріл|салатник|блюдо|цукорниц|масельнич|глечик|графин|миска|соусник|сільнич|перечниц|набір.*чаш|набір.*склян)/u.test(lower)) return 'tableware';
  if (/(блендер|міксер|електр|кавоварка|лож|видел|ніж|нож|лопатк|шумівк|щипц|друшляк|сито|ополовник|ополоник|вінчик|дошка|контейнер|форма|деко|сковор|каструл|кришк|щітка|сітка|пензлик|вирубок)/u.test(lower)) return 'kitchen';
  return 'tableware';
}

function materialFor(name) {
  const lower = name.toLowerCase();
  if (/(фарф|порцел)/u.test(lower)) return 'Фарфор';
  if (/(скл|glass)/u.test(lower)) return 'Скло';
  if (/(нерж|сталь|steel)/u.test(lower)) return 'Нержавіюча сталь';
  if (/(пласт|pp|пп)/u.test(lower)) return 'Пластик';
  if (/силік/u.test(lower)) return 'Силікон';
  if (/бамбук/u.test(lower)) return 'Бамбук';
  if (/(дерев|wood|вуд)/u.test(lower)) return 'Дерево';
  if (/керам/u.test(lower)) return 'Кераміка';
  if (/(бавовн|текст|ткан|поліестер)/u.test(lower)) return 'Текстиль';
  return 'Матеріал уточнюється';
}

function brandFor(name) {
  const lower = name.toLowerCase();
  const found = BRAND_LABELS.find(([needle]) => lower.includes(needle));
  return found ? found[1] : 'Хатні Штучки';
}

function sourceSku(name, rowNumber) {
  const match = normalizeText(name).match(/^([A-ZА-ЯІЇЄҐ]{1,6}\d{2,}[A-Z0-9-]*|\d{2,}[A-Z0-9-]*[/-]?)(?:\s+|(?=[А-ЯІЇЄҐ]))/iu);
  return match?.[1] || `row-${rowNumber}`;
}

function toNumber(value, fallback = 0) {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function placeholderImage() {
  return 'https://placehold.co/900x900/f8f4ef/f8f4ef.png?text=%20';
}

function buildProduct(row) {
  const originalName = normalizeText(row.name);
  const displayName = stripLeadingSku(originalName) || originalName;
  const sku = sourceSku(originalName, row.rowNumber);
  const hash = crypto.createHash('sha1').update(`${row.rowNumber}:${originalName}`).digest('hex').slice(0, 8);
  const category = categoryFor(originalName);
  const price = Math.round(toNumber(row.price));
  const stock = Math.max(0, Math.round(toNumber(row.qty)));

  return {
    id: `stock-1806-${row.rowNumber}-${hash}`,
    name: displayName,
    category,
    price,
    cost_price: undefined,
    stock,
    image: placeholderImage(),
    images: [placeholderImage()],
    description: [
      `${displayName} — позиція з актуальних залишків Hatni Shop.`,
      `Артикул постачальника: ${sku}.`,
      `Серія/назва з файлу: ${originalName}.`,
    ].join(' '),
    material: materialFor(originalName),
    brand: brandFor(originalName),
    isPopular: false,
    isBundle: false,
    bundle_items: [],
    bonusPoints: Math.max(1, Math.floor(price * 0.05)),
    reviewCount: 0,
    rating: 5,
    source: { rowNumber: row.rowNumber, originalName, sku },
  };
}

function classify(row) {
  const lower = row.name.toLowerCase();
  const reasons = [];
  if (EXCLUDE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    reasons.push('неоднозначне або поза асортиментом');
  }
  if (!ALLOWED_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    reasons.push('немає ознаки посуду, кухні, текстилю чи декору');
  }
  if (!hasClearIdentifier(row.name)) {
    reasons.push('немає чіткої серії, бренду, моделі або штрихкоду');
  }
  return reasons;
}

function findStockFile(explicitFile) {
  if (explicitFile) return path.resolve(explicitFile);
  const downloads = path.join(os.homedir(), 'Downloads');
  const candidates = fs.readdirSync(downloads)
    .filter((name) => name.toLowerCase().endsWith('.xlsx'))
    .map((name) => path.join(downloads, name))
    .filter((file) => fs.statSync(file).size === STOCK_FILE_SIZE);
  if (candidates.length === 0) throw new Error('Stock XLSX file was not found in Downloads');
  return candidates[0];
}

async function readRows(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    const name = normalizeText(row.getCell(1).text || row.getCell(1).value);
    const qty = row.getCell(2).value;
    const price = row.getCell(3).value;
    if (!name || qty === null || qty === undefined || price === null || price === undefined) return;
    rows.push({ rowNumber, name, qty: toNumber(qty), price: toNumber(price) });
  });

  return rows;
}

function buildExistingIndex(products) {
  const index = new Map();
  for (const product of products) {
    for (const variant of productNameVariants(product.name)) {
      if (variant) index.set(variant, product);
    }
  }
  return index;
}

function headersWithJson(options = {}, cookieHeader = '') {
  const headers = { ...(options.headers || {}) };
  if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';
  if (cookieHeader) headers.Cookie = cookieHeader;
  return headers;
}

function rememberCookies(response, jar) {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  for (const item of setCookies) {
    const [pair] = item.split(';');
    const [name, ...valueParts] = pair.split('=');
    if (name && valueParts.length) jar.set(name.trim(), valueParts.join('=').trim());
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function apiRequest(baseUrl, pathName, options = {}, jar = new Map()) {
  const response = await fetch(new URL(pathName, baseUrl), {
    ...options,
    headers: headersWithJson(options, cookieHeader(jar)),
  });
  rememberCookies(response, jar);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.error || data?.message || response.statusText;
    throw new Error(`${response.status} ${message}`);
  }
  return data;
}

async function login(baseUrl, email, password, jar) {
  const data = await apiRequest(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, jar);
  if (data?.user?.role !== 'admin') {
    throw new Error('Logged in user is not an admin');
  }
}

async function ensureCategories(baseUrl, categories, jar, apply) {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const missing = REQUIRED_CATEGORIES.filter((category) => !bySlug.has(category.slug));
  if (!apply || missing.length === 0) return missing;

  for (const category of missing) {
    await apiRequest(baseUrl, '/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify(category),
    }, jar);
  }
  return missing;
}

async function main() {
  const args = parseArgs(process.argv);
  const filePath = findStockFile(args.file);
  const allRows = await readRows(filePath);
  const products = await apiRequest(args.baseUrl, '/api/products');
  const categories = await apiRequest(args.baseUrl, '/api/categories');
  const existingIndex = buildExistingIndex(Array.isArray(products) ? products : []);
  const seenInFile = new Set();

  const report = {
    file: filePath,
    baseUrl: args.baseUrl,
    mode: args.apply ? 'apply' : 'dry-run',
    sourceRows: allRows.length,
    imported: [],
    updated: [],
    duplicates: [],
    skipped: [],
    errors: [],
    missingCategories: [],
  };

  const candidates = [];
  for (const row of allRows) {
    const reasons = classify(row);
    const product = buildProduct(row);
    const variants = productNameVariants(product.name);
    const originalVariants = productNameVariants(row.name);
    const allVariants = new Set([...variants, ...originalVariants]);
    const duplicate = [...allVariants].map((name) => existingIndex.get(name)).find(Boolean);
    const inFileDuplicate = [...allVariants].some((name) => seenInFile.has(name));

    if (duplicate) {
      report.duplicates.push({ rowNumber: row.rowNumber, name: product.name, existingId: duplicate.id });
      continue;
    }
    if (inFileDuplicate) {
      report.skipped.push({ rowNumber: row.rowNumber, name: product.name, reasons: ['дубль у файлі'] });
      continue;
    }
    if (reasons.length) {
      report.skipped.push({ rowNumber: row.rowNumber, name: row.name, reasons });
      continue;
    }

    for (const name of allVariants) seenInFile.add(name);
    candidates.push(product);
  }

  const selected = args.limit > 0 ? candidates.slice(0, args.limit) : candidates;

  if (args.apply) {
    if (!args.email || !args.password) {
      throw new Error('Use --email/--password or HATNI_ADMIN_EMAIL/HATNI_ADMIN_PASSWORD for --apply');
    }

    const jar = new Map();
    await login(args.baseUrl, args.email, args.password, jar);
    report.missingCategories = await ensureCategories(args.baseUrl, Array.isArray(categories) ? categories : [], jar, true);

    for (const product of selected) {
      const payload = { ...product };
      delete payload.source;
      try {
        await apiRequest(args.baseUrl, '/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        }, jar);
        report.imported.push({ id: product.id, name: product.name, category: product.category, stock: product.stock, price: product.price });
      } catch (error) {
        report.errors.push({ id: product.id, name: product.name, error: error.message });
      }
    }
  } else {
    report.missingCategories = await ensureCategories(args.baseUrl, Array.isArray(categories) ? categories : [], new Map(), false);
    report.imported = selected.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      stock: product.stock,
      price: product.price,
      source: product.source,
    }));
  }

  if (args.report) {
    fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true });
    fs.writeFileSync(args.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  const categoriesCount = report.imported.reduce((acc, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    mode: report.mode,
    file: path.basename(filePath),
    sourceRows: report.sourceRows,
    ready: selected.length,
    imported: args.apply ? report.imported.length : 0,
    duplicates: report.duplicates.length,
    skipped: report.skipped.length,
    errors: report.errors.length,
    categories: categoriesCount,
    missingCategories: report.missingCategories.map((category) => category.slug),
    report: args.report || null,
  }, null, 2));

  if (report.errors.length) {
    console.error(JSON.stringify(report.errors.slice(0, 10), null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
