import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BASE_URL = 'https://hatni.shop';
const GENERATED_IMAGE_DIR = path.join(process.cwd(), 'public', 'product-images', 'generated');
const GENERATED_IMAGE_URL_PREFIX = '/product-images/generated';

function parseArgs(argv) {
  const args = {
    apply: false,
    baseUrl: process.env.HATNI_BASE_URL || DEFAULT_BASE_URL,
    email: process.env.HATNI_ADMIN_EMAIL || '',
    password: process.env.HATNI_ADMIN_PASSWORD || '',
    all: false,
    images: true,
    normalize: true,
    limit: 0,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--all') args.all = true;
    else if (arg === '--no-images') args.images = false;
    else if (arg === '--no-normalize') args.normalize = false;
    else if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--email') args.email = argv[++i];
    else if (arg === '--password') args.password = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i] || 0);
    else if (arg === '--help') {
      console.log(`Usage:
  node scripts/merchandise-products.mjs
  node scripts/merchandise-products.mjs --apply --email admin@example.com --password "***"

Options:
  --apply          Update products through admin API.
  --all            Process every product. Default: only imported stock-1806 products.
  --no-images      Do not generate local catalog images.
  --no-normalize   Do not clean names/descriptions.
  --limit N        Process first N matching products.
`);
      process.exit(0);
    }
  }
  return args;
}

const normalizeSpace = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const escapeXml = (value) => String(value || '').replace(/[<>&"']/g, (char) => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;',
}[char]));

const removeOldMerchBlock = (description) =>
  normalizeSpace(description)
    .replace(/\s*Характеристики:\s.*$/isu, '')
    .replace(/\s*Оригінальна назва постачальника:\s.*$/isu, '')
    .trim();

const parseSource = (description, fallbackName) => {
  const text = normalizeSpace(description);
  const skuMatch = text.match(/Артикул постачальника:\s*([^.]*)\./iu);
  const marker = 'Серія/назва з файлу:';
  const markerIndex = text.indexOf(marker);
  let originalName = fallbackName;

  if (markerIndex >= 0) {
    originalName = text.slice(markerIndex + marker.length).replace(/\s*Характеристики:\s.*$/isu, '').replace(/\.$/, '').trim();
  }

  return {
    sku: normalizeSpace(skuMatch?.[1] || ''),
    originalName: normalizeSpace(originalName || fallbackName),
  };
};

const unique = (items) => [...new Set(items.map(normalizeSpace).filter(Boolean))];

function collect(pattern, text) {
  return unique([...text.matchAll(pattern)].map((match) => match[0]));
}

