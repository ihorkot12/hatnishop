import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const db = new Database("store.db");
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    avatar TEXT,
    bonuses REAL DEFAULT 0,
    total_spent REAL DEFAULT 0,
    role TEXT DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    price REAL,
    image TEXT,
    description TEXT,
    material TEXT,
    brand TEXT,
    isPopular INTEGER,
    isBundle INTEGER,
    stock INTEGER DEFAULT 10,
    rating REAL DEFAULT 5.0,
    review_count INTEGER DEFAULT 0,
    ai_description TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    total REAL,
    payment_method TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    order_id TEXT,
    product_id TEXT,
    quantity INTEGER,
    price REAL,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    user_id TEXT,
    user_name TEXT,
    rating INTEGER,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS price_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    product_id TEXT,
    initial_price REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products(id),
    UNIQUE(user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    message TEXT,
    type TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Ensure role column exists for existing databases
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
} catch (e) {
  // Column already exists
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
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

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = Math.random().toString(36).substr(2, 9);
    try {
      db.prepare("INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)").run(id, email, hashedPassword, name);
      const token = jwt.sign({ id, email, name, role: 'user' }, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: 'none' });
      res.json({ user: { id, email, name, bonuses: 0, role: 'user' } });
    } catch (err) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: 'none' });
      res.json({ user: { id: user.id, email: user.email, name: user.name, bonuses: user.bonuses, role: user.role } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.json({ user: null });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = db.prepare("SELECT id, email, name, avatar, bonuses, role FROM users WHERE id = ?").get(decoded.id) as any;
      res.json({ user });
    } catch (err) {
      res.json({ user: null });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  // Review Routes
  app.get("/api/reviews/:productId", (req, res) => {
    const reviews = db.prepare("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC").all(req.params.productId);
    res.json(reviews);
  });

  app.post("/api/reviews", authenticate, (req: any, res) => {
    const { productId, rating, comment } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    db.prepare("INSERT INTO reviews (id, product_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?, ?)").run(
      id, productId, req.user.id, req.user.name, rating, comment
    );
    res.json({ success: true });
  });

  app.post("/api/products/:id/ai-description", authenticate, (req, res) => {
    const { aiDescription } = req.body;
    db.prepare("UPDATE products SET ai_description = ? WHERE id = ?").run(aiDescription, req.params.id);
    res.json({ success: true });
  });

  // Price Subscriptions
  app.post("/api/subscriptions/price-drop", authenticate, (req: any, res) => {
    const { productId, currentPrice } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    try {
      db.prepare("INSERT INTO price_subscriptions (id, user_id, product_id, initial_price) VALUES (?, ?, ?, ?)").run(
        id, req.user.id, productId, currentPrice
      );
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "Already subscribed" });
    }
  });

  app.get("/api/subscriptions/price-drop", authenticate, (req: any, res) => {
    const subs = db.prepare(`
      SELECT s.*, p.name, p.price as current_price, p.image 
      FROM price_subscriptions s 
      JOIN products p ON s.product_id = p.id 
      WHERE s.user_id = ?
    `).all(req.user.id);
    res.json(subs);
  });

  app.delete("/api/subscriptions/price-drop/:productId", authenticate, (req: any, res) => {
    db.prepare("DELETE FROM price_subscriptions WHERE user_id = ? AND product_id = ?").run(
      req.user.id, req.params.productId
    );
    res.json({ success: true });
  });

  // Notifications
  app.get("/api/notifications", authenticate, (req: any, res) => {
    const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
    res.json(notifications);
  });

  app.post("/api/notifications/:id/read", authenticate, (req: any, res) => {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  // Admin: Update Price (triggers notifications)
  app.post("/api/admin/products/:id/price", authenticate, (req: any, res) => {
    const { newPrice } = req.body;
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id) as any;
    if (!product) return res.status(404).json({ error: "Product not found" });

    const oldPrice = product.price;
    db.prepare("UPDATE products SET price = ? WHERE id = ?").run(newPrice, req.params.id);

    if (newPrice < oldPrice) {
      const subs = db.prepare("SELECT * FROM price_subscriptions WHERE product_id = ?").all(req.params.id) as any[];
      for (const sub of subs) {
        const notifId = Math.random().toString(36).substr(2, 9);
        db.prepare("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)").run(
          notifId, 
          sub.user_id, 
          "Ціна знижена!", 
          `Ціна на ${product.name} впала з ${oldPrice} грн до ${newPrice} грн!`, 
          "price_drop"
        );
      }
    }
    res.json({ success: true });
  });

  // API Routes
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products").all();
    res.json(products);
  });

  // Populate initial data if empty
  const count = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare(`
      INSERT INTO products (id, name, category, price, image, description, material, brand, isPopular, isBundle)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insert.run('p1', 'Керамічна чашка "Ранкова кава"', 'tableware', 350, 'https://picsum.photos/seed/cup1/800/800', 'Ручна робота, тепла кераміка, що зберігає тепло вашого напою.', 'Кераміка', 'HomeCraft', 1, 0);
    insert.run('p2', 'Лляний рушник "Еко-стиль"', 'textile', 280, 'https://picsum.photos/seed/towel1/800/800', 'Натуральний льон, висока поглинальна здатність.', 'Льон', 'EcoHome', 1, 0);
    insert.run('p3', 'Набір для сніданку "Затишок"', 'tableware', 1200, 'https://picsum.photos/seed/breakfast-set/800/800', 'Комплект: чашка, тарілка та дерев\'яна підставка.', null, null, 0, 1);
    insert.run('p4', 'Дерев\'яна дошка для сервірування', 'kitchen', 450, 'https://picsum.photos/seed/board1/800/800', 'Дубова дошка, оброблена натуральною олією.', 'Дуб', 'WoodSoul', 0, 0);
    insert.run('p5', 'Термос "Мандрівник" 500мл', 'bottles', 650, 'https://picsum.photos/seed/thermos1/800/800', 'Тримає тепло до 12 годин. Стильний матовий дизайн.', 'Нержавіюча сталь', 'Traveler', 0, 0);
  }

  // Create default admin if not exists
  const adminEmail = "admin@homecraft.com";
  const adminExists = db.prepare("SELECT * FROM users WHERE email = ?").get(adminEmail);
  if (!adminExists) {
    const adminId = "admin-1";
    const adminPass = "admin123";
    const hashed = await bcrypt.hash(adminPass, 10);
    db.prepare("INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)").run(
      adminId, adminEmail, hashed, "Адміністратор", "admin"
    );
  }

  app.post("/api/orders", (req, res) => {
    const { id, customer, items, total, paymentMethod, bonusUsed, finalTotal, userId } = req.body;
    
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, user_id, customer_name, customer_phone, customer_address, total, payment_method, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity, price)
      VALUES (?, ?, ?, ?)
    `);

    const updateBonuses = db.prepare("UPDATE users SET bonuses = bonuses - ? + ?, total_spent = total_spent + ? WHERE id = ?");

    const transaction = db.transaction((orderData, itemsData) => {
      insertOrder.run(
        orderData.id,
        orderData.userId || null,
        orderData.customer.name,
        orderData.customer.phone,
        orderData.customer.city + ", " + orderData.customer.warehouse,
        orderData.finalTotal,
        orderData.paymentMethod,
        'pending'
      );

      for (const item of itemsData) {
        insertItem.run(orderData.id, item.id, item.quantity, item.price);
        db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(item.quantity, item.id);
      }

      if (orderData.userId) {
        const user = db.prepare("SELECT total_spent FROM users WHERE id = ?").get(orderData.userId) as any;
        const totalSpent = user.total_spent + orderData.finalTotal;
        let bonusRate = 0.05;
        if (totalSpent >= 15000) bonusRate = 0.10;
        else if (totalSpent >= 5000) bonusRate = 0.07;
        
        const earnedBonuses = Math.floor(orderData.finalTotal * bonusRate);
        updateBonuses.run(orderData.bonusUsed || 0, earnedBonuses, orderData.finalTotal, orderData.userId);
      }
    });

    transaction({ id, customer, total, paymentMethod, bonusUsed, finalTotal, userId }, items);
    res.json({ success: true, orderId: id });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
