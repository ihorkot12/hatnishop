import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const DEFAULT_FILE = 'C:/Users/ihork/Downloads/закупка Аркуш Microsoft Excel.xlsx';
const DEFAULT_BASE_URL = 'https://hatni.shop';
const BONUS_RATE = 0.05;
const PAYMENT_RATE = 0.025;
const OPS_RATE = 0.04;
const MIN_MATCH_SCORE = 0.58;

function parseArgs(argv) {
  const args = {
    apply: false,
    file: DEFAULT_FILE,
    baseUrl: process.env.HATNI_BASE_URL || DEFAULT_BASE_URL,
    email: process.env.HATNI_ADMIN_EMAIL || '',
    password: process.env.HATNI_ADMIN_PASSWORD || '',
    report: path.join('reports', `pricing-update-${new Date().toISOString().slice(0, 10)}.xlsx`),
    generateBundleImages: true,
    onlyBundles: false,
    bundleId: '',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--email') args.email = argv[++i];
    else if (arg === '--password') args.password = argv[++i];
    else if (arg === '--report') args.report = argv[++i];
    else if (arg === '--skip-bundle-images') args.generateBundleImages = false;
    else if (arg === '--only-bundles') args.onlyBundles = true;
    else if (arg === '--bundle-id') args.bundleId = argv[++i];
  }

  return args;
}

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/["'`«»“”„]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeLoose = (value) => normalize(value)
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\b(шт|см|мм|мл|л|h|l|v|o|ø|d)\b/giu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function extractCode(value) {
  const first = String(value || '').trim().split(/\s+/)[0] || '';
  return /\d/.test(first) ? first.toUpperCase() : '';
}

function stripLeadingCode(value) {
  const text = String(value || '').trim();
  return extractCode(text) ? text.replace(/^\S+\s+/, '').trim() : text;
}

function tokens(value) {
  return normalizeLoose(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

function jaccard(a, b) {
  const aSet = new Set(a);
  const bSet = new Set(b);
  if (!aSet.size || !bSet.size) return 0;
  let intersection = 0;
  for (const token of aSet) if (bSet.has(token)) intersection += 1;
  return intersection / (aSet.size + bSet.size - intersection);
}

function isBundle(product) {
  const raw = product?.isBundle ?? product?.isbundle ?? product?.is_bundle;
  return raw === true || raw === 1 || raw === '1' || raw === 'true';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function readPurchaseRows(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.worksheets[0];
  const rows = [];

  sheet.eachRow((row, rowNumber) => {
    const rawName = String(row.getCell(1).text || row.getCell(1).value || '').trim();
    const quantity = toNumber(row.getCell(2).value);
    const cost = toNumber(row.getCell(3).value);
    if (!rawName || rawName.toLowerCase() === 'магазин' || cost <= 0) return;

    rows.push({
      rowNumber,
      rawName,
      name: stripLeadingCode(rawName),
      code: extractCode(rawName),
      quantity,
      cost,
      tokens: tokens(rawName),
    });
  });

  return rows;
}

function matchProduct(product, purchaseRows) {
  const productName = product.name || '';
  const productCode = extractCode(productName);
  const productNorm = normalize(productName);
  const productClean = normalize(stripLeadingCode(productName));
  const productTokens = tokens(productName);
  let best = null;

  for (const row of purchaseRows) {
    let score = 0;
    const rowNorm = normalize(row.rawName);
    const rowClean = normalize(row.name);

    if (rowNorm === productNorm) score = 1;
    else if (rowClean && rowClean === productClean) score = 0.96;
    else if (row.code && productCode && row.code === productCode) score = 0.9 + jaccard(productTokens, row.tokens) * 0.1;
    else if (row.code && productNorm.includes(row.code.toLowerCase())) score = 0.84 + jaccard(productTokens, row.tokens) * 0.1;
    else score = jaccard(productTokens, row.tokens);

    if (!best || score > best.score) best = { row, score };
  }

  return best && best.score >= MIN_MATCH_SCORE ? best : null;
}

function categoryTargetMargin(category) {
  const value = normalize(category);
  if (value.includes('textile')) return 0.42;
  if (value.includes('kitchen')) return 0.38;
  if (value.includes('decor')) return 0.44;
  if (value.includes('bottle')) return 0.36;
  if (value.includes('organization')) return 0.4;
  return 0.39;
}

function marketMultiplier(cost, category) {
  const value = normalize(category);
  let base = cost < 30 ? 3.25
    : cost < 80 ? 2.65
      : cost < 150 ? 2.3
        : cost < 300 ? 2.0
          : cost < 700 ? 1.75
            : 1.58;

  if (value.includes('decor') || value.includes('textile')) base += 0.12;
  if (value.includes('kitchen')) base -= 0.04;
  return base;
}

function charmPrice(value) {
  const raw = Math.max(19, Number(value || 0));
  if (raw < 100) return Math.max(29, Math.ceil(raw / 10) * 10 - 1);
  if (raw < 500) return Math.ceil(raw / 10) * 10 - 1;
  if (raw < 1000) return Math.ceil(raw / 20) * 20 - 1;
  return Math.ceil(raw / 50) * 50 - 1;
}

function recommendedPrice(cost, category) {
  const targetMargin = categoryTargetMargin(category);
  const fixedOps = Math.max(6, Math.min(22, cost * 0.08));
  const financialFloor = (cost + fixedOps) / Math.max(0.22, 1 - targetMargin - BONUS_RATE - PAYMENT_RATE - OPS_RATE);
  const marketEstimate = cost * marketMultiplier(cost, category);
  const price = charmPrice(Math.max(financialFloor, marketEstimate * 0.96));

  return {
    price,
    marketEstimate: charmPrice(marketEstimate),
    targetMargin,
    netMargin: price ? (price - cost - price * BONUS_RATE - price * PAYMENT_RATE - price * OPS_RATE) / price : 0,
  };
}

function headersWithJson(options = {}, cookieHeader = '') {
  const headers = { ...(options.headers || {}) };
  if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';
  if (cookieHeader) headers.Cookie = cookieHeader;
  return headers;
}

function rememberCookies(response, jar) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return;
  for (const item of setCookie.split(/,(?=[^;]+?=)/)) {
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
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  }
  return data;
}

function productUpdatePayload(product, overrides = {}) {
  return {
    name: product.name,
    category: product.category,
    price: product.price,
    image: product.image,
    images: Array.isArray(product.images) ? product.images : [],
    description: product.description || '',
    material: product.material || '',
    brand: product.brand || '',
    isPopular: !!product.isPopular,
    isBundle: isBundle(product),
    bundle_items: Array.isArray(product.bundle_items) ? product.bundle_items : (Array.isArray(product.bundleItems) ? product.bundleItems : []),
    stock: toNumber(product.stock),
    bonusPoints: toNumber(product.bonusPoints ?? product.bonus_points),
    rating: toNumber(product.rating, 5),
    reviewCount: toNumber(product.reviewCount ?? product.review_count),
    cost_price: product.cost_price,
    ...overrides,
  };
}

const bundlePlans = [
  {
    id: 'bundle-morning-coffee',
    name: 'Набір "Ранкова кава"',
    keywords: ['кухоль', 'чаш', 'кава', 'лож', 'склян', 'сервет'],
    description: 'для кави, сніданку і маленьких ранкових ритуалів',
  },
  {
    id: 'bundle-table-serving',
    name: 'Набір "Сервірування столу"',
    keywords: ['блюдо', 'таріл', 'салатник', 'склян', 'келих', 'глечик', 'сервет'],
    description: 'для красивої подачі страв на стіл',
  },
  {
    id: 'bundle-kitchen-order',
    name: 'Набір "Порядок на кухні"',
    keywords: ['ємн', 'контейнер', 'банка', 'кошик', 'сипуч', 'органайзер'],
    description: 'для зберігання, полиць і чистої кухонної зони',
  },
  {
    id: 'bundle-kitchen-tools',
    name: 'Набір "Кухонний старт"',
    keywords: ['ложка', 'ополоник', 'лопат', 'відкривач', 'штопор', 'сито', 'форма'],
    description: 'базові дрібниці, які щодня потрібні на кухні',
  },
  {
    id: 'bundle-party-serve',
    name: 'Набір "Подача та канапе"',
    keywords: ['шпаж', 'трубоч', 'канапе', 'паперов', 'бамбук', 'салатник', 'блюдо'],
    description: 'для закусок, напоїв і швидкої подачі гостям',
  },
];

function scoreForPlan(product, plan) {
  const text = normalizeLoose([product.name, product.category, product.description, product.material, product.brand].filter(Boolean).join(' '));
  let score = 0;
  for (const keyword of plan.keywords) {
    if (text.includes(normalizeLoose(keyword))) score += 25;
  }
  if (Number(product.stock || 0) > 1) score += 5;
  if (Number(product.rating || 0) >= 4.8) score += 3;
  if (Number(product.price || 0) < 400) score += 2;
  return score;
}

function buildBundles(products) {
  const used = new Set();
  const candidates = products.filter((product) => !isBundle(product) && Number(product.stock || 0) > 0 && Number(product.price || 0) > 0);
  const bundles = [];

  for (const plan of bundlePlans) {
    const items = candidates
      .filter((product) => !used.has(product.id))
      .map((product) => ({ product, score: scoreForPlan(product, plan) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || Number(a.product.price || 0) - Number(b.product.price || 0))
      .slice(0, 4)
      .map((item) => item.product);

    if (items.length < 2) continue;
    for (const item of items) used.add(item.id);

    const regularPrice = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const cost = items.reduce((sum, item) => sum + Number(item.cost_price || 0), 0);
    const floor = cost > 0 ? charmPrice(cost / Math.max(0.28, 1 - 0.33 - BONUS_RATE - PAYMENT_RATE - OPS_RATE)) : 0;
    const bundlePrice = Math.max(charmPrice(regularPrice * 0.85), floor);
    const savings = Math.max(0, regularPrice - bundlePrice);
    const stock = Math.max(1, Math.min(...items.map((item) => Math.max(1, Number(item.stock || 1)))));
    const itemLines = items.map((item) => `- ${item.name} — ${Number(item.price || 0).toLocaleString('uk-UA')} грн`);

    bundles.push({
      plan,
      items,
      payload: {
        id: plan.id,
        name: plan.name,
        category: 'bundles',
        price: bundlePrice,
        cost_price: cost || undefined,
        image: items[0].image,
        images: items.map((item) => item.image).filter(Boolean).slice(0, 6),
        description: [
          `${plan.name} — готовий комплект ${plan.description}.`,
          '',
          'Склад набору:',
          ...itemLines,
          '',
          `Окремо: ${regularPrice.toLocaleString('uk-UA')} грн. Ціна набору: ${bundlePrice.toLocaleString('uk-UA')} грн. Економія: ${savings.toLocaleString('uk-UA')} грн.`,
        ].join('\n'),
        material: 'комплект',
        brand: 'Хатні Штучки',
        isPopular: true,
        isBundle: true,
        stock,
        bonusPoints: Math.round(bundlePrice * BONUS_RATE),
        rating: 5,
        reviewCount: 0,
        bundle_items: items.map((item) => item.id),
      },
      regularPrice,
      bundlePrice,
      savings,
      cost,
    });
  }

  return bundles;
}

async function writeReport(reportPath, productRows, bundleRows, unmatchedPurchases, assumptions) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Codex';
  workbook.created = new Date();

  const addHeaderStyle = (sheet) => {
    sheet.getRow(1).font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: sheet.getRow(1).getCell(sheet.columnCount).address };
  };

  const productsSheet = workbook.addWorksheet('Оновлені товари');
  productsSheet.columns = [
    { header: 'ID', key: 'id', width: 18 },
    { header: 'Товар на сайті', key: 'name', width: 44 },
    { header: 'Рядок закупки', key: 'purchaseName', width: 48 },
    { header: 'К-сть', key: 'quantity', width: 8 },
    { header: 'Собівартість', key: 'cost', width: 14 },
    { header: 'Стара ціна', key: 'oldPrice', width: 12 },
    { header: 'Оцінка ринку', key: 'marketEstimate', width: 14 },
    { header: 'Нова ціна', key: 'newPrice', width: 12 },
    { header: 'Бонуси 5%', key: 'bonusFormula', width: 12 },
    { header: 'Маржа після бонусів', key: 'marginFormula', width: 18 },
    { header: 'Збіг', key: 'score', width: 10 },
    { header: 'Статус', key: 'status', width: 16 },
  ];
  for (const row of productRows) {
    const added = productsSheet.addRow({
      id: row.product.id,
      name: row.product.name,
      purchaseName: row.purchase?.rawName || '',
      quantity: row.purchase?.quantity || '',
      cost: row.cost || '',
      oldPrice: row.oldPrice,
      marketEstimate: row.marketEstimate || '',
      newPrice: row.newPrice || '',
      score: row.matchScore ? Number(row.matchScore.toFixed(3)) : '',
      status: row.status,
    });
    if (row.newPrice) {
      added.getCell('bonusFormula').value = { formula: `H${added.number}*${BONUS_RATE}`, result: Math.round(row.newPrice * BONUS_RATE) };
      added.getCell('marginFormula').value = { formula: `IF(H${added.number}=0,0,(H${added.number}-E${added.number}-I${added.number}-H${added.number}*${PAYMENT_RATE + OPS_RATE})/H${added.number})`, result: row.netMargin };
    }
  }
  addHeaderStyle(productsSheet);
  productsSheet.getColumn('cost').numFmt = '#,##0.00';
  productsSheet.getColumn('oldPrice').numFmt = '#,##0';
  productsSheet.getColumn('marketEstimate').numFmt = '#,##0';
  productsSheet.getColumn('newPrice').numFmt = '#,##0';
  productsSheet.getColumn('bonusFormula').numFmt = '#,##0';
  productsSheet.getColumn('marginFormula').numFmt = '0.0%';

  const bundlesSheet = workbook.addWorksheet('Бандли');
  bundlesSheet.columns = [
    { header: 'ID', key: 'id', width: 24 },
    { header: 'Назва', key: 'name', width: 30 },
    { header: 'Склад', key: 'items', width: 70 },
    { header: 'Собівартість', key: 'cost', width: 14 },
    { header: 'Окремо', key: 'regularPrice', width: 12 },
    { header: 'Ціна набору', key: 'bundlePrice', width: 14 },
    { header: 'Економія', key: 'savingsFormula', width: 12 },
    { header: 'Бонуси', key: 'bonusFormula', width: 12 },
    { header: 'Статус', key: 'status', width: 16 },
  ];
  for (const row of bundleRows) {
    const added = bundlesSheet.addRow({
      id: row.payload.id,
      name: row.payload.name,
      items: row.items.map((item) => item.name).join('\n'),
      cost: row.cost || '',
      regularPrice: row.regularPrice,
      bundlePrice: row.bundlePrice,
      status: row.status || '',
    });
    added.getCell('savingsFormula').value = { formula: `E${added.number}-F${added.number}`, result: row.savings };
    added.getCell('bonusFormula').value = { formula: `F${added.number}*${BONUS_RATE}`, result: Math.round(row.bundlePrice * BONUS_RATE) };
    added.alignment = { vertical: 'top', wrapText: true };
  }
  addHeaderStyle(bundlesSheet);
  bundlesSheet.getColumn('cost').numFmt = '#,##0.00';
  bundlesSheet.getColumn('regularPrice').numFmt = '#,##0';
  bundlesSheet.getColumn('bundlePrice').numFmt = '#,##0';
  bundlesSheet.getColumn('savingsFormula').numFmt = '#,##0';
  bundlesSheet.getColumn('bonusFormula').numFmt = '#,##0';

  const unmatchedSheet = workbook.addWorksheet('Не знайдено');
  unmatchedSheet.columns = [
    { header: 'Рядок', key: 'rowNumber', width: 8 },
    { header: 'Назва із закупки', key: 'rawName', width: 70 },
    { header: 'К-сть', key: 'quantity', width: 10 },
    { header: 'Собівартість', key: 'cost', width: 14 },
  ];
  unmatchedPurchases.forEach((row) => unmatchedSheet.addRow(row));
  addHeaderStyle(unmatchedSheet);
  unmatchedSheet.getColumn('cost').numFmt = '#,##0.00';

  const assumptionsSheet = workbook.addWorksheet('Припущення');
  assumptionsSheet.columns = [
    { header: 'Параметр', key: 'key', width: 34 },
    { header: 'Значення', key: 'value', width: 24 },
    { header: 'Коментар', key: 'comment', width: 80 },
  ];
  assumptions.forEach((row) => assumptionsSheet.addRow(row));
  addHeaderStyle(assumptionsSheet);

  await workbook.xlsx.writeFile(reportPath);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.apply && (!args.email || !args.password)) {
    throw new Error('Use --email/--password or HATNI_ADMIN_EMAIL/HATNI_ADMIN_PASSWORD for --apply');
  }

  const purchases = await readPurchaseRows(args.file);
  const jar = new Map();
  const products = await apiRequest(args.baseUrl, '/api/products', { headers: { 'Cache-Control': 'no-cache' } }, jar);
  if (!Array.isArray(products)) throw new Error('Products API returned non-array payload');

  if (args.apply) {
    await apiRequest(args.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: args.email, password: args.password }),
    }, jar);
  }

  const productRows = [];
  const matchedPurchaseRows = new Set();
  const updatedProducts = [];

  for (const product of products) {
    if (isBundle(product)) continue;
    const match = matchProduct(product, purchases);
    const existingCost = toNumber(product.cost_price);
    const cost = match?.row?.cost || existingCost;
    if (!cost) {
      productRows.push({ product, oldPrice: Number(product.price || 0), status: 'без собівартості' });
      continue;
    }

    if (match) matchedPurchaseRows.add(match.row.rowNumber);
    const pricing = recommendedPrice(cost, product.category);
    const payload = productUpdatePayload(product, {
      price: pricing.price,
      cost_price: cost,
      bonusPoints: Math.round(pricing.price * BONUS_RATE),
    });

    if (args.onlyBundles) {
      const updated = { ...product, ...payload };
      updatedProducts.push(updated);
      productRows.push({
        product,
        purchase: match?.row,
        cost,
        oldPrice: Number(product.price || 0),
        newPrice: pricing.price,
        marketEstimate: pricing.marketEstimate,
        netMargin: pricing.netMargin,
        matchScore: match?.score,
        status: 'kept for bundle pricing',
      });
      continue;
    }

    let status = args.apply ? 'оновлено' : 'план';
    if (args.apply) {
      try {
        await apiRequest(args.baseUrl, `/api/admin/products/${encodeURIComponent(product.id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        }, jar);
      } catch (error) {
        status = `помилка: ${error.message}`;
      }
    }

    const updated = { ...product, ...payload };
    updatedProducts.push(updated);
    productRows.push({
      product,
      purchase: match?.row,
      cost,
      oldPrice: Number(product.price || 0),
      newPrice: pricing.price,
      marketEstimate: pricing.marketEstimate,
      netMargin: pricing.netMargin,
      matchScore: match?.score,
      status,
    });
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  for (const updated of updatedProducts) productMap.set(updated.id, updated);
  const productsForBundles = [...productMap.values()];
  let bundles = buildBundles(productsForBundles);
  if (args.bundleId) {
    bundles = bundles.filter((bundle) => bundle.payload.id === args.bundleId);
  }
  const existingBundles = products.filter((product) => isBundle(product));

  for (const bundle of bundles) {
    const existing = products.find((item) => item.id === bundle.payload.id || normalize(item.name) === normalize(bundle.payload.name));
    if (args.apply) {
      const fallbackImage = bundle.payload.image;
      const fallbackImages = Array.isArray(bundle.payload.images) ? [...bundle.payload.images] : [];
      try {
        if (args.generateBundleImages) {
          const imageResult = await apiRequest(args.baseUrl, '/api/admin/ai/product-image', {
            method: 'POST',
            body: JSON.stringify({ name: bundle.payload.name, category: 'bundles' }),
          }, jar);
          if (imageResult?.image) {
            bundle.payload.image = imageResult.image;
            bundle.payload.images = [imageResult.image, ...bundle.payload.images].filter(Boolean).slice(0, 8);
          }
        }

        const pathName = existing ? `/api/admin/products/${encodeURIComponent(existing.id)}` : '/api/admin/products';
        const body = existing
          ? productUpdatePayload(existing, { ...bundle.payload, id: existing.id })
          : bundle.payload;
        await apiRequest(args.baseUrl, pathName, {
          method: existing ? 'PUT' : 'POST',
          body: JSON.stringify(body),
        }, jar);
        bundle.status = existing ? 'оновлено' : 'створено';
      } catch (error) {
        if (args.generateBundleImages && String(error.message).includes('413')) {
          try {
            bundle.payload.image = fallbackImage;
            bundle.payload.images = fallbackImages;
            const pathName = existing ? `/api/admin/products/${encodeURIComponent(existing.id)}` : '/api/admin/products';
            const body = existing
              ? productUpdatePayload(existing, { ...bundle.payload, id: existing.id })
              : bundle.payload;
            await apiRequest(args.baseUrl, pathName, {
              method: existing ? 'PUT' : 'POST',
              body: JSON.stringify(body),
            }, jar);
            bundle.status = existing ? 'updated with light product images (413 fallback)' : 'created with light product images (413 fallback)';
            continue;
          } catch (retryError) {
            bundle.status = `retry failed after 413: ${retryError.message}`;
            continue;
          }
        }
        bundle.status = `помилка: ${error.message}`;
      }
    } else {
      bundle.status = existing ? 'план оновлення' : 'план створення';
    }
  }

  const unmatchedPurchases = purchases.filter((row) => !matchedPurchaseRows.has(row.rowNumber));
  await writeReport(args.report, productRows, bundles, unmatchedPurchases, [
    { key: 'Джерело закупки', value: args.file, comment: 'Колонка A: назва, B: кількість, C: закупочна ціна за одиницю.' },
    { key: 'Бонусна програма', value: '5%', comment: 'У ціні враховано майбутній кешбек/бонуси покупцю.' },
    { key: 'Платіжні та операційні витрати', value: `${((PAYMENT_RATE + OPS_RATE) * 100).toFixed(1)}%`, comment: 'Орієнтовний резерв на еквайринг, пакування, операційні дрібні витрати.' },
    { key: 'Ринкова ціна', value: 'оцінка', comment: 'Автоматична оцінка по категорії та закупці; для точного live-моніторингу конкурентів потрібен пошуковий/price API.' },
    { key: 'Округлення', value: 'ціна на 9', comment: 'Психологічне округлення: 59, 129, 399 тощо.' },
  ]);

  console.log(JSON.stringify({
    apply: args.apply,
    products: {
      total: products.length,
      plannedOrUpdated: productRows.filter((row) => row.newPrice).length,
      withoutCost: productRows.filter((row) => row.status === 'без собівартості').length,
      errors: productRows.filter((row) => String(row.status).startsWith('помилка')).length,
    },
    purchases: {
      rows: purchases.length,
      matched: matchedPurchaseRows.size,
      unmatched: unmatchedPurchases.length,
    },
    bundles: bundles.map((bundle) => ({
      id: bundle.payload.id,
      name: bundle.payload.name,
      items: bundle.items.length,
      regularPrice: bundle.regularPrice,
      bundlePrice: bundle.bundlePrice,
      savings: bundle.savings,
      status: bundle.status,
    })),
    report: path.resolve(args.report),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