function cleanProductName(product) {
  const source = parseSource(product.description, product.name);
  let name = normalizeSpace(product.name);
  const fullText = normalizeSpace(`${source.originalName} ${product.name}`);

  const specs = {
    sku: source.sku && !/^row-/i.test(source.sku) ? source.sku : '',
    volume: collect(/\d+(?:[,.]\d+)?\s*(?:мл|л)(?![a-zа-яіїєґ])/giu, fullText),
    size: [
      ...collect(/\d+(?:[,.]\d+)?\s*[xх*]\s*\d+(?:[,.]\d+)?(?:\s*[xх*]\s*\d+(?:[,.]\d+)?)?\s*(?:см|cm)?/giu, fullText),
      ...collect(/[Ø∅]\s*\d+(?:[,.]\d+)?\s*(?:см)?/giu, fullText),
      ...collect(/\b[DLH]\s*\d+(?:[,.]\d+)?\s*(?:см|cm)/giu, fullText),
    ],
    count: [
      ...collect(/\d+\s*шт\.?/giu, fullText),
      ...collect(/\b\d+\s*пр\b/giu, fullText),
    ],
    barcode: collect(/\b\d{8,13}\b/gu, fullText),
    packaging: collect(/\b(?:кол\.?\s*кор\.?|под\.?\s*уп\.?|подарункова упаковка)\b/giu, fullText),
  };

  const removals = [
    /\d+(?:[,.]\d+)?\s*(?:мл|л)(?![a-zа-яіїєґ])/giu,
    /\d+(?:[,.]\d+)?\s*[xх*]\s*\d+(?:[,.]\d+)?(?:\s*[xх*]\s*\d+(?:[,.]\d+)?)?\s*(?:см|cm)?/giu,
    /[Ø∅]\s*\d+(?:[,.]\d+)?\s*(?:см)?/giu,
    /\b[DLH]\s*\d+(?:[,.]\d+)?\s*(?:см|cm)/giu,
    /\d+\s*шт\.?/giu,
    /\b\d+\s*пр\b/giu,
    /\b\d{8,13}\b/gu,
    /\b(?:кол\.?\s*кор\.?|под\.?\s*уп\.?)\b/giu,
    /\(\s*\d+\s*\)/gu,
    /\(\s*(?:см|cm|мл|л|шт)\s*\)/giu,
    /\(\s*\)/gu,
  ];

  for (const pattern of removals) name = name.replace(pattern, ' ');
  name = name
    .replace(/\bV\s*(?=\d)/giu, ' ')
    .replace(/(^|[\s,(])(?:см|cm|мл|л|шт)(?=$|[\s,).])/giu, '$1')
    .replace(/\s*[,/]\s*$/gu, '')
    .replace(/\s{2,}/gu, ' ')
    .replace(/\s+([,)])/gu, '$1')
    .replace(/[(]\s*[)]/gu, '')
    .replace(/\s+,/gu, ',')
    .replace(/,\s*$/gu, '')
    .replace(/\.\s*$/gu, '')
    .trim();

  if (name.length < 5) name = normalizeSpace(product.name);

  return { name, specs, originalName: source.originalName };
}

function buildDescription(product, cleanName, specs, originalName) {
  const baseDescription = removeOldMerchBlock(product.description);
  const intro = baseDescription && !/позиція з актуальних залишків/i.test(baseDescription)
    ? baseDescription
    : `${cleanName} — добірна позиція для дому з каталогу Hatni Shop. Пасує для щоденного використання, сервірування або акуратної організації простору.`;

  const specRows = [
    specs.sku ? `Артикул: ${specs.sku}` : '',
    specs.volume.length ? `Об'єм: ${specs.volume.join(', ')}` : '',
    specs.size.length ? `Розмір: ${specs.size.join(', ')}` : '',
    specs.count.length ? `Кількість у наборі: ${specs.count.join(', ')}` : '',
    product.material ? `Матеріал: ${product.material}` : '',
    product.brand ? `Бренд/серія: ${product.brand}` : '',
    specs.packaging.length ? `Упаковка: ${specs.packaging.join(', ')}` : '',
    specs.barcode.length ? `Код постачальника: ${specs.barcode.join(', ')}` : '',
  ].filter(Boolean);

  return [
    intro,
    specRows.length ? `Характеристики:\n- ${specRows.join('\n- ')}` : '',
    originalName ? `Оригінальна назва постачальника: ${originalName}` : '',
  ].filter(Boolean).join('\n\n');
}

function categoryPalette(category) {
  const palettes = {
    tableware: ['#f8f4ef', '#68b8b0', '#0f172a'],
    kitchen: ['#f4f7f2', '#9bb86f', '#1f2937'],
    textile: ['#f6f1f7', '#c08497', '#312e81'],
    organization: ['#f3f6f8', '#8aa6b8', '#263238'],
    bottles: ['#eff7f7', '#5aa7a7', '#0f172a'],
    decor: ['#f8f3ee', '#b98963', '#2f241d'],
  };
  return palettes[category] || palettes.tableware;
}

