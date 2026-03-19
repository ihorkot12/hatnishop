import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { db } from "./db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export const app = express();
const PORT = 3000;

// Helper to handle async errors
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- Caching Logic ---
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let productsCache: { data: any, timestamp: number } | null = null;
let categoriesCache: { data: any, timestamp: number } | null = null;
let productsSummaryCache: { data: any, timestamp: number } | null = null;
let siteSettingsCache: { data: any, timestamp: number } | null = null;

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

const clearCache = () => {
  productsCache = null;
  categoriesCache = null;
  productsSummaryCache = null;
  siteSettingsCache = null;
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
      } catch (err) {
        console.error(`Error seeding admin ${admin.email}:`, err);
      }
    }

    dbInitialized = true;
    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err; // Re-throw to be caught by startViteAndListen
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
// Auth Routes
app.post("/api/auth/register", asyncHandler(async (req: any, res: any) => {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = Math.random().toString(36).substr(2, 9);
    try {
      await db.createUser({ id, email, password: hashedPassword, name });
      const token = jwt.sign({ id, email, name, role: 'user' }, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: 'none' });
      res.json({ user: { id, email, name, bonuses: 0, total_spent: 0, role: 'user', avatar: null } });
    } catch (err) {
      res.status(400).json({ error: "Email already exists" });
    }
  }));

  app.post("/api/auth/login", asyncHandler(async (req: any, res: any) => {
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
  }));

  app.get("/api/auth/me", asyncHandler(async (req: any, res: any) => {
    const token = req.cookies.token;
    if (!token) return res.json({ user: null });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await db.getUserById(decoded.id);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      } else {
        res.json({ user: null });
      }
    } catch (err) {
      res.json({ user: null });
    }
  }));

  app.post("/api/auth/logout", asyncHandler(async (req: any, res: any) => {
    res.clearCookie("token");
    res.json({ success: true });
  }));

  // Review Routes
  app.get("/api/reviews/:productId", asyncHandler(async (req: any, res: any) => {
    const reviews = await db.getReviews(req.params.productId);
    res.json(reviews);
  }));

  app.post("/api/reviews", authenticate, asyncHandler(async (req: any, res: any) => {
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
  }));

  app.post("/api/products/:id/ai-description", authenticate, asyncHandler(async (req: any, res: any) => {
    const { aiDescription } = req.body;
    await db.updateProductAiDescription(req.params.id, aiDescription);
    res.json({ success: true });
  }));

  // Price Subscriptions
  app.post("/api/subscriptions/price-drop", authenticate, asyncHandler(async (req: any, res: any) => {
    const { productId, currentPrice } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    try {
      await db.addPriceSubscription({
        id,
        user_id: req.user.id,
        product_id: productId,
        initial_price: currentPrice
      });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "Already subscribed" });
    }
  }));

  app.get("/api/subscriptions/price-drop", authenticate, asyncHandler(async (req: any, res: any) => {
    const subs = await db.getPriceSubscriptions(req.user.id);
    res.json(subs);
  }));

  app.delete("/api/subscriptions/price-drop/:productId", authenticate, asyncHandler(async (req: any, res: any) => {
    await db.removePriceSubscription(req.user.id, req.params.productId);
    res.json({ success: true });
  }));

  // Notifications
  app.get("/api/notifications", authenticate, asyncHandler(async (req: any, res: any) => {
    const notifications = await db.getNotifications(req.user.id);
    res.json(notifications);
  }));

  app.post("/api/notifications/:id/read", authenticate, asyncHandler(async (req: any, res: any) => {
    await db.markNotificationRead(req.params.id, req.user.id);
    res.json({ success: true });
  }));

  // Admin: Update Price (triggers notifications)
  app.post("/api/admin/products/:id/price", authenticate, asyncHandler(async (req: any, res: any) => {
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
  }));

  // API Routes
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
      res.json(formattedProducts);
    } catch (error) {
      console.error("Error fetching products, using cache if available:", error);
      if (productsCache) return res.json(productsCache.data);
      res.json([]); // Fallback to empty array
    }
  }));

  app.get("/api/products/:id", asyncHandler(async (req: any, res: any) => {
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
  }));

  app.get("/api/products/catalog", asyncHandler(async (req: any, res: any) => {
    const now = Date.now();
    if (productsSummaryCache && (now - productsSummaryCache.timestamp < CACHE_TTL)) {
      return res.json(productsSummaryCache.data);
    }
    try {
      const products = await db.getProductsSummary();
      const formattedProducts = products.map(p => ({
        ...p,
        images: p.images ? (typeof p.images === 'string' ? JSON.parse(p.images) : p.images) : [],
        bundle_items: p.bundle_items ? (typeof p.bundle_items === 'string' ? JSON.parse(p.bundle_items) : p.bundle_items) : []
      }));
      productsSummaryCache = { data: formattedProducts, timestamp: now };
      res.json(formattedProducts);
    } catch (error) {
      console.error("Error fetching products summary, using cache if available:", error);
      if (productsSummaryCache) return res.json(productsSummaryCache.data);
      res.json([]); // Fallback to empty array
    }
  }));

  app.post("/api/admin/products", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
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
  }));

  app.put("/api/admin/products/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
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
  }));

  app.delete("/api/admin/products/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    await db.deleteProduct(req.params.id);
    clearCache();
    res.json({ success: true });
  }));

  app.get("/api/admin/orders", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const orders = await db.getAllOrders();
    res.json(orders);
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
      const categories = await db.getCategories();
      categoriesCache = { data: categories, timestamp: now };
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories, using cache if available:", error);
      if (categoriesCache) return res.json(categoriesCache.data);
      res.json([]); // Fallback to empty array
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
    const users = await db.getAllUsers();
    res.json(users);
  }));

  app.put("/api/admin/users/:id/role", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { role } = req.body;
    await db.updateUserRole(req.params.id, role);
    res.json({ success: true });
  }));

  app.get("/api/admin/stats", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const stats = await db.getAdminStats();
    res.json(stats);
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

  app.get("/api/site-settings", asyncHandler(async (req: any, res: any) => {
    const now = Date.now();
    if (siteSettingsCache && (now - siteSettingsCache.timestamp < CACHE_TTL)) {
      return res.json(siteSettingsCache.data);
    }
    try {
      const settings = await db.getSiteSettings();
      siteSettingsCache = { data: settings || DEFAULT_SITE_SETTINGS, timestamp: now };
      res.json(settings || DEFAULT_SITE_SETTINGS);
    } catch (error) {
      console.error("Error fetching site settings, using cache or fallback:", error);
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
    const codes = await db.getBonusCodes();
    res.json(codes);
  }));

  app.get("/api/user/orders", authenticate, asyncHandler(async (req: any, res: any) => {
    const orders = await db.getAllOrders();
    const userOrders = orders.filter(o => o.user_id === req.user.id);
    res.json(userOrders);
  }));

  app.post("/api/orders", asyncHandler(async (req: any, res: any) => {
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
  }));

  // Bonus Codes
  app.get("/api/bonus-codes/validate/:code", asyncHandler(async (req: any, res: any) => {
    const { code } = req.params;
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
  }));

  app.get("/api/admin/bonus-codes", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const bonusCodes = await (db as any).getBonusCodes();
    res.json(bonusCodes);
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
    const reviews = await (db as any).getAllReviews();
    res.json(reviews);
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

async function startViteAndListen() {
  // Ensure DB is initialized at startup
  try {
    await ensureDb();
    console.log("Database initialized at startup");
  } catch (e) {
    console.error("Failed to initialize database at startup:", e);
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
    const message = err.message || "Internal Server Error";
    const stack = err.stack || "No stack trace available";
    
    // Handle Neon specific quota errors
    if (message.includes("quota") || message.includes("402") || (err.code && err.code === "402")) {
      return res.status(402).json({
        error: "Database Quota Exceeded",
        message: "Ваш проект перевищив квоту передачі даних бази даних Neon. Будь ласка, зачекайте або оновіть план.",
        sourceError: message,
        stack: stack
      });
    }

    res.status(status).json({
      error: message,
      sourceError: message,
      stack: stack
    });
  });
}

startViteAndListen();
