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

function isFlagTrue(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function currentBundleFlag(product) {
  return isFlagTrue(product?.isBundle ?? product?.isbundle ?? product?.is_bundle);
}

function getBundleItems(product) {
  const raw = product?.bundle_items ?? product?.bundleItems;
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function shouldBeBundle(product) {
  const id = String(product?.id || '');
  const name = String(product?.name || '').trim();
  const category = String(product?.category || '');
  const bundleItems = getBundleItems(product);

  return id.startsWith('bundle-')
    || category === 'bundles'
    || (/^набір\b/i.test(name) && bundleItems.length > 0);
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

async function main() {
  const args = parseArgs(process.argv);
  const products = await apiRequest(args.baseUrl, '/api/products');
  const changes = products
    .filter(product => currentBundleFlag(product) !== shouldBeBundle(product))
    .map(product => ({
      id: product.id,
      name: product.name,
      from: currentBundleFlag(product),
      to: shouldBeBundle(product),
      category: product.category,
    }));

  if (args.apply && changes.length > 0) {
    if (!args.email || !args.password) throw new Error('Use --email/--password or HATNI_ADMIN_EMAIL/HATNI_ADMIN_PASSWORD for --apply');
    const jar = new Map();
    await login(args.baseUrl, args.email, args.password, jar);

    for (const change of changes) {
      const product = products.find(item => item.id === change.id);
      await apiRequest(args.baseUrl, `/api/admin/products/${encodeURIComponent(change.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...product,
          isBundle: change.to,
          bundle_items: getBundleItems(product),
        }),
      }, jar);
    }
  }

  console.log(JSON.stringify({
    mode: args.apply ? 'apply' : 'dry-run',
    changed: changes.length,
    changes,
  }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
