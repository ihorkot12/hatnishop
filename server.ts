import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./db/index.js";

import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = process.env.VERCEL
  ? path.join("/tmp", "db_cache.json")
  : path.join(__dirname, "db_cache.json");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && (process.env.NODE_ENV === "production" || process.env.VERCEL)) {
  throw new Error("JWT_SECRET is required in production");
}
const jwtSecret = JWT_SECRET || "dev-secret-change-me";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000
};

const clearCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
  sameSite: "lax" as const
};

const requireAdmin = (req: any, res: any) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
};

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

const cleanJSON = (text: string) => text.replace(/```json\n?|```/g, "").trim();

export const app = express();
const PORT = 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
const SITE_URL = (process.env.SITE_URL || process.env.PUBLIC_SITE_URL || "https://hatni.shop").replace(/\/+$/, "");
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 8;
const ORDER_STATUSES = new Set(["pending", "processing", "paid", "shipped", "completed", "cancelled"]);
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "очікує обробки",
  processing: "в обробці",
  paid: "оплачено",
  shipped: "відправлено",
  completed: "виконано",
  cancelled: "скасовано"
};
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

// Helper to handle async errors
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const xmlEscape = (value: string) =>
  value.replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  }[char] || char));

const toFiniteNumber = (value: any, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeString = (value: any, maxLength = 500) =>
  String(value || "").trim().slice(0, maxLength);

const getOptionalUser = (req: any) => {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret) as any;
  } catch {
    return null;
  }
};

const getClientKey = (req: any, email = "") => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || "unknown";
  return `${ip}:${email.toLowerCase()}`;
};

const canAttemptLogin = (req: any, email: string) => {
  const key = getClientKey(req, email);
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (!attempt || now - attempt.firstAttempt > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttempts.set(key, { count: 0, firstAttempt: now });
    return true;
  }
  return attempt.count < LOGIN_ATTEMPT_LIMIT;
};

const recordLoginFailure = (req: any, email: string) => {
  const key = getClientKey(req, email);
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (!attempt || now - attempt.firstAttempt > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return;
  }
  loginAttempts.set(key, { count: attempt.count + 1, firstAttempt: attempt.firstAttempt });
};

const clearLoginFailures = (req: any, email: string) => {
  loginAttempts.delete(getClientKey(req, email));
};

const notifyUser = async (userId: string | undefined, title: string, message: string, type: string) => {
  if (!userId) return;
  try {
    await db.createNotification({
      id: Math.random().toString(36).slice(2, 11),
      user_id: userId,
      title,
      message,
      type
    });
  } catch (error: any) {
    console.warn("Notification skipped:", error?.message || error);
  }
};

const notifyAdmins = async (title: string, message: string, type: string) => {
  try {
    const users = await db.getAllUsers();
    const admins = users.filter((user) => user.role === "admin");
    await Promise.all(admins.map((admin) => notifyUser(admin.id, title, message, type)));
  } catch (error: any) {
    console.warn("Admin notification skipped:", error?.message || error);
  }
};

const sendTelegramOrderNotification = async (order: any, items: any[]) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const text = [
      `Нове замовлення ${order.id}`,
      `Клієнт: ${order.customer_name}`,
      `Телефон: ${order.customer_phone}`,
      `Сума: ${order.final_total} грн`,
      `Товарів: ${items.reduce((sum, item) => sum + item.quantity, 0)}`
    ].join("\n");

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: controller.signal
    });
  } catch (error: any) {
    console.warn("Telegram order notification skipped:", error?.message || error);
  } finally {
    clearTimeout(timeout);
  }
};

// --- Caching Logic ---
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let lastDbErrorTimestamp = 0;
const DB_RETRY_AFTER = 5 * 60 * 1000; // 5 minutes
let isDegradedLogEmitted = false;

function isDbInDegradedMode() {
  if (lastDbErrorTimestamp === 0) return false;
  const timeSinceError = Date.now() - lastDbErrorTimestamp;
  const inDegraded = timeSinceError < DB_RETRY_AFTER;
  if (!inDegraded && isDegradedLogEmitted) {
    isDegradedLogEmitted = false;
    console.log("Database degraded mode expired. Retrying connection...");
  }
  return inDegraded;
}

function recordDbError(error: any) {
  const message = error?.message || "";
  const isQuota = message.includes("402") || message.toLowerCase().includes("quota");
  
  if (isQuota) {
    if (!isDegradedLogEmitted) {
      lastDbErrorTimestamp = Date.now();
      isDegradedLogEmitted = true;
      console.warn(`Database quota exceeded. Entering degraded mode for 5 minutes. Next retry at: ${new Date(lastDbErrorTimestamp + DB_RETRY_AFTER).toISOString()}`);
      return { isQuota: true, isFirst: true };
    }
    return { isQuota: true, isFirst: false };
  } else {
    // For non-quota errors, we don't necessarily want to enter degraded mode for 5 mins, 
    // but we should still log them.
    console.error("Database Error:", message);
    return { isQuota: false, isFirst: true };
  }
}

let productsCache: { data: any, timestamp: number } | null = null;
let categoriesCache: { data: any, timestamp: number } | null = null;
let productsSummaryCache: { data: any, timestamp: number } | null = null;
let siteSettingsCache: { data: any, timestamp: number } | null = null;

