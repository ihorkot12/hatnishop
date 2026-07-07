import { spawn } from 'node:child_process';

const base = 'http://127.0.0.1:3000';
const stamp = Date.now();
const admin = {
  email: process.env.ADMIN_EMAIL || 'smoke-admin@hatni.test',
  password: process.env.ADMIN_PASSWORD || 'smoke-test-secret',
};
const user = { email: `client-${stamp}@hatni.test`, password: 'testpass123', name: 'Test Client' };

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const cookieHeader = (headers) => {
  const raw = headers.getSetCookie?.() || [];
  return raw.map(cookie => cookie.split(';')[0]).join('; ');
};

const request = async (path, options = {}, cookie = '') => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(`${options.method || 'GET'} ${path}: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, ok: res.ok, json, text, cookie: cookieHeader(res.headers) };
};

const waitForServer = async () => {
  for (let i = 0; i < 100; i++) {
    try {
      const health = await request('/api/health');
      if (health.ok) return health;
    } catch {}
    await sleep(500);
  }
  throw new Error('Server did not become ready');
};

const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
  cwd: process.cwd(),
  env: { ...process.env, JWT_SECRET: 'local-test-secret', ADMIN_EMAIL: admin.email, ADMIN_PASSWORD: admin.password },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
server.stdout.on('data', chunk => { logs += chunk.toString(); });
server.stderr.on('data', chunk => { logs += chunk.toString(); });

const results = [];
const check = (name, condition, detail = {}) => {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) {
    throw new Error(`${name} failed: ${JSON.stringify(detail)}`);
  }
};

try {
  const health = await waitForServer();
  check('health', health.ok, health.json);

  const robots = await request('/robots.txt');
  check('robots.txt', robots.ok && robots.text.includes('Sitemap:'), { status: robots.status, text: robots.text.slice(0, 80) });

  const sitemap = await request('/sitemap.xml');
  check('sitemap.xml', sitemap.ok && sitemap.text.includes('<urlset'), { status: sitemap.status, text: sitemap.text.slice(0, 120) });

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(admin),
  });
  check('admin login', adminLogin.ok, adminLogin.json);
  const adminCookie = adminLogin.cookie;

  const userRegister = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(user),
  });
  check('client register', userRegister.ok, userRegister.json);
  const userCookie = userRegister.cookie;
  const userId = userRegister.json.user.id;

  const grantBonuses = await request(`/api/admin/users/${userId}/bonuses`, {
    method: 'PUT',
    body: JSON.stringify({ bonuses: 1000 }),
  }, adminCookie);
  check('admin grant client bonuses', grantBonuses.ok, grantBonuses.json);

  const catId = `smoke-cat-${stamp}`;
  const productId = `smoke-product-${stamp}`;
  const category = await request('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify({
      id: catId,
      name: 'Smoke Decor',
      slug: catId,
      image: 'https://picsum.photos/seed/smoke-decor/800/600',
    }),
  }, adminCookie);
  check('admin create category', category.ok, category.json);

  const product = await request('/api/admin/products', {
    method: 'POST',
    body: JSON.stringify({
      id: productId,
      name: `Smoke Product ${stamp}`,
      category: catId,
      price: 777,
      cost_price: 320,
      stock: 12,
      image: 'https://picsum.photos/seed/smoke-product/800/800',
      description: 'Local smoke test product',
      material: 'Ceramic',
      brand: 'Hatni Smoke',
      isPopular: true,
    }),
  }, adminCookie);
  check('admin create product', product.ok, product.json);

  const forbiddenPrice = await request(`/api/admin/products/${productId}/price`, {
    method: 'POST',
    body: JSON.stringify({ newPrice: 700 }),
  }, userCookie);
  check('client cannot update admin price', forbiddenPrice.status === 403, { status: forbiddenPrice.status });

  const subscription = await request('/api/subscriptions/price-drop', {
    method: 'POST',
    body: JSON.stringify({ productId, currentPrice: 777 }),
  }, userCookie);
  check('client price subscription', subscription.ok, subscription.json);

  const priceUpdate = await request(`/api/admin/products/${productId}/price`, {
    method: 'POST',
    body: JSON.stringify({ newPrice: 699 }),
  }, adminCookie);
  check('admin price update', priceUpdate.ok, priceUpdate.json);

  const promo = await request('/api/admin/bonus-codes', {
    method: 'POST',
    body: JSON.stringify({
      id: `smoke-promo-${stamp}`,
      code: `SMOKE${stamp}`,
      discount_amount: 10,
      discount_type: 'percent',
      min_order_amount: 1,
      is_active: true,
      show_in_site: true,
      title: 'Smoke promo',
      description: 'Smoke promo',
      type: 'promo',
    }),
  }, adminCookie);
  check('admin create promo', promo.ok, promo.json);

  const promoValidate = await request(`/api/bonus-codes/validate/SMOKE${stamp}`);
  check('client validate promo', promoValidate.ok, promoValidate.json);

  const orderId = `SMOKE-${stamp}`;
  const order = await request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      id: orderId,
      userId,
      customer: {
        name: user.name,
        phone: '+380000000000',
        email: user.email,
        city: 'Kyiv',
        deliveryMethod: 'nova-poshta',
        warehouse: '1',
      },
      items: [{ id: productId, quantity: 1, price: 1 }],
      total: 1,
      bonusUsed: 999,
      promoCode: `SMOKE${stamp}`,
      finalTotal: 1,
      paymentMethod: 'mono',
      comment: 'local smoke',
    }),
  }, userCookie);
  check('client create order', order.ok, order.json);
  check('server recalculates order price and bonus cap', (
    order.json.total === 699 &&
    order.json.discount === 69 &&
    order.json.bonusLimit === 189 &&
    order.json.bonusUsed === 189 &&
    order.json.finalTotal === 441 &&
    order.json.cashbackPending === 22
  ), order.json);

  const afterCreateMe = await request('/api/auth/me', {}, userCookie);
  check('client bonuses deducted before payment', (
    afterCreateMe.ok &&
    afterCreateMe.json.user.bonuses === 811 &&
    Number(afterCreateMe.json.user.total_spent) === 0
  ), afterCreateMe.json);

  const adminOrders = await request('/api/admin/orders', {}, adminCookie);
  const createdOrder = adminOrders.json?.find?.((item) => item.id === orderId);
  check('admin sees mono payment method', createdOrder?.paymentMethod === 'mono', createdOrder);

  const status = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'completed' }),
  }, adminCookie);
  check('admin complete order', status.ok, status.json);

  const afterCompleteMe = await request('/api/auth/me', {}, userCookie);
  check('client cashback credited after completion', (
    afterCompleteMe.ok &&
    afterCompleteMe.json.user.bonuses === 833 &&
    Number(afterCompleteMe.json.user.total_spent) === 441
  ), afterCompleteMe.json);

  const cancelOrderId = `SMOKE-CANCEL-${stamp}`;
  const cancelOrder = await request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      id: cancelOrderId,
      userId,
      customer: {
        name: user.name,
        phone: '+380000000000',
        email: user.email,
        city: 'Kyiv',
        deliveryMethod: 'nova-poshta',
        warehouse: '1',
      },
      items: [{ id: productId, quantity: 1, price: 1 }],
      total: 1,
      bonusUsed: 100,
      finalTotal: 1,
      paymentMethod: 'liqpay',
      comment: 'local smoke cancel',
    }),
  }, userCookie);
  check('client create cancellable order', cancelOrder.ok && cancelOrder.json.bonusUsed === 100 && cancelOrder.json.finalTotal === 599, cancelOrder.json);

  const cancelStatus = await request(`/api/admin/orders/${cancelOrderId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'cancelled' }),
  }, adminCookie);
  check('admin cancel order', cancelStatus.ok, cancelStatus.json);

  const afterCancelMe = await request('/api/auth/me', {}, userCookie);
  check('client bonuses restored after cancellation', (
    afterCancelMe.ok &&
    afterCancelMe.json.user.bonuses === 833 &&
    Number(afterCancelMe.json.user.total_spent) === 441
  ), afterCancelMe.json);

  const review = await request('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({ productId, rating: 5, comment: 'Smoke review' }),
  }, userCookie);
  check('client review after completed order', review.ok, review.json);

  console.log(JSON.stringify({ ok: true, results }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message, results, logs: logs.slice(-3000) }, null, 2));
  process.exitCode = 1;
} finally {
  if (process.platform === 'win32') {
    try {
      const killer = spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.on('error', () => {});
    } catch {}
  } else {
    server.kill('SIGTERM');
  }
}
