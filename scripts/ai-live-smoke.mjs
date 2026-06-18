const baseUrl = process.env.HATNI_BASE_URL || 'https://hatni.shop';
const email = process.env.HATNI_ADMIN_EMAIL || '';
const password = process.env.HATNI_ADMIN_PASSWORD || '';

if (!email || !password) {
  console.error('Set HATNI_ADMIN_EMAIL and HATNI_ADMIN_PASSWORD');
  process.exit(1);
}

const jar = new Map();

function rememberCookies(response) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return;
  for (const item of setCookie.split(/,(?=[^;]+?=)/)) {
    const [pair] = item.split(';');
    const [name, ...valueParts] = pair.split('=');
    if (name && valueParts.length) jar.set(name.trim(), valueParts.join('=').trim());
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function request(pathName, body) {
  const response = await fetch(new URL(pathName, baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
    },
    body: JSON.stringify(body),
  });
  rememberCookies(response);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, data };
}

const login = await request('/api/auth/login', { email, password });
if (!login.ok) {
  console.log(JSON.stringify({ login }, null, 2));
  process.exit(1);
}

const description = await request('/api/admin/ai/description', {
  name: 'Test cup',
  category: 'tableware',
});

const bundleItems = await request('/api/admin/ai/bundle-items', {
  productName: 'Coffee set',
  productCategory: 'tableware',
  allProducts: [
    { id: 'p1', name: 'Cup', category: 'tableware' },
    { id: 'p2', name: 'Spoon', category: 'kitchen' },
    { id: 'p3', name: 'Napkin', category: 'textile' },
  ],
});

const directorReport = await request('/api/admin/ai/director-report', {
  products: [],
  orders: [],
  reviews: [],
  stats: { totalSales: 1000, ordersCount: 2 },
  siteSettings: {},
});

const image = await request('/api/admin/ai/product-image', {
  name: 'Test cup',
  category: 'tableware',
});

const gallery = await request('/api/admin/ai/product-gallery', {
  name: 'Test glass plate',
  category: 'tableware',
  count: 1,
});

const webImageSearch = await request('/api/admin/images/search-web', {
  name: 'PMTP/BMPL-1019-4 Блюдо скляне В НАБОРІ',
  category: 'tableware',
  limit: 1,
});

const imageValue = typeof image.data?.image === 'string' ? image.data.image : '';
const galleryImageValue = typeof gallery.data?.images?.[0] === 'string' ? gallery.data.images[0] : '';

console.log(JSON.stringify({
  description: {
    status: description.status,
    ok: description.ok,
    provider: description.data?.provider,
    model: description.data?.model,
    hasText: Boolean(description.data?.text),
    error: description.data?.error || null,
  },
  bundleItems: {
    status: bundleItems.status,
    ok: bundleItems.ok,
    provider: bundleItems.data?.provider,
    model: bundleItems.data?.model,
    count: Array.isArray(bundleItems.data?.items) ? bundleItems.data.items.length : null,
    error: bundleItems.data?.error || null,
  },
  directorReport: {
    status: directorReport.status,
    ok: directorReport.ok,
    provider: directorReport.data?.provider,
    model: directorReport.data?.model,
    hasReport: Boolean(directorReport.data?.report),
    error: directorReport.data?.error || null,
  },
  image: {
    status: image.status,
    ok: image.ok,
    provider: image.data?.provider,
    model: image.data?.model,
    hasImage: imageValue.startsWith('data:image/png;base64,'),
    bytesApprox: imageValue ? Math.round((imageValue.length - 'data:image/png;base64,'.length) * 0.75) : 0,
    error: image.data?.error || null,
    message: image.data?.message || null,
  },
  gallery: {
    status: gallery.status,
    ok: gallery.ok,
    provider: gallery.data?.provider,
    model: gallery.data?.model,
    count: Array.isArray(gallery.data?.images) ? gallery.data.images.length : null,
    hasImage: galleryImageValue.startsWith('data:image/png;base64,'),
    bytesApprox: galleryImageValue ? Math.round((galleryImageValue.length - 'data:image/png;base64,'.length) * 0.75) : 0,
    error: gallery.data?.error || null,
  },
  webImageSearch: {
    status: webImageSearch.status,
    ok: webImageSearch.ok,
    configured: webImageSearch.data?.configured,
    provider: webImageSearch.data?.provider,
    candidateCount: Array.isArray(webImageSearch.data?.candidates) ? webImageSearch.data.candidates.length : null,
    hasManualSearchUrl: typeof webImageSearch.data?.openSearchUrl === 'string' && webImageSearch.data.openSearchUrl.includes('google.com/search'),
    error: webImageSearch.data?.error || null,
  },
}, null, 2));