// Load persistent cache from file on startup
try {
  if (fs.existsSync(CACHE_FILE)) {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    productsCache = data.productsCache || null;
    categoriesCache = data.categoriesCache || null;
    productsSummaryCache = data.productsSummaryCache || null;
    siteSettingsCache = data.siteSettingsCache || null;
    console.log("Persistent cache loaded from file");
  }
} catch (e) {
  console.error("Failed to load persistent cache:", e);
}

function savePersistentCache() {
  try {
    const data = {
      productsCache,
      categoriesCache,
      productsSummaryCache,
      siteSettingsCache,
      lastSaved: Date.now()
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to save persistent cache:", e);
  }
}

const DEFAULT_SITE_SETTINGS = {
  id: 'default',
  free_delivery_min: 1500,
  return_days: 14,
  cashback_percent: 5,
  hero_title: 'Естетичний посуд та декор для дому',
  hero_subtitle: 'Інтернет-магазин "Хатні Штучки" — ваш провідник у світ затишку. Купуйте кераміку, текстиль та аксесуари, які перетворюють оселю на місце сили.',
  hero_featured_product_id: 'p1',
  hero_badge: 'Бестселер сезону',
  bestsellers_badge: 'Наші бестселери',
  bestsellers_title: 'Популярні товари для вашого затишку',
  bestsellers_subtitle: 'Обирайте найкращий посуд та декор, який став фаворитом наших покупців. Кожна річ у каталозі "Хатні Штучки" — це поєднання естетики та функціональності.'
};

Object.assign(DEFAULT_SITE_SETTINGS, {
  hero_title: 'Естетичний посуд та декор для дому',
  hero_subtitle: 'Інтернет-магазин "Хатні Штучки" - добірка кераміки, текстилю та домашніх аксесуарів, які додають оселі тепла.',
  hero_badge: 'Бестселер сезону',
  bestsellers_badge: 'Наші бестселери',
  bestsellers_title: 'Популярні товари для вашого затишку',
  bestsellers_subtitle: 'Обирайте посуд і декор, який покупці додають у свої домівки найчастіше.'
});

const FALLBACK_CATEGORIES = [
  { id: 'cat-1', name: 'Посуд', slug: 'posud', image: 'https://picsum.photos/seed/dishes/800/600' },
  { id: 'cat-2', name: 'Декор', slug: 'dekor', image: 'https://picsum.photos/seed/decor/800/600' },
  { id: 'cat-3', name: 'Текстиль', slug: 'tekstyl', image: 'https://picsum.photos/seed/textile/800/600' }
];

const FALLBACK_PRODUCTS = [
  {
    id: 'p1',
    name: 'Керамічна чашка "Затишок"',
    category: 'posud',
    price: 450,
    image: 'https://picsum.photos/seed/cup/800/800',
    images: ['https://picsum.photos/seed/cup/800/800'],
    description: 'Ручна робота, унікальний дизайн.',
    material: 'Кераміка',
    brand: 'Хатні Штучки',
    isPopular: true,
    stock: 10,
    rating: 5,
    review_count: 12
  }
];

const clearCache = () => {
  productsCache = null;
  categoriesCache = null;
  productsSummaryCache = null;
  siteSettingsCache = null;
  if (fs.existsSync(CACHE_FILE)) {
    try {
      fs.unlinkSync(CACHE_FILE);
    } catch (e) {}
  }
  console.log("Cache cleared");
};

// --- Database Initialization & Seeding ---
let dbInitialized = false;
let isInitializing = false;

async function ensureDb() {
  if (dbInitialized || isInitializing) return;
  isInitializing = true;

  try {
    console.log("Initializing database...");
    // Initialize DB Schema
    await db.init();

    // Seed Admins
    const admins = [
      { email: "admin@homecraft.com", pass: "admin123", name: "Адміністратор", id: "admin-1" },
      { email: "ihorkot12@gmail.com", pass: "4756500", name: "Ihor Kot", id: "admin-2" }
    ];

    for (const admin of admins) {
      try {
        const exists = await db.getUserByEmail(admin.email);
        if (!exists) {
          const hashed = await bcrypt.hash(admin.pass, 10);
          await db.createUser({
            id: admin.id,
            email: admin.email,
            password: hashed,
            name: admin.name,
            role: "admin"
          });
        }
      } catch (err: any) {
        const { isQuota, isFirst } = recordDbError(err);
        if (isFirst && !isQuota) {
          console.error(`Error seeding admin ${admin.email}:`, err.message);
        }
      }
    }

    dbInitialized = true;
    console.log("Database initialized successfully.");
  } catch (err: any) {
    const { isQuota, isFirst } = recordDbError(err);
    if (isFirst && !isQuota) {
      console.error("Database initialization failed (likely quota exceeded):", err.message);
    }
    // Do not throw, allow server to start with fallbacks
  } finally {
    isInitializing = false;
  }
}

app.disable("x-powered-by");

app.use((req, res, next) => {
  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    IS_PRODUCTION ? "connect-src 'self' https://*.vercel-insights.com" : "connect-src 'self' http: https: ws:",
    "form-action 'self'",
    IS_PRODUCTION ? "upgrade-insecure-requests" : ""
  ].filter(Boolean);

  res.setHeader("Content-Security-Policy", cspDirectives.join("; "));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

app.use(express.json({ limit: '15mb', strict: true }));
app.use(express.urlencoded({ limit: '15mb', extended: true, parameterLimit: 200 }));
app.use(cookieParser());

app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return res.status(403).json({ error: "Cross-site request blocked" });
  }

  const origin = req.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const requestHost = req.get("host");
      if (requestHost && originHost !== requestHost) {
        return res.status(403).json({ error: "Invalid request origin" });
      }
    } catch {
      return res.status(403).json({ error: "Invalid request origin" });
    }
  }

  next();
});

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Manual DB Init Trigger (for debugging)
app.get("/api/admin/db-init", authenticate, asyncHandler(async (req: any, res: any) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
  dbInitialized = false; // Force re-init
  await ensureDb();
  res.json({ success: true, message: "Database initialization triggered" });
}));

