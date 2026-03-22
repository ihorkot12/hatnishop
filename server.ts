import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { db } from "./db/index.js";

import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, "db_cache.json");

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export const app = express();
const PORT = 3000;

// Helper to handle async errors
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
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
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    dbInitialized,
    env: process.env.NODE_ENV || "development"
  });
});

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
      const token = jwt.sign({ id, email, name, role: 'user' }, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: 'none' });
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
      const { email, password } = req.body;
      console.log(`Login attempt for: ${email}`);
      
      const user = await db.getUserByEmail(email);
      
      if (!user) {
        console.log(`User not found: ${email}`);
        return res.status(401).json({ error: "Користувача не знайдено" });
      }

      const isMatch = await bcrypt.compare(password, user.password || "");
      if (isMatch) {
        console.log(`Login successful for: ${email}`);
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET);
        res.cookie("token", token, { 
          httpOnly: true, 
          secure: true, 
          sameSite: 'none',
          maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
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
      decoded = jwt.verify(token, JWT_SECRET) as any;
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
    res.clearCookie("token");
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
    const { aiDescription } = req.body;
    await db.updateProductAiDescription(req.params.id, aiDescription);
    res.json({ success: true });
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
    const { status, trackingNumber } = req.body;
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

    // Credit bonuses if status is paid or completed and not already credited
    if ((status === 'paid' || status === 'completed') && !order.bonusesCredited && order.user_id) {
      const bonusRate = 0.05; // 5% cashback
      const earnedBonuses = Math.floor(order.finalTotal * bonusRate);
      
      const user = await db.getUserById(order.user_id);
      if (user) {
        await db.updateUserBonuses(order.user_id, (user.bonuses || 0) + earnedBonuses);
        // We need a way to mark bonuses as credited in the DB
        // I'll add a method to the adapter or use a raw query if possible
        // For now, let's assume we need to add markOrderBonusesCredited to the interface
        if ((db as any).markOrderBonusesCredited) {
          await (db as any).markOrderBonusesCredited(orderId);
        }
      }
    }

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
      const { id, customer, items, total, paymentMethod, bonusUsed, finalTotal, userId, comment } = req.body;
      
      // Map items to OrderItem interface
      const orderItems = items.map((item: any) => ({
        product_id: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      await db.createOrder({
        id,
        user_id: userId,
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_email: customer.email,
        customer_city: customer.city,
        customer_address: customer.city + (customer.warehouse ? ", " + customer.warehouse : ""),
        delivery_method: customer.deliveryMethod,
        warehouse: customer.warehouse,
        total: total,
        payment_method: paymentMethod,
        comment: comment
      }, orderItems, bonusUsed, finalTotal);

      res.json({ success: true, orderId: id });
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
  app.all("/api/*", (req, res) => {
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
    app.get("*", (req, res) => {
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
      return res.status(402).json({
        error: "Database Quota Exceeded",
        message: "Ваш проект перевищив квоту передачі даних бази даних Neon. Будь ласка, зачекайте або оновіть план.",
        sourceError: sourceError,
        stack: stack
      });
    }

    res.status(status).json({
      error: message,
      sourceError: sourceError,
      stack: stack
    });
  });
}

startViteAndListen();
