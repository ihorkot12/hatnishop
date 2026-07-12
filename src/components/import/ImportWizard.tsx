import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Camera, CheckCircle2, FileSpreadsheet, Globe2,
  Loader2, Rocket, StopCircle, Trash2, Upload, Wand2,
} from 'lucide-react';
import {
  COLUMN_FIELD_LABELS, CategoryOption, ColumnField, ImportDraft,
  chunk, detectColumnMap, draftIssues, looksLikeHeader, normalizeName,
  parseCsv, rowsToDrafts, runJobs,
} from '../../utils/importPipeline';
import { fileToBase64 } from '../../utils/imageUtils';
import { generateProductImage, searchProductWebImages } from '../../services/aiService';

type Step = 'source' | 'mapping' | 'enrich' | 'review' | 'publish';
type SourceType = 'file' | 'photos' | 'url';

interface Progress { stage: string; done: number; total: number; }

const postJson = async <T,>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status, data });
  return data as T;
};

const stepTitles: Record<Step, string> = {
  source: '1. Джерело',
  mapping: '2. Колонки',
  enrich: '3. Авто-обробка',
  review: '4. Перевірка',
  publish: '5. Публікація',
};

export const ImportWizard = ({ onComplete }: { onComplete?: () => void }) => {
  const [step, setStep] = useState<Step>('source');
  const [sourceType, setSourceType] = useState<SourceType>('file');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [columnMap, setColumnMap] = useState<ColumnField[]>([]);
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [photoKeys, setPhotoKeys] = useState<Set<string>>(new Set());
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [enrichAI, setEnrichAI] = useState(true);
  const [imagesWeb, setImagesWeb] = useState(true);
  const [imagesAI, setImagesAI] = useState(false);
  const [publishMode, setPublishMode] = useState<'create' | 'upsert'>('create');
  const [onlyReady, setOnlyReady] = useState(true);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'attention' | 'ready' | 'duplicates'>('all');
  const [report, setReport] = useState<{ created: number; updated: number; skipped: number; errors: number } | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    fetch('/api/categories').then(r => r.ok ? r.json() : [])
      .then(list => setCategories((Array.isArray(list) ? list : []).map((c: any) => ({ slug: c.slug, name: c.name }))))
      .catch(() => setCategories([]));
    fetch('/api/products').then(r => r.ok ? r.json() : [])
      .then(list => setExistingNames(new Set((Array.isArray(list) ? list : []).map((p: any) => normalizeName(p.name)))))
      .catch(() => setExistingNames(new Set()));
  }, []);

  const patchDraft = (key: string, patch: Partial<ImportDraft>) =>
    setDrafts(prev => prev.map(d => (d.key === key ? { ...d, ...patch } : d)));

  // ---------- КРОК 1: ДЖЕРЕЛО ----------

  const handleFile = async (file: File) => {
    setBusy(true); setError('');
    try {
      const rows: string[][] = [];
      if (/\.csv$/i.test(file.name)) {
        rows.push(...parseCsv(await file.text()));
      } else {
        const excelModule: any = await import('exceljs');
        const ExcelJS = excelModule.default ?? excelModule;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const sheet = workbook.worksheets[0];
        sheet?.eachRow((row: any) => {
          const values = (row.values as any[]).slice(1).map(v =>
            String((v && typeof v === 'object' && 'text' in v) ? (v as any).text : (v ?? '')).trim());
          if (values.some(v => v !== '')) rows.push(values);
        });
      }
      if (!rows.length) throw new Error('Файл порожній або не розпізнано жодного рядка');
      setHasHeader(looksLikeHeader(rows[0]));
      setColumnMap(detectColumnMap(rows[0]));
      setRawRows(rows);
      setStep('mapping');
    } catch (e: any) {
      setError(e?.message || 'Не вдалося прочитати файл');
    } finally { setBusy(false); }
  };

  const handlePhotos = async (files: FileList) => {
    setBusy(true); setError('');
    try {
      const list = [...files].slice(0, 60);
      const newDrafts: ImportDraft[] = [];
      const keys = new Set<string>();
      for (let i = 0; i < list.length; i++) {
        const image = await fileToBase64(list[i]);
        const baseName = list[i].name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
        const key = `photo-${i}-${normalizeName(baseName).slice(0, 20)}`;
        keys.add(key);
        newDrafts.push({
          key, sku: '', name: baseName || `Товар з фото ${i + 1}`,
          price: 0, costPrice: 0, stock: 1, category: '', description: '',
          material: '', brand: '', image,
          isDuplicate: existingNames.has(normalizeName(baseName)),
          enriched: false, status: 'draft',
        });
      }
      setPhotoKeys(keys);
      setDrafts(newDrafts);
      setStep('enrich');
    } catch (e: any) {
      setError(e?.message || 'Не вдалося обробити фото');
    } finally { setBusy(false); }
  };

  const handleScrape = async () => {
    setBusy(true); setError('');
    try {
      const data = await postJson<{ items: Array<{ name: string; price: number; imageUrl: string }> }>(
        '/api/admin/import/scrape', { url: scrapeUrl });
      if (!data.items.length) throw new Error('На сторінці не знайдено товарів');
      setDrafts(data.items.map((it, i) => ({
        key: `url-${i}-${normalizeName(it.name).slice(0, 20)}`,
        sku: '', name: it.name, price: Math.round(it.price || 0), costPrice: 0, stock: 10,
        category: '', description: '', material: '', brand: '', image: it.imageUrl || '',
        isDuplicate: existingNames.has(normalizeName(it.name)),
        enriched: false, status: 'draft',
      })));
      setPhotoKeys(new Set());
      setStep('enrich');
    } catch (e: any) {
      setError(e?.message || 'Не вдалося зчитати сторінку');
    } finally { setBusy(false); }
  };

  // ---------- КРОК 2 → 3 ----------

  const buildDraftsFromRows = () => {
    const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
    const built = rowsToDrafts(dataRows, columnMap, categories, existingNames);
    if (!built.length) { setError('Жодного валідного рядка: перевірте мапінг колонок'); return; }
    setPhotoKeys(new Set());
    setDrafts(built);
    setError('');
    setStep('enrich');
  };

  // ---------- КРОК 3: АВТО-ОБРОБКА ----------

  const runAutoProcessing = async () => {
    setBusy(true); setError(''); stopRef.current = false;
    const shouldStop = () => stopRef.current;
    let current = drafts;
    const apply = (updated: ImportDraft[]) => { current = updated; setDrafts(updated); };

    try {
      // Етап A: розпізнавання фото (Gemini Vision)
      const photoDrafts = current.filter(d => photoKeys.has(d.key) && !d.enriched);
      if (photoDrafts.length) {
        setProgress({ stage: 'Розпізнаю товари на фото', done: 0, total: photoDrafts.length });
        await runJobs(photoDrafts, async d => {
          const { item } = await postJson<{ item: any }>('/api/admin/ai/photo-identify', {
            image: d.image, categories,
          });
          apply(current.map(x => x.key === d.key ? {
            ...x,
            name: item?.name || x.name,
            category: categories.some(c => c.slug === item?.category) ? item.category : x.category,
            description: item?.description || x.description,
            material: item?.material || x.material,
            price: x.price || Math.round(Number(item?.priceEstimate) || 0),
            isDuplicate: existingNames.has(normalizeName(item?.name || x.name)),
            enriched: true,
          } : x));
          return true;
        }, { concurrency: 2, onProgress: (done, total) => setProgress({ stage: 'Розпізнаю товари на фото', done, total }), shouldStop });
      }

      // Етап B: пакетне AI-збагачення (10 товарів за виклик)
      if (enrichAI && !shouldStop()) {
        const needEnrich = current.filter(d => !d.enriched && (!d.description || !d.category));
        const batches = chunk(needEnrich, 10);
        if (batches.length) {
          setProgress({ stage: 'AI формує назви, категорії та описи', done: 0, total: batches.length });
          await runJobs(batches, async batch => {
            const { items } = await postJson<{ items: any[] }>('/api/admin/ai/enrich-batch', {
              items: batch.map(d => ({ name: d.name, price: d.price, hint: d.sku || d.brand || '' })),
              categories,
            });
            apply(current.map(x => {
              const pos = batch.findIndex(b => b.key === x.key);
              if (pos === -1) return x;
              const found = (items || []).find((it: any) => Number(it?.index) === pos);
              if (!found) return x;
              return {
                ...x,
                name: found.cleanName || x.name,
                category: categories.some(c => c.slug === found.category) ? found.category : x.category,
                description: x.description || found.description || '',
                material: x.material || found.material || '',
                brand: x.brand || found.brand || 'Хатні Штучки',
                isDuplicate: existingNames.has(normalizeName(found.cleanName || x.name)),
                enriched: true,
              };
            }));
            return true;
          }, { concurrency: 2, onProgress: (done, total) => setProgress({ stage: 'AI формує назви, категорії та описи', done, total }), shouldStop });
        }
      }

      // Етап C: фото для карток без зображення
      if ((imagesWeb || imagesAI) && !shouldStop()) {
        const noImage = current.filter(d => !d.image);
        if (noImage.length) {
          setProgress({ stage: 'Підбираю фото', done: 0, total: noImage.length });
          await runJobs(noImage, async d => {
            let image = '';
            if (imagesWeb) {
              try {
                const search = await searchProductWebImages(d.name, d.category || 'home', 3);
                image = search?.candidates?.[0]?.url || '';
              } catch { image = ''; }
            }
            if (!image && imagesAI) {
              image = await generateProductImage(d.name, d.category || 'home');
            }
            if (image) apply(current.map(x => x.key === d.key ? { ...x, image } : x));
            return true;
          }, { concurrency: 2, onProgress: (done, total) => setProgress({ stage: 'Підбираю фото', done, total }), shouldStop });
        }
      }

      apply(current.map(d => ({ ...d, status: draftIssues(d).length ? 'draft' : 'ready' })));
      setStep('review');
    } catch (e: any) {
      setError(e?.message || 'Авто-обробка зупинилась з помилкою');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  // ---------- КРОК 5: ПУБЛІКАЦІЯ ----------

  const publish = async () => {
    setBusy(true); setError(''); setReport(null); stopRef.current = false;
    try {
      const candidates = drafts.filter(d =>
        d.status !== 'published' &&
        (!onlyReady || draftIssues(d).filter(i => i !== 'дублікат').length === 0) &&
        (publishMode === 'upsert' || !d.isDuplicate));
      if (!candidates.length) throw new Error('Немає карток для публікації з поточними налаштуваннями');

      const payload = (d: ImportDraft) => ({
        name: d.name,
        price: d.price,
        cost_price: d.costPrice || undefined,
        stock: d.stock,
        category: d.category,
        description: d.sku ? `${d.description}\n\nАртикул постачальника: ${d.sku}`.trim() : d.description,
        material: d.material,
        brand: d.brand || 'Хатні Штучки',
        image: d.image,
        images: [],
        isPopular: false,
        isBundle: false,
        rating: 0,
        review_count: 0,
        bonusPoints: Math.max(1, Math.round(d.price * 0.05)),
      });

      const batches = chunk(candidates, 25);
      const totals = { created: 0, updated: 0, skipped: 0, errors: 0 };
      for (let i = 0; i < batches.length; i++) {
        if (stopRef.current) break;
        setProgress({ stage: 'Публікую партіями', done: i, total: batches.length });
        const batch = batches[i];
        const { results, summary } = await postJson<{ results: any[]; summary: typeof totals }>(
          '/api/admin/products/bulk', { items: batch.map(payload), mode: publishMode });
        totals.created += summary.created; totals.updated += summary.updated;
        totals.skipped += summary.skipped; totals.errors += summary.errors;
        setDrafts(prev => prev.map(d => {
          const pos = batch.findIndex(b => b.key === d.key);
          if (pos === -1) return d;
          const r = results[pos];
          if (!r) return d;
          if (r.status === 'created' || r.status === 'updated') return { ...d, status: 'published' };
          if (r.status === 'skipped') return { ...d, status: 'skipped' };
          return { ...d, status: 'error', error: r.error };
        }));
      }
      setProgress(null);
      setReport(totals);
    } catch (e: any) {
      setError(e?.message || 'Публікація зупинилась з помилкою');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  // ---------- РЕНДЕР ----------

  const attention = drafts.filter(d => draftIssues(d).length > 0);
  const ready = drafts.filter(d => draftIssues(d).length === 0);
  const visibleDrafts = drafts.filter(d =>
    reviewFilter === 'all' ? true :
    reviewFilter === 'attention' ? draftIssues(d).length > 0 :
    reviewFilter === 'ready' ? draftIssues(d).length === 0 :
    d.isDuplicate);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {(['source', 'mapping', 'enrich', 'review', 'publish'] as Step[]).map(s => (
          <div key={s} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${step === s ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-400'}`}>
            {stepTitles[s]}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>
      )}
      {progress && (
        <div className="rounded-lg border border-tiffany/30 bg-tiffany/5 p-4">
          <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-900">
            <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin text-tiffany" /> {progress.stage}</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-tiffany transition-all" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
          </div>
          <button onClick={() => { stopRef.current = true; }} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-red-500">
            <StopCircle size={14} /> Зупинити
          </button>
        </div>
      )}

      {step === 'source' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ['file', FileSpreadsheet, 'Файл Excel / CSV', 'Прайс постачальника — колонки визначаться автоматично'],
              ['photos', Camera, 'Пакет фото', 'AI розпізнає товар на кожному фото і сформує картку'],
              ['url', Globe2, 'Сторінка постачальника', 'Вкажіть URL категорії — AI витягне список товарів'],
            ] as Array<[SourceType, any, string, string]>).map(([type, Icon, title, hint]) => (
              <button key={type} onClick={() => setSourceType(type)}
                className={`rounded-lg border p-5 text-left transition-colors ${sourceType === type ? 'border-tiffany bg-tiffany/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <Icon size={22} className={sourceType === type ? 'text-tiffany' : 'text-slate-400'} />
                <div className="mt-3 font-bold text-slate-950">{title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{hint}</div>
              </button>
            ))}
          </div>

          {sourceType === 'file' && (
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-slate-500 hover:border-tiffany">
              {busy ? <Loader2 size={32} className="animate-spin text-tiffany" /> : <Upload size={32} />}
              <span className="font-bold">Перетягніть або оберіть .xlsx / .csv</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
          )}
          {sourceType === 'photos' && (
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-slate-500 hover:border-tiffany">
              {busy ? <Loader2 size={32} className="animate-spin text-tiffany" /> : <Camera size={32} />}
              <span className="font-bold">Оберіть до 60 фото товарів</span>
              <input type="file" accept="image/*" multiple className="hidden" disabled={busy}
                onChange={e => e.target.files?.length && handlePhotos(e.target.files)} />
            </label>
          )}
          {sourceType === 'url' && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <input value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} placeholder="https://постачальник.ua/категорія"
                className="flex-1 rounded-lg border border-slate-200 bg-white p-4 focus:ring-2 focus:ring-tiffany" />
              <button onClick={handleScrape} disabled={busy || !scrapeUrl}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-6 py-4 font-bold text-white transition-colors hover:bg-tiffany disabled:bg-slate-300">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Globe2 size={18} />} Зчитати
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'mapping' && (
        <div className="space-y-5">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} className="h-4 w-4 accent-[#81D8D0]" />
            Перший рядок — заголовки
          </label>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {(rawRows[0] || []).map((_, col) => (
                    <th key={col} className="p-2 text-left">
                      <select value={columnMap[col] || 'ignore'}
                        onChange={e => setColumnMap(prev => prev.map((f, i) => i === col ? e.target.value as ColumnField : f))}
                        className="w-full rounded-md border border-slate-200 p-2 text-xs font-bold">
                        {Object.entries(COLUMN_FIELD_LABELS).map(([field, label]) => (
                          <option key={field} value={field}>{label}</option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawRows.slice(0, 6).map((row, r) => (
                  <tr key={r} className={`border-b border-slate-50 ${r === 0 && hasHeader ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {(rawRows[0] || []).map((_, col) => (
                      <td key={col} className="max-w-56 truncate p-2">{row[col] || ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => setStep('source')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
              <ArrowLeft size={16} /> Назад
            </button>
            <button onClick={buildDraftsFromRows}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-6 py-3 font-bold text-white transition-colors hover:bg-tiffany">
              Сформувати чернетки ({hasHeader ? rawRows.length - 1 : rawRows.length}) <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 'enrich' && (
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="text-lg font-bold text-slate-950">Чернеток: {drafts.length}</div>
            <div className="mt-1 text-sm text-slate-500">
              Дублікатів з каталогом: {drafts.filter(d => d.isDuplicate).length} · Без опису: {drafts.filter(d => !d.description).length} · Без фото: {drafts.filter(d => !d.image).length}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
                <input type="checkbox" checked={enrichAI} onChange={e => setEnrichAI(e.target.checked)} className="mt-1 h-4 w-4 accent-[#81D8D0]" />
                <span><span className="font-bold text-slate-900">AI-збагачення</span><br /><span className="text-xs text-slate-500">Назви, категорії, описи — пакетами по 10</span></span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
                <input type="checkbox" checked={imagesWeb} onChange={e => setImagesWeb(e.target.checked)} className="mt-1 h-4 w-4 accent-[#81D8D0]" />
                <span><span className="font-bold text-slate-900">Фото: веб-пошук</span><br /><span className="text-xs text-slate-500">Для карток без зображення</span></span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
                <input type="checkbox" checked={imagesAI} onChange={e => setImagesAI(e.target.checked)} className="mt-1 h-4 w-4 accent-[#81D8D0]" />
                <span><span className="font-bold text-slate-900">Фото: AI-генерація</span><br /><span className="text-xs text-slate-500">Запасний варіант, повільніше</span></span>
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(sourceType === 'file' ? 'mapping' : 'source')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
              <ArrowLeft size={16} /> Назад
            </button>
            <div className="flex gap-3">
              <button onClick={() => { setDrafts(prev => prev.map(d => ({ ...d, status: draftIssues(d).length ? 'draft' : 'ready' }))); setStep('review'); }}
                className="rounded-lg border border-slate-200 px-6 py-3 font-bold text-slate-700 hover:border-tiffany">
                Пропустити
              </button>
              <button onClick={runAutoProcessing} disabled={busy || !drafts.length}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-6 py-3 font-bold text-white transition-colors hover:bg-tiffany disabled:bg-slate-300">
                <Wand2 size={18} /> Запустити авто-обробку
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {([['all', `Всі (${drafts.length})`], ['attention', `Потребують уваги (${attention.length})`], ['ready', `Готові (${ready.length})`], ['duplicates', `Дублікати (${drafts.filter(d => d.isDuplicate).length})`]] as Array<['all' | 'attention' | 'ready' | 'duplicates', string]>).map(([f, label]) => (
              <button key={f} onClick={() => setReviewFilter(f)}
                className={`rounded-lg px-4 py-2 text-xs font-bold ${reviewFilter === f ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {visibleDrafts.slice(0, 100).map(d => {
              const issues = draftIssues(d);
              return (
                <div key={d.key} className={`grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-[80px_1fr_auto] ${issues.length ? 'border-amber-200' : 'border-slate-200'}`}>
                  <div className="h-20 w-20 overflow-hidden rounded-lg bg-cream-dark">
                    {d.image ? <img src={d.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> :
                      <div className="flex h-full items-center justify-center text-[10px] font-bold uppercase text-slate-400">Без фото</div>}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <input value={d.name} onChange={e => patchDraft(d.key, { name: e.target.value, isDuplicate: existingNames.has(normalizeName(e.target.value)) })}
                      className="w-full rounded-md border border-slate-200 p-2 text-sm font-bold" />
                    <div className="flex flex-wrap gap-2">
                      <input type="number" value={d.price} onChange={e => patchDraft(d.key, { price: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-24 rounded-md border border-slate-200 p-2 text-sm" placeholder="Ціна" aria-label={`Ціна «${d.name}»`} />
                      <input type="number" value={d.stock} onChange={e => patchDraft(d.key, { stock: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-20 rounded-md border border-slate-200 p-2 text-sm" placeholder="К-сть" aria-label={`Кількість «${d.name}»`} />
                      <select value={d.category} onChange={e => patchDraft(d.key, { category: e.target.value })}
                        className="rounded-md border border-slate-200 p-2 text-sm" aria-label={`Категорія «${d.name}»`}>
                        <option value="">Категорія…</option>
                        {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                      </select>
                    </div>
                    {issues.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {issues.map(issue => (
                          <span key={issue} className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600">{issue}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setDrafts(prev => prev.filter(x => x.key !== d.key))}
                    aria-label={`Прибрати «${d.name}» з імпорту`}
                    className="self-start text-slate-300 hover:text-red-500">
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
            {visibleDrafts.length > 100 && (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                Показано перші 100 з {visibleDrafts.length}. Решта теж піде в публікацію.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep('enrich')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
              <ArrowLeft size={16} /> Назад
            </button>
            <button onClick={() => setStep('publish')} disabled={!drafts.length}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-6 py-3 font-bold text-white transition-colors hover:bg-tiffany disabled:bg-slate-300">
              До публікації <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 'publish' && (
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="text-lg font-bold text-slate-950">Готово до публікації: {ready.length} з {drafts.length}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
                <input type="checkbox" checked={publishMode === 'upsert'} onChange={e => setPublishMode(e.target.checked ? 'upsert' : 'create')} className="mt-1 h-4 w-4 accent-[#81D8D0]" />
                <span><span className="font-bold text-slate-900">Оновлювати існуючі</span><br /><span className="text-xs text-slate-500">Дублікати за назвою оновляться (ціна, залишок), інакше — пропустяться</span></span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
                <input type="checkbox" checked={onlyReady} onChange={e => setOnlyReady(e.target.checked)} className="mt-1 h-4 w-4 accent-[#81D8D0]" />
                <span><span className="font-bold text-slate-900">Лише готові картки</span><br /><span className="text-xs text-slate-500">Картки з проблемами лишаться в чернетках</span></span>
              </label>
            </div>
          </div>

          {report && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
              <div className="inline-flex items-center gap-2 font-bold text-emerald-700"><CheckCircle2 size={20} /> Імпорт завершено</div>
              <div className="mt-2 text-sm text-emerald-800">
                Створено: {report.created} · Оновлено: {report.updated} · Пропущено: {report.skipped} · Помилок: {report.errors}
              </div>
              <button onClick={() => onComplete?.()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
                Перейти до товарів <ArrowRight size={16} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button onClick={() => setStep('review')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
              <ArrowLeft size={16} /> Назад
            </button>
            <button onClick={publish} disabled={busy || !drafts.length}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-8 py-4 font-bold text-white transition-colors hover:bg-tiffany disabled:bg-slate-300">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Rocket size={18} />} Опублікувати
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