function productKind(product) {
  const text = normalizeSpace(`${product.name} ${product.description}`).toLowerCase();
  if (/кухоль|чаш|лате/.test(text)) return 'mug';
  if (/склян|келих/.test(text)) return 'glass';
  if (/глечик|графин/.test(text)) return 'pitcher';
  if (/таріл|блюдо|салатник|миска/.test(text)) return 'plate';
  if (/лож|видел|ніж|лопатк|шумівк|щипц|ополоник|сито|друшляк|пензлик/.test(text)) return 'utensil';
  if (/контейнер|ємн|банка/.test(text)) return 'container';
  if (/кошик|органайзер/.test(text)) return 'basket';
  if (/килимок|сервет|рушник|скатерт/.test(text)) return 'textile';
  if (/термос|пляш/.test(text)) return 'bottle';
  if (/форма|деко|випіч/.test(text)) return 'bakeware';
  return 'object';
}

function productShape(kind, accent, ink) {
  const common = `stroke="${ink}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const fill = `fill="${accent}" fill-opacity="0.18" stroke="${ink}" stroke-width="10" stroke-linejoin="round"`;
  const shapes = {
    mug: `<path d="M318 338h196v214c0 67-43 112-98 112h-1c-55 0-97-45-97-112V338Z" ${fill}/><path d="M514 396h51c50 0 83 34 83 80s-33 79-83 79h-51" ${common}/><path d="M342 296h148" ${common}/><path d="M360 255c-16-26 30-33 12-62M431 255c-16-26 30-33 12-62" ${common}/>` ,
    glass: `<path d="M330 274h240l-28 390H358L330 274Z" ${fill}/><path d="M356 378h188" ${common}/><path d="M374 520h152" ${common}/>` ,
    pitcher: `<path d="M312 292h210l30 372H342L312 292Z" ${fill}/><path d="M522 348h47c49 0 82 37 82 88s-33 88-82 88h-34" ${common}/><path d="M352 250h130" ${common}/>` ,
    plate: `<ellipse cx="450" cy="470" rx="220" ry="164" ${fill}/><ellipse cx="450" cy="470" rx="132" ry="88" ${common}/>` ,
    utensil: `<path d="M350 246v416M304 250v130c0 46 92 46 92 0V250M543 250c-64 52-82 156-47 236l47 176" ${common}/><path d="M543 250v412" ${common}/>` ,
    container: `<path d="M278 330h344v306H278V330Z" ${fill}/><path d="M246 294h408v74H246v-74Z" ${fill}/><path d="M322 450h256" ${common}/>` ,
    basket: `<path d="M260 392h380l-42 244H302l-42-244Z" ${fill}/><path d="M344 392c0-82 212-82 212 0M310 468h280M324 548h252" ${common}/>` ,
    textile: `<path d="M270 318h352v258c-78 70-221 74-352 0V318Z" ${fill}/><path d="M270 386c126 59 246 57 352 0M270 468c126 59 246 57 352 0" ${common}/>` ,
    bottle: `<path d="M390 252h120v108l58 78v226H332V438l58-78V252Z" ${fill}/><path d="M386 212h128v50H386v-50Z" ${fill}/><path d="M370 482h160" ${common}/>` ,
    bakeware: `<rect x="250" y="354" width="400" height="240" rx="52" ${fill}/><path d="M282 424h336M318 520h264" ${common}/>` ,
    object: `<path d="M292 342h316v280H292V342Z" ${fill}/><path d="M344 290h212l52 52H292l52-52Z" ${fill}/><path d="M350 438h200" ${common}/>` ,
  };
  return shapes[kind] || shapes.object;
}

function imageSvg(product) {
  const [bg, accent, ink] = categoryPalette(product.category);
  const kind = productKind(product);
  const safeName = escapeXml(product.name);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900" role="img" aria-label="${safeName}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="${bg}"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="900" height="900" fill="url(#glow)"/>
  <circle cx="732" cy="156" r="64" fill="${accent}" fill-opacity="0.14"/>
  <circle cx="166" cy="730" r="92" fill="${accent}" fill-opacity="0.10"/>
  <g filter="url(#shadow)">
    <ellipse cx="450" cy="692" rx="230" ry="34" fill="#0f172a" fill-opacity="0.08"/>
    ${productShape(kind, accent, ink)}
  </g>
</svg>`;
}

