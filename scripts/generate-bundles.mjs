const DEFAULT_BASE_URL = 'https://hatni.shop';

function parseArgs(argv) {
  const args = {
    apply: false,
    baseUrl: process.env.HATNI_BASE_URL || DEFAULT_BASE_URL,
    email: process.env.HATNI_ADMIN_EMAIL || '',
    password: process.env.HATNI_ADMIN_PASSWORD || '',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--email') args.email = argv[++i];
    else if (arg === '--password') args.password = argv[++i];
  }

  return args;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function isBundle(product) {
  const rawValue = product?.isBundle ?? product?.isbundle ?? product?.is_bundle;
  return rawValue === true || rawValue === 1 || rawValue === '1' || rawValue === 'true';
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

const bundlePlans = [
  {
    id: 'bundle-morning-coffee',
    name: 'Набір "Ранкова кава"',
    image: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=900&q=85',
    include: ['кухол', 'чаш', 'кава', 'лож', 'цукор', 'піднос', 'таріл'],
    categoryBoost: ['tableware', 'kitchen'],
  },
  {
    id: 'bundle-table-serving',
    name: 'Набір "Сервірування столу"',
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85',
    include: ['таріл', 'блюдо', 'салат', 'сервет', 'склян', 'келих'],
    categoryBoost: ['tableware', 'textile'],
  },
  {
    id: 'bundle-storage-order',
    name: 'Набір "Порядок на кухні"',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=85',
    include: ['ємн', 'контейнер', 'банка', 'сипуч', 'органайзер', 'кошик'],
    categoryBoost: ['organization', 'kitchen', 'tableware'],
  },
  {
    id: 'bundle-kitchen-start',
    name: 'Набір "Кухонний старт"',
    image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85',
    include: ['лопат', 'лож', 'сито', 'форма', 'друш', 'кухон', 'рушник', 'сервет'],
    categoryBoost: ['kitchen', 'textile', 'tableware'],
  },
];

function scoreProduct(product, plan) {
  const text = normalize(`${product.name} ${product.description} ${product.material} ${product.brand}`);
  let score = 0;
  for (const keyword of plan.include) {
    if (text.includes(keyword)) score += 22;
  }
  if (plan.categoryBoost.includes(product.category)) score += 12;
  if (Number(product.stock || 0) > 1) score += 5;
  if (Number(product.price || 0) > 0) score += Math.max(0, 8 - Math.floor(Number(product.price) / 300));
  return score;
}

function pickProducts(products, plan, usedIds) {
  const scored = products
    .filter(product => !usedIds.has(product.id))
    .map(product => ({ product, score: scoreProduct(product, plan) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(a.product.price || 0) - Number(b.product.price || 0));

  const selected = scored.slice(0, 4).map(item => item.product);
  if (selected.length >= 2) return selected;

  return products
    .filter(product => !usedIds.has(product.id) && plan.categoryBoost.includes(product.category))
    .slice(0, 4);
}

function buildBundlePayload(plan, items) {
  const total = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const price = Math.max(1, Math.round(total * 0.88));
  const stock = Math.max(1, Math.min(...items.map(item => Number(item.stock || 1))));
  const itemLines = items.map(item => `- ${item.name}`).join('\n');

  return {
    id: plan.id,
    name: plan.name,
    category: 'bundles',
    price,
    image: plan.image,
    images: [plan.image],
    description: [
      `${plan.name} — готовий комплект з реальних товарів каталогу Хатні Штучки.`,
      'Склад набору:',
      itemLines,
      `Ціна товарів окремо: ${total} грн. Ціна набору: ${price} грн.`,
    ].join('\n'),
    material: 'Змішаний набір',
    brand: 'Хатні Штучки',
    isPopular: true,
    isBundle: true,
    stock,
    rating: 5,
    reviewCount: 0,
    bonusPoints: Math.floor(price * 0.05),
    bundle_items: items.map(item => item.id),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const products = await apiRequest(args.baseUrl, '/api/products/catalog');
  const availableProducts = products.filter(product => !isBundle(product) && Number(product.stock || 0) > 0);
  const existingBundles = products.filter(isBundle);
  const usedIds = new Set();

  const bundles = [];
  for (const plan of bundlePlans) {
    const items = pickProducts(availableProducts, plan, usedIds).slice(0, 4);
    if (items.length < 2) continue;
    items.forEach(item => usedIds.add(item.id));
    bundles.push({ plan, items, payload: buildBundlePayload(plan, items) });
  }

  const summary = {
    mode: args.apply ? 'apply' : 'dry-run',
    existingBundles: existingBundles.length,
    generatedBundles: bundles.map(bundle => ({
      id: bundle.payload.id,
      name: bundle.payload.name,
      price: bundle.payload.price,
      stock: bundle.payload.stock,
      items: bundle.items.map(item => item.name),
    })),
    errors: [],
  };

  if (args.apply) {
    if (!args.email || !args.password) throw new Error('Use --email/--password or HATNI_ADMIN_EMAIL/HATNI_ADMIN_PASSWORD for --apply');
    const jar = new Map();
    await login(args.baseUrl, args.email, args.password, jar);
    for (const bundle of bundles) {
      try {
        const exists = products.some(product => product.id === bundle.payload.id);
        await apiRequest(args.baseUrl, exists ? `/api/admin/products/${encodeURIComponent(bundle.payload.id)}` : '/api/admin/products', {
          method: exists ? 'PUT' : 'POST',
          body: JSON.stringify(bundle.payload),
        }, jar);
      } catch (error) {
        summary.errors.push({ id: bundle.payload.id, error: error.message });
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