// --- API Routes ---
// Health Check
app.get("/api/health", asyncHandler(async (req, res) => {
  if (!dbInitialized && !isDbInDegradedMode()) {
    await ensureDb();
  }
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    dbInitialized,
    degraded: isDbInDegradedMode(),
    env: process.env.NODE_ENV || "development"
  });
}));

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send([
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /login",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    ""
  ].join("\n"));
});

app.get("/sitemap.xml", asyncHandler(async (req, res) => {
  let products: any[] = [];
  try {
    if (!isDbInDegradedMode()) {
      products = await db.getProductsSummary();
    }
  } catch (error: any) {
    const { isQuota, isFirst } = recordDbError(error);
    if (isFirst && !isQuota) {
      console.warn("Error building sitemap from database:", error.message);
    }
  }

  if (!products.length) {
    products = productsSummaryCache?.data || FALLBACK_PRODUCTS;
  }

  const now = new Date().toISOString();
  const staticUrls = ["/", "/catalog", "/about", "/faq"];
  const productUrls = products
    .filter((product) => product?.id)
    .map((product) => `/product/${encodeURIComponent(product.id)}`);
  const urls = [...staticUrls, ...productUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((url) => [
      "  <url>",
      `    <loc>${xmlEscape(`${SITE_URL}${url}`)}</loc>`,
      `    <lastmod>${now}</lastmod>`,
      url.startsWith("/product/") ? "    <changefreq>weekly</changefreq>" : "    <changefreq>daily</changefreq>",
      url === "/" ? "    <priority>1.0</priority>" : "    <priority>0.8</priority>",
      "  </url>"
    ].join("\n")).join("\n") +
    "\n</urlset>\n";

  res.type("application/xml").send(xml);
}));

// Auth Routes
app.post("/api/auth/register", asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const { email, password, name } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = Math.random().toString(36).substr(2, 9);
      await db.createUser({ id, email, password: hashedPassword, name });
      const token = jwt.sign({ id, email, name, role: 'user' }, jwtSecret);
      res.cookie("token", token, cookieOptions);
      res.json({ user: { id, email, name, bonuses: 0, total_spent: 0, role: 'user', avatar: null } });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.error("Registration error:", err.message);
      }
      res.status(isQuota ? 503 : 400).json({ 
        error: isQuota ? "Сервіс тимчасово недоступний" : "Email already exists" 
      });
    }
  }));

  app.post("/api/auth/login", asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const email = normalizeString(req.body?.email, 254).toLowerCase();
      const password = normalizeString(req.body?.password, 200);
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      if (!canAttemptLogin(req, email)) {
        return res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
      }
      console.log(`Login attempt for: ${email}`);
      
      const user = await db.getUserByEmail(email);
      
      if (!user) {
        console.log(`User not found: ${email}`);
        recordLoginFailure(req, email);
        return res.status(401).json({ error: "Користувача не знайдено" });
      }

      const isMatch = await bcrypt.compare(password, user.password || "");
      if (isMatch) {
        clearLoginFailures(req, email);
        console.log(`Login successful for: ${email}`);
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, jwtSecret);
        res.cookie("token", token, cookieOptions);
        res.json({ 
          user: { 
            id: user.id, 
            email: user.email, 
            name: user.name, 
            bonuses: user.bonuses, 
            total_spent: user.total_spent,
            role: user.role,
            avatar: user.avatar
          } 
        });
      } else {
        console.log(`Invalid password for: ${email}`);
        recordLoginFailure(req, email);
        res.status(401).json({ error: "Невірний пароль" });
      }
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.error("Login error:", err.message);
      }
      res.status(isQuota ? 503 : 401).json({ 
        error: isQuota ? "Сервіс тимчасово недоступний" : "Помилка авторизації" 
      });
    }
  }));

  app.get("/api/auth/me", asyncHandler(async (req: any, res: any) => {
    const token = req.cookies.token;
    if (!token) return res.json({ user: null });
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret) as any;
    } catch (jwtErr) {
      return res.json({ user: null });
    }

    try {
      // Check circuit breaker
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const user = await db.getUserById(decoded.id);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      } else {
        res.json({ user: null });
      }
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      
      // Return basic info from JWT so the user stays logged in during quota issues
      res.json({ 
        user: { 
          id: decoded.id, 
          email: decoded.email, 
          name: decoded.name, 
          role: decoded.role,
          bonuses: 0,
          total_spent: 0,
          isDegraded: true
        } 
      });
    }
  }));

  app.post("/api/auth/logout", asyncHandler(async (req: any, res: any) => {
    res.clearCookie("token", clearCookieOptions);
    res.json({ success: true });
  }));

  // Review Routes
  app.get("/api/reviews/:productId", asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const reviews = await db.getReviews(req.params.productId);
      res.json(reviews);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching reviews:", error.message);
      }
      res.json([]);
    }
  }));

  app.post("/api/reviews", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const { productId, rating, comment } = req.body;
      
      // Check if user has purchased the product and order is completed
      const orders = await (db as any).getUserOrders(req.user.id);
      const hasPurchased = orders.some((order: any) => 
        (order.status === 'completed' || order.status === 'shipped') && 
        // We need to check if the product is in the order items
        // For now, let's assume if they have any completed order, they can review
        // Ideally we should check specific product_id in order_items
        true 
      );

      // More accurate check would involve fetching order items
      // But for simplicity and based on user request "after order delivered"
      const completedOrders = orders.filter((o: any) => o.status === 'completed' || o.status === 'shipped');
      if (completedOrders.length === 0) {
        return res.status(403).json({ error: "Ви можете залишити відгук тільки після отримання замовлення" });
      }

      const id = Math.random().toString(36).substr(2, 9);
      await db.createReview({
        id,
        product_id: productId,
        user_id: req.user.id,
        user_name: req.user.name,
        rating,
        comment,
        is_approved: 0 // Default to unapproved
      });
      res.json({ success: true, message: "Відгук надіслано на модерацію" });
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error creating review:", error.message);
      }
      res.status(isQuota ? 503 : 400).json({ error: isQuota ? "Сервіс тимчасово недоступний через обмеження бази даних" : "Помилка при створенні відгуку" });
    }
  }));

  app.post("/api/products/:id/ai-description", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { aiDescription } = req.body;
    await db.updateProductAiDescription(req.params.id, aiDescription);
    res.json({ success: true });
  }));

  app.post("/api/admin/ai/description", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { name, category } = req.body;
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [{ text: `Write a short warm Ukrainian product description for "${name}" in category "${category || "home"}". Use 2-3 sentences, no quotes, no intro.` }]
      }]
    });
    res.json({ text: response.text || "" });
  }));

  app.post("/api/admin/ai/styling-tip", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { name, category } = req.body;
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [{ text: `Write a concise Ukrainian styling tip for using "${name}" from category "${category || "home"}" in a cozy home interior. Max 2 sentences.` }]
      }]
    });
    res.json({ text: response.text || "" });
  }));

  app.post("/api/admin/ai/product-image", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { name, category, base64Image } = req.body;
    const prompt = `Professional ecommerce product photo for "${name}" in category "${category || "home"}". Cozy premium minimal home aesthetic, soft natural light, neutral background, realistic, no text in image.`;
    const parts: any[] = [{ text: prompt }];

    if (base64Image) {
      const match = String(base64Image).match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }

    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData);
    if (!imagePart?.inlineData?.data) {
      return res.status(502).json({ error: "AI image generation returned no image" });
    }
    res.json({ image: `data:image/png;base64,${imagePart.inlineData.data}` });
  }));

  app.post("/api/admin/ai/bundle-items", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { productName, productCategory, allProducts } = req.body;
    const products = Array.isArray(allProducts) ? allProducts.slice(0, 80) : [];
    const productsList = products.map((p: any) => `- ${p.name} (ID: ${p.id}, category: ${p.category})`).join("\n");
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [{ text: `Pick 2-4 complementary products for "${productName}" (${productCategory}). Return only JSON array of product IDs from this list:\n${productsList}` }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });

    try {
      const items = JSON.parse(cleanJSON(response.text || "[]"));
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch {
      res.json({ items: [] });
    }
  }));

  app.post("/api/admin/ai/director-report", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { products = [], orders = [], stats = {}, siteSettings = {}, reviews = [] } = req.body;
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this Hatni Shtuchky ecommerce data and write a specific Ukrainian markdown director report with quick wins, UX/CRO advice, product/pricing advice, and next actions.\n\nPRODUCTS:\n${JSON.stringify(products.slice(0, 50), null, 2)}\n\nORDERS:\n${JSON.stringify(orders.slice(0, 30), null, 2)}\n\nREVIEWS:\n${JSON.stringify(reviews.slice(0, 20), null, 2)}\n\nSTATS:\n${JSON.stringify(stats, null, 2)}\n\nSITE SETTINGS:\n${JSON.stringify(siteSettings, null, 2)}`,
      config: {
        systemInstruction: "You are a senior ecommerce, UX, CRO and merchandising advisor. Be practical, concrete, and write in Ukrainian.",
        temperature: 0.7
      }
    });
    res.json({ report: response.text || "" });
  }));

  // Price Subscriptions
  app.post("/api/subscriptions/price-drop", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const { productId, currentPrice } = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      await db.addPriceSubscription({
        id,
        user_id: req.user.id,
        product_id: productId,
        initial_price: currentPrice
      });
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error adding price subscription:", err.message);
      }
      res.status(isQuota ? 503 : 400).json({ error: isQuota ? "Сервіс тимчасово недоступний" : "Already subscribed or database unavailable" });
    }
  }));

  app.get("/api/subscriptions/price-drop", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const subs = await db.getPriceSubscriptions(req.user.id);
      res.json(subs);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching subscriptions:", error.message);
      }
      res.json([]);
    }
  }));

  app.delete("/api/subscriptions/price-drop/:productId", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      await db.removePriceSubscription(req.user.id, req.params.productId);
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error removing price subscription:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  // Notifications
  app.get("/api/notifications", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const notifications = await db.getNotifications(req.user.id);
      res.json(notifications);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching notifications:", error.message);
      }
      res.json([]);
    }
  }));

  app.post("/api/notifications/:id/read", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      await db.markNotificationRead(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error marking notification as read:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  // Admin: Update Price (triggers notifications)
  app.post("/api/admin/products/:id/price", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const { newPrice } = req.body;
      const product = await db.getProductById(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });

      const oldPrice = product.price;
      await db.updateProductPrice(req.params.id, newPrice);

      if (newPrice < oldPrice) {
        const subscriptions = await db.getSubscriptionsByProductId(req.params.id);
        for (const sub of subscriptions) {
          await db.createNotification({
            id: Math.random().toString(36).substr(2, 9),
            user_id: sub.user_id,
            title: "Зниження ціни! 📉",
            message: `Ціна на "${product.name}" знизилася з ${oldPrice} грн до ${newPrice} грн!`,
            type: "price_drop"
          });
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error updating product price:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  // API Routes
  app.get("/api/products/catalog", asyncHandler(async (req: any, res: any) => {
    const now = Date.now();
    if (productsSummaryCache && (now - productsSummaryCache.timestamp < CACHE_TTL)) {
      return res.json(productsSummaryCache.data);
    }
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const products = await db.getProductsSummary();
      const formattedProducts = products.map(p => ({
        ...p,
        images: p.images ? (typeof p.images === 'string' ? JSON.parse(p.images) : p.images) : [],
        bundle_items: p.bundle_items ? (typeof p.bundle_items === 'string' ? JSON.parse(p.bundle_items) : p.bundle_items) : []
      }));
      productsSummaryCache = { data: formattedProducts, timestamp: now };
      savePersistentCache();
      res.json(formattedProducts);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      if (isFirst && !isQuota) {
        console.warn("Error fetching products summary, using cache or fallback:", errMsg);
      }
      if (productsSummaryCache) return res.json(productsSummaryCache.data);
      res.json(FALLBACK_PRODUCTS.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        image: p.image,
        material: p.material,
        brand: p.brand,
        isPopular: p.isPopular,
        stock: p.stock,
        rating: p.rating,
        review_count: p.review_count
      })));
    }
  }));

  app.get("/api/products", asyncHandler(async (req: any, res: any) => {
    const now = Date.now();
    if (productsCache && (now - productsCache.timestamp < CACHE_TTL)) {
      return res.json(productsCache.data);
    }
    try {
      const products = await db.getProducts();
      const formattedProducts = products.map(p => ({
        ...p,
        images: p.images ? (typeof p.images === 'string' ? JSON.parse(p.images) : p.images) : [],
        bundle_items: p.bundle_items ? (typeof p.bundle_items === 'string' ? JSON.parse(p.bundle_items) : p.bundle_items) : []
      }));
      productsCache = { data: formattedProducts, timestamp: now };
      savePersistentCache();
      res.json(formattedProducts);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      if (isFirst && !isQuota) {
        console.warn("Error fetching products, using cache or fallback:", errMsg);
      }
      if (productsCache) return res.json(productsCache.data);
      res.json(FALLBACK_PRODUCTS);
    }
  }));

  app.get("/api/products/:id", asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const product = await db.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      const formatted = {
        ...product,
        images: product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : [],
        bundle_items: product.bundle_items ? (typeof product.bundle_items === 'string' ? JSON.parse(product.bundle_items) : product.bundle_items) : []
      };
      res.json(formatted);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching product by id, using fallback if available:", error.message);
      }
      // If it's the fallback product ID, return it
      const fallback = FALLBACK_PRODUCTS.find(p => p.id === req.params.id);
      if (fallback) return res.json(fallback);
      res.status(503).json({ error: "Service temporarily unavailable due to database quota" });
    }
  }));

  app.post("/api/admin/products", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const product = { ...req.body };

      // Check for duplicates by name
      const existingProducts = await db.getProducts();
      const isDuplicate = existingProducts.some(p => p.name.toLowerCase() === product.name.toLowerCase());
      if (isDuplicate) {
        return res.status(400).json({ error: `Товар з назвою "${product.name}" вже існує в базі даних` });
      }

      if (product.images && Array.isArray(product.images)) {
        product.images = JSON.stringify(product.images);
      }
      if (product.bundle_items && Array.isArray(product.bundle_items)) {
        product.bundle_items = JSON.stringify(product.bundle_items);
      }
      if (!product.id) product.id = Math.random().toString(36).substr(2, 9);
      await db.createProduct(product);
      clearCache();
      res.json({ success: true, product });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error creating product:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  app.put("/api/admin/products/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const product = { ...req.body };
      if (product.images && Array.isArray(product.images)) {
        product.images = JSON.stringify(product.images);
      }
      if (product.bundle_items && Array.isArray(product.bundle_items)) {
        product.bundle_items = JSON.stringify(product.bundle_items);
      }
      await db.updateProduct(req.params.id, product);
      clearCache();
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error updating product:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  app.delete("/api/admin/products/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      await db.deleteProduct(req.params.id);
      clearCache();
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error deleting product:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  app.get("/api/admin/orders", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const orders = await db.getAllOrders();
      res.json(orders);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin orders:", error.message);
      }
      res.json([]);
    }
  }));

  app.post("/api/admin/orders/:id/status", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { trackingNumber } = req.body;
    const status = normalizeString(req.body?.status, 40);
    if (!ORDER_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid order status" });
    }
    const orderId = req.params.id;
    
    // Get order details to check if bonuses should be credited
    const orders = await db.getAllOrders();
    const order = orders.find(o => o.id === orderId);
    
    if (!order) return res.status(404).json({ error: "Order not found" });

    await db.updateOrderStatus(orderId, status);
    
    // Update tracking number if provided
    if (trackingNumber && (db as any).updateOrderTrackingNumber) {
      await (db as any).updateOrderTrackingNumber(orderId, trackingNumber);
    }

    // Credit cashback once, after the order is paid or completed.
    if ((status === 'paid' || status === 'completed') && !order.bonusesCredited && order.user_id) {
      const user = await db.getUserById(order.user_id);
      const totalSpent = toFiniteNumber(user?.total_spent);
      let bonusRate = 0.05;
      if (totalSpent >= 15000) bonusRate = 0.10;
      else if (totalSpent >= 5000) bonusRate = 0.07;
      const earnedBonuses = Math.floor(order.finalTotal * bonusRate);
      
      if (user) {
        await db.updateUserBonuses(order.user_id, (user.bonuses || 0) + earnedBonuses);
        if ((db as any).markOrderBonusesCredited) {
          await (db as any).markOrderBonusesCredited(orderId);
        }
        await notifyUser(
          order.user_id,
          "Бонуси нараховано",
          `За замовлення ${orderId} нараховано ${earnedBonuses} бонусів.`,
          "bonus_credit"
        );
      }
    }

    const label = ORDER_STATUS_LABELS[status] || status;
    await notifyUser(
      order.user_id,
      "Статус замовлення оновлено",
      `Замовлення ${orderId}: ${label}${trackingNumber ? `. ТТН: ${trackingNumber}` : ""}.`,
      "order_status"
    );
    await notifyAdmins(
      "Статус замовлення оновлено",
      `${req.user.email || "Адмін"} змінив ${orderId}: ${label}.`,
      "order_status"
    );

    res.json({ success: true });
  }));

  app.get("/api/categories", asyncHandler(async (req: any, res: any) => {
    const now = Date.now();
    if (categoriesCache && (now - categoriesCache.timestamp < CACHE_TTL)) {
      return res.json(categoriesCache.data);
    }
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const categories = await db.getCategories();
      categoriesCache = { data: categories, timestamp: now };
      savePersistentCache();
      res.json(categories);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      if (isFirst && !isQuota) {
        console.warn("Error fetching categories, using cache or fallback:", errMsg);
      }
      if (categoriesCache) return res.json(categoriesCache.data);
      res.json(FALLBACK_CATEGORIES);
    }
  }));

  app.post("/api/admin/categories", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const category = req.body;
    if (!category.id) category.id = Math.random().toString(36).substr(2, 9);
    await db.createCategory(category);
    clearCache();
    res.json({ success: true, category });
  }));

  app.put("/api/admin/categories/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    await db.updateCategory(req.params.id, req.body);
    clearCache();
    res.json({ success: true });
  }));

  app.delete("/api/admin/categories/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    await db.deleteCategory(req.params.id);
    clearCache();
    res.json({ success: true });
  }));

// Admin & Order Routes
app.get("/api/admin/users", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const users = await db.getAllUsers();
      res.json(users);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin users:", error.message);
      }
      res.json([]);
    }
  }));

  app.put("/api/admin/users/:id/role", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { role } = req.body;
    await db.updateUserRole(req.params.id, role);
    res.json({ success: true });
  }));

  app.get("/api/admin/stats", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const stats = await db.getAdminStats();
      res.json(stats);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin stats:", error.message);
      }
      res.json({
        totalRevenue: 0,
        orderCount: 0,
        userCount: 0,
        productCount: 0,
        recentOrders: [],
        topProducts: [],
        revenueByDay: []
      });
    }
  }));

  app.put("/api/admin/users/:id/bonuses", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { bonuses } = req.body;
    await db.updateUserBonuses(req.params.id, bonuses);
    res.json({ success: true });
  }));

  app.post("/api/admin/stats/reset", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    await db.resetStats();
    res.json({ success: true });
  }));

  app.post("/api/admin/db/reset-degraded", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    lastDbErrorTimestamp = 0;
    isDegradedLogEmitted = false;
    console.log("Database degraded mode manually reset by admin");
    res.json({ success: true, message: "Database circuit breaker reset. Retrying connection on next request." });
  }));

  app.get("/api/admin/db/status", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    res.json({ 
      isDegraded: isDbInDegradedMode(),
      lastError: lastDbErrorTimestamp ? new Date(lastDbErrorTimestamp).toISOString() : null,
      retryAt: lastDbErrorTimestamp ? new Date(lastDbErrorTimestamp + DB_RETRY_AFTER).toISOString() : null
    });
  }));

  app.get("/api/site-settings", asyncHandler(async (req: any, res: any) => {
    const now = Date.now();
    if (siteSettingsCache && (now - siteSettingsCache.timestamp < CACHE_TTL)) {
      return res.json(siteSettingsCache.data);
    }
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const settings = await db.getSiteSettings();
      siteSettingsCache = { data: settings || DEFAULT_SITE_SETTINGS, timestamp: now };
      savePersistentCache();
      res.json(settings || DEFAULT_SITE_SETTINGS);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      if (isFirst && !isQuota) {
        console.warn("Error fetching site settings, using cache or fallback:", errMsg);
      }
      if (siteSettingsCache) return res.json(siteSettingsCache.data);
      res.json(DEFAULT_SITE_SETTINGS);
    }
  }));

  app.put("/api/admin/site-settings", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    await db.updateSiteSettings(req.body);
    res.json({ success: true });
  }));

  app.get("/api/bonus-codes", asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const codes = await db.getBonusCodes();
      res.json(codes || []);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching bonus codes, returning empty array:", error.message);
      }
      res.json([]);
    }
  }));

  app.get("/api/user/orders", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const orders = await db.getAllOrders();
      const userOrders = orders.filter(o => o.user_id === req.user.id);
      res.json(userOrders);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching user orders, returning empty array:", error.message);
      }
      res.json([]);
    }
  }));

  app.post("/api/orders", asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const { customer = {}, items = [] } = req.body || {};
      const orderId = normalizeString(req.body?.id, 64) || `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const authUser = getOptionalUser(req);
      const customerName = normalizeString(customer.name, 120);
      const customerPhone = normalizeString(customer.phone, 40);
      const customerEmail = normalizeString(customer.email, 160);
      const customerCity = normalizeString(customer.city, 120);
      const warehouse = normalizeString(customer.warehouse, 180);
      const deliveryMethod = normalizeString(customer.deliveryMethod, 60) || "nova-poshta";
      const comment = normalizeString(req.body?.comment, 700);
      const paymentMethod = ["cash", "card", "bank"].includes(req.body?.paymentMethod)
        ? req.body.paymentMethod
        : "cash";

      if (!customerName || !customerPhone || !customerCity) {
        return res.status(400).json({ error: "Заповніть ім'я, телефон і місто доставки" });
      }
      if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        return res.status(400).json({ error: "Некоректний email" });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Кошик порожній" });
      }

      const orderItems: any[] = [];
      let serverTotal = 0;
      for (const rawItem of items) {
        const productId = normalizeString(rawItem?.id, 120);
        const quantity = Math.floor(toFiniteNumber(rawItem?.quantity, 0));
        if (!productId || quantity < 1) {
          return res.status(400).json({ error: "Некоректний товар у кошику" });
        }

        const product = await db.getProductById(productId);
        if (!product) {
          return res.status(404).json({ error: `Товар ${productId} не знайдено` });
        }
        if (Number(product.stock || 0) < quantity) {
          return res.status(409).json({ error: `Недостатньо товару "${product.name}" на складі` });
        }

        const price = toFiniteNumber(product.price);
        serverTotal += price * quantity;
        orderItems.push({
          order_id: orderId,
          product_id: productId,
          quantity,
          price
        });
      }

      const promoCode = normalizeString(req.body?.promoCode, 80).toUpperCase();
      let promoDiscount = 0;
      if (promoCode) {
        const bonusCodes = await db.getBonusCodes();
        const promo = bonusCodes.find((code: any) =>
          String(code.code || "").toUpperCase() === promoCode &&
          code.is_active &&
          code.type === "promo"
        );
        if (!promo) {
          return res.status(400).json({ error: "Промокод неактивний або не існує" });
        }
        if (serverTotal < toFiniteNumber(promo.min_order_amount)) {
          return res.status(400).json({ error: "Сума замовлення менша за мінімум промокоду" });
        }
        promoDiscount = promo.discount_type === "percent"
          ? Math.floor(serverTotal * (toFiniteNumber(promo.discount_amount) / 100))
          : toFiniteNumber(promo.discount_amount);
        promoDiscount = Math.min(Math.max(promoDiscount, 0), serverTotal);
      }

      let safeBonusUsed = 0;
      if (authUser?.id) {
        const requestedBonus = Math.max(0, Math.floor(toFiniteNumber(req.body?.bonusUsed)));
        if (requestedBonus > 0) {
          const user = await db.getUserById(authUser.id);
          safeBonusUsed = Math.min(requestedBonus, Math.floor(toFiniteNumber(user?.bonuses)), Math.floor(serverTotal * 0.5));
        }
      }
      const safeFinalTotal = Math.max(0, serverTotal - promoDiscount - safeBonusUsed);

      await db.createOrder({
        id: orderId,
        user_id: authUser?.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_city: customerCity,
        customer_address: customerCity + (warehouse ? ", " + warehouse : ""),
        delivery_method: deliveryMethod,
        warehouse,
        total: serverTotal,
        payment_method: paymentMethod,
        comment: comment || (promoCode ? `Промокод: ${promoCode}` : undefined)
      }, orderItems, safeBonusUsed, safeFinalTotal);

      const orderSummary = {
        id: orderId,
        customer_name: customerName,
        customer_phone: customerPhone,
        final_total: safeFinalTotal
      };
      await notifyAdmins(
        "Нове замовлення",
        `Замовлення ${orderId} на ${safeFinalTotal} грн очікує обробки.`,
        "order_created"
      );
      await notifyUser(
        authUser?.id,
        "Замовлення прийнято",
        `Ми отримали замовлення ${orderId} на ${safeFinalTotal} грн.`,
        "order_created"
      );
      await sendTelegramOrderNotification(orderSummary, orderItems);

      res.json({
        success: true,
        orderId,
        total: serverTotal,
        bonusUsed: safeBonusUsed,
        discount: promoDiscount,
        finalTotal: safeFinalTotal
      });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error creating order:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: isQuota ? "Сервіс тимчасово недоступний через обмеження бази даних" : "Помилка при створенні замовлення" });
    }
  }));

  // Bonus Codes
  app.get("/api/bonus-codes/validate/:code", asyncHandler(async (req: any, res: any) => {
    const { code } = req.params;
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const bonusCodes = await (db as any).getBonusCodes();
      const bonusCode = bonusCodes.find((bc: any) => 
        bc.code.toLowerCase() === code.toLowerCase() && 
        bc.is_active && 
        bc.type === 'promo'
      );
      
      if (!bonusCode) {
        return res.status(404).json({ error: "Промокод не знайдено або він неактивний" });
      }
      
      res.json(bonusCode);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error validating bonus code:", error.message);
      }
      res.status(503).json({ error: "Сервіс тимчасово недоступний" });
    }
  }));

  app.get("/api/admin/bonus-codes", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const bonusCodes = await (db as any).getBonusCodes();
      res.json(bonusCodes);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin bonus codes:", error.message);
      }
      res.json([]);
    }
  }));

  app.post("/api/admin/bonus-codes", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const bonusCode = req.body;
    if (!bonusCode.id) bonusCode.id = Math.random().toString(36).substr(2, 9);
    if (!bonusCode.type) bonusCode.type = 'promo';
    await (db as any).createBonusCode(bonusCode);
    res.json({ success: true, bonusCode });
  }));

  app.delete("/api/admin/bonus-codes/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    await (db as any).deleteBonusCode(id);
    res.json({ success: true });
  }));

  app.put("/api/admin/bonus-codes/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const bonusCode = req.body;
    await (db as any).updateBonusCode(id, bonusCode);
    res.json({ success: true });
  }));

  // Admin Review Routes
  app.get("/api/admin/reviews", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const reviews = await (db as any).getAllReviews();
      res.json(reviews);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin reviews:", error.message);
      }
      res.json([]);
    }
  }));

  app.put("/api/admin/reviews/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const review = req.body;
    await (db as any).updateReview(id, review);
    res.json({ success: true });
  }));

  app.delete("/api/admin/reviews/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    await (db as any).deleteReview(id);
    res.json({ success: true });
  }));

  // Catch-all for API routes to prevent HTML responses
  app.all(/^\/api\/.*/, (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

async function startViteAndListen() {
  // Ensure DB is initialized at startup
  try {
    await ensureDb();
    console.log("Database initialized at startup");
  } catch (e) {
    const { isQuota, isFirst } = recordDbError(e);
    if (isFirst && !isQuota) {
      console.error("Failed to initialize database at startup:", e);
    }
  }

  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Server Error:", err);
    const status = err.status || 500;
    
    // Improved message extraction
    let message = "Internal Server Error";
    let sourceError = "Unknown Error";

    if (err instanceof Error) {
      message = err.message;
      sourceError = (err as any).cause || (err as any).sourceError || err.message;
    } else if (typeof err === 'string') {
      message = err;
      sourceError = err;
    } else if (err && typeof err === 'object') {
      message = err.message || err.error || JSON.stringify(err);
      sourceError = err.cause || err.sourceError || message;
    }
    
    const stack = err.stack || "No stack trace available";
    
    // Handle Neon specific quota errors
    const isQuotaError = message.toLowerCase().includes("quota") || 
                        sourceError.toString().toLowerCase().includes("quota") ||
                        message.includes("402") || 
                        (err.code && (err.code === "402" || err.code === "57014"));

    if (isQuotaError) {
      return res.status(503).json({
        error: "Database Quota Exceeded",
        message: "Ваш проект перевищив квоту передачі даних бази даних Neon. Будь ласка, зачекайте або оновіть план.",
        ...(!IS_PRODUCTION ? { sourceError, stack } : {})
      });
    }

    res.status(status).json({
      error: IS_PRODUCTION && status >= 500 ? "Internal Server Error" : message,
      ...(!IS_PRODUCTION ? { sourceError, stack } : {})
    });
  });
}

startViteAndListen();