function writeImage(product) {
  fs.mkdirSync(GENERATED_IMAGE_DIR, { recursive: true });
  const fileName = `${product.id}.svg`;
  const filePath = path.join(GENERATED_IMAGE_DIR, fileName);
  fs.writeFileSync(filePath, imageSvg(product), 'utf8');
  return `${GENERATED_IMAGE_URL_PREFIX}/${fileName}`;
}

function buildExistingNameCounts(products, proposals) {
  const counts = new Map();
  for (const product of products) {
    const name = normalizeSpace(proposals.get(product.id)?.name || product.name).toLowerCase();
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
}

function withDedupeName(product, proposal, nameCounts) {
  const key = proposal.name.toLowerCase();
  if ((nameCounts.get(key) || 0) <= 1) return proposal.name;
  const sku = proposal.specs.sku || parseSource(product.description, product.name).sku;
  return sku ? `${proposal.name} ${sku}` : `${proposal.name} ${product.id.slice(-4)}`;
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
  if (data?.user?.role !== 'admin') throw new Error('Logged in user is not an admin');
}

function productPayload(product, updates) {
  const image = updates.image || product.image;
  const images = updates.images || (Array.isArray(product.images) ? product.images : []);
  return {
    id: product.id,
    name: updates.name || product.name,
    category: product.category,
    price: Number(product.price || 0),
    cost_price: product.cost_price,
    stock: Number(product.stock || 0),
    image,
    images: images.length ? images : [image],
    description: updates.description || product.description || '',
    material: product.material || '',
    brand: product.brand || '',
    isPopular: product.isPopular === true || product.isPopular === 1 || product.isPopular === '1',
    isBundle: product.isBundle === true || product.isBundle === 1 || product.isBundle === '1',
    bundle_items: Array.isArray(product.bundle_items) ? product.bundle_items : [],
    bonusPoints: Number(product.bonusPoints ?? product.bonus_points ?? 0),
    reviewCount: Number(product.reviewCount ?? product.review_count ?? 0),
    rating: Number(product.rating || 5),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const products = await apiRequest(args.baseUrl, '/api/products');
  const targets = products
    .filter((product) => args.all || String(product.id || '').startsWith('stock-1806-'))
    .filter((product) => !product.isBundle)
    .slice(0, args.limit > 0 ? args.limit : undefined);

  const proposals = new Map();
  for (const product of targets) {
    const normalized = cleanProductName(product);
    proposals.set(product.id, normalized);
  }

  const nameCounts = buildExistingNameCounts(products, proposals);
  const updates = [];

  for (const product of targets) {
    const proposal = proposals.get(product.id);
    const image = args.images ? writeImage({ ...product, name: proposal.name }) : product.image;
    const name = args.normalize ? withDedupeName(product, proposal, nameCounts) : product.name;
    const description = args.normalize ? buildDescription(product, name, proposal.specs, proposal.originalName) : product.description;
    const images = image ? [image] : product.images;

    updates.push({ product, payload: productPayload(product, { name, description, image, images }), changed: product.name !== name || product.description !== description || product.image !== image });
  }

  const summary = {
    mode: args.apply ? 'apply' : 'dry-run',
    totalProducts: products.length,
    targets: targets.length,
    changed: updates.filter((update) => update.changed).length,
    imageFiles: args.images ? targets.length : 0,
    samples: updates.slice(0, 8).map(({ product, payload }) => ({
      id: product.id,
      before: product.name,
      after: payload.name,
      image: payload.image,
    })),
    errors: [],
  };

  if (args.apply) {
    if (!args.email || !args.password) throw new Error('Use --email/--password or HATNI_ADMIN_EMAIL/HATNI_ADMIN_PASSWORD for --apply');
    const jar = new Map();
    await login(args.baseUrl, args.email, args.password, jar);
    for (const update of updates) {
      try {
        await apiRequest(args.baseUrl, `/api/admin/products/${encodeURIComponent(update.product.id)}`, {
          method: 'PUT',
          body: JSON.stringify(update.payload),
        }, jar);
      } catch (error) {
        summary.errors.push({ id: update.product.id, name: update.product.name, error: error.message });
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
