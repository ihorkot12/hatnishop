import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseAdapter, User, Product, Order, OrderItem, Review, PriceSubscription, Notification, Category } from "./interfaces.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SqliteAdapter implements DatabaseAdapter {
  private db: any;

  constructor() {
    const dbPath = process.env.VERCEL ? path.join("/tmp", "store.db") : path.join(__dirname, "..", "store.db");
    this.db = new Database(dbPath);
  }

  async init(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE COLLATE NOCASE,
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
        ai_description TEXT,
        images TEXT,
        bonus_points INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        customer_email TEXT,
        customer_city TEXT,
        customer_address TEXT,
        delivery_method TEXT,
        warehouse TEXT,
        total REAL,
        bonus_used REAL DEFAULT 0,
        final_total REAL,
        bonuses_credited INTEGER DEFAULT 0,
        tracking_number TEXT,
        comment TEXT,
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

      CREATE TABLE IF NOT EXISTS bonus_codes (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        discount_amount REAL,
        discount_type TEXT,
        min_order_amount REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        show_in_site INTEGER DEFAULT 1,
        title TEXT,
        description TEXT,
        type TEXT DEFAULT 'promo',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        id TEXT PRIMARY KEY,
        free_delivery_min REAL DEFAULT 1500,
        return_days INTEGER DEFAULT 14,
        cashback_percent INTEGER DEFAULT 5
      );

      INSERT OR IGNORE INTO site_settings (id, free_delivery_min, return_days, cashback_percent) VALUES ('default', 1500, 14, 5);

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        product_id TEXT,
        user_id TEXT,
        user_name TEXT,
        rating INTEGER,
        comment TEXT,
        is_approved INTEGER DEFAULT 0,
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

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT,
        slug TEXT UNIQUE,
        image TEXT,
        parent_id TEXT,
        FOREIGN KEY(parent_id) REFERENCES categories(id)
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
    
    // Migration: Add is_approved to reviews if it doesn't exist
    try {
      this.db.prepare("ALTER TABLE reviews ADD COLUMN is_approved INTEGER DEFAULT 0").run();
    } catch (e) {
      // Column might already exist
    }

    try { this.db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'"); } catch (e) {}
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.db.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)").get(email) as User | null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | null;
  }

  async createUser(user: Partial<User>): Promise<void> {
    this.db.prepare("INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)").run(
      user.id, user.email, user.password, user.name, user.role || 'user'
    );
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    this.db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  }

  async getProducts(): Promise<Product[]> {
    return this.db.prepare("SELECT * FROM products").all() as Product[];
  }

  async getProductById(id: string): Promise<Product | null> {
    return this.db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Product | null;
  }

  async updateProductPrice(id: string, price: number): Promise<void> {
    this.db.prepare("UPDATE products SET price = ? WHERE id = ?").run(price, id);
  }

  async updateProductStock(id: string, quantity: number): Promise<void> {
    this.db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(quantity, id);
  }

  async updateProductAiDescription(id: string, description: string): Promise<void> {
    this.db.prepare("UPDATE products SET ai_description = ? WHERE id = ?").run(description, id);
  }

  async createProduct(product: Partial<Product>): Promise<void> {
    this.db.prepare(`
      INSERT INTO products (id, name, category, price, image, description, material, brand, isPopular, isBundle, stock, images, bonus_points)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product.id, product.name, product.category, product.price, product.image,
      product.description, product.material, product.brand, product.isPopular ? 1 : 0, product.isBundle ? 1 : 0, product.stock, product.images || '[]', product.bonusPoints || 0
    );
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<void> {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(product)) {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
      }
    }
    values.push(id);
    this.db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  async deleteProduct(id: string): Promise<void> {
    this.db.prepare("DELETE FROM products WHERE id = ?").run(id);
  }

  async createOrder(order: any, items: OrderItem[], bonusUsed: number, finalTotal: number): Promise<void> {
    const insertOrder = this.db.prepare(`
      INSERT INTO orders (
        id, user_id, customer_name, customer_phone, customer_email, 
        customer_city, customer_address, delivery_method, warehouse, 
        total, bonus_used, final_total, payment_method, status, comment
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = this.db.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity, price)
      VALUES (?, ?, ?, ?)
    `);

    const updateBonuses = this.db.prepare("UPDATE users SET bonuses = bonuses - ? + ?, total_spent = total_spent + ? WHERE id = ?");
    const updateStock = this.db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");

    const transaction = this.db.transaction(() => {
      insertOrder.run(
        order.id,
        order.user_id || null,
        order.customer_name,
        order.customer_phone,
        order.customer_email || null,
        order.customer_city || null,
        order.customer_address,
        order.delivery_method || null,
        order.warehouse || null,
        order.total,
        bonusUsed,
        finalTotal,
        order.payment_method,
        'pending',
        order.comment || null
      );

      for (const item of items) {
        insertItem.run(order.id, item.product_id, item.quantity, item.price);
        updateStock.run(item.quantity, item.product_id);
      }

      if (order.user_id) {
        // Calculate bonuses logic is moved to service layer or handled here simply
        // Re-implementing simplified bonus logic here as per original server.ts
        const user = this.db.prepare("SELECT total_spent FROM users WHERE id = ?").get(order.user_id) as any;
        const totalSpent = (user?.total_spent || 0) + finalTotal;
        let bonusRate = 0.05;
        if (totalSpent >= 15000) bonusRate = 0.10;
        else if (totalSpent >= 5000) bonusRate = 0.07;
        
        const earnedBonuses = Math.floor(finalTotal * bonusRate);
        updateBonuses.run(bonusUsed || 0, earnedBonuses, finalTotal, order.user_id);
      }
    });

    transaction();
  }

  async getAllOrders(): Promise<any[]> {
    const orders = this.db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as any[];
    const result = [];
    for (const order of orders) {
      const items = this.db.prepare(`
        SELECT oi.*, p.name, p.image 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = ?
      `).all(order.id) as any[];
      result.push({
        id: order.id,
        total: Number(order.total),
        bonusUsed: Number(order.bonus_used || 0),
        finalTotal: Number(order.final_total || order.total),
        paymentMethod: order.payment_method,
        status: order.status,
        createdAt: order.created_at,
        bonusesCredited: !!order.bonuses_credited,
        trackingNumber: order.tracking_number,
        comment: order.comment,
        customer: {
          name: order.customer_name,
          phone: order.customer_phone,
          email: order.customer_email,
          city: order.customer_city,
          address: order.customer_address,
          deliveryMethod: order.delivery_method,
          warehouse: order.warehouse
        },
        items: items.map((item: any) => ({
          id: item.product_id,
          name: item.name,
          image: item.image,
          price: Number(item.price),
          quantity: item.quantity
        }))
      });
    }
    return result;
  }

  async updateOrderStatus(id: string, status: string): Promise<void> {
    this.db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
  }

  async updateOrderTrackingNumber(id: string, trackingNumber: string): Promise<void> {
    this.db.prepare("UPDATE orders SET tracking_number = ? WHERE id = ?").run(trackingNumber, id);
  }

  async markOrderBonusesCredited(id: string): Promise<void> {
    this.db.prepare("UPDATE orders SET bonuses_credited = 1 WHERE id = ?").run(id);
  }

  async getCategories(): Promise<Category[]> {
    return this.db.prepare("SELECT * FROM categories").all() as Category[];
  }

  async createCategory(category: Partial<Category>): Promise<void> {
    this.db.prepare("INSERT INTO categories (id, name, slug, image, parent_id) VALUES (?, ?, ?, ?, ?)").run(
      category.id, category.name, category.slug, category.image, category.parent_id || null
    );
  }

  async updateCategory(id: string, category: Partial<Category>): Promise<void> {
    const fields = [];
    const values = [];
    if (category.name !== undefined) { fields.push("name = ?"); values.push(category.name); }
    if (category.slug !== undefined) { fields.push("slug = ?"); values.push(category.slug); }
    if (category.image !== undefined) { fields.push("image = ?"); values.push(category.image); }
    if (category.parent_id !== undefined) { fields.push("parent_id = ?"); values.push(category.parent_id); }
    
    if (fields.length === 0) return;
    
    values.push(id);
    this.db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  async deleteCategory(id: string): Promise<void> {
    this.db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  }

  async getBonusCodes(): Promise<any[]> {
    return this.db.prepare("SELECT * FROM bonus_codes").all();
  }

  async createBonusCode(bonusCode: any): Promise<void> {
    this.db.prepare(`
      INSERT INTO bonus_codes (id, code, discount_amount, discount_type, min_order_amount, is_active, show_in_site, title, description, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(bonusCode.id, bonusCode.code, bonusCode.discount_amount, bonusCode.discount_type, bonusCode.min_order_amount || 0, bonusCode.is_active ? 1 : 0, bonusCode.show_in_site ? 1 : 0, bonusCode.title, bonusCode.description, bonusCode.type || 'promo');
  }

  async updateBonusCode(id: string, bonusCode: any): Promise<void> {
    const fields = [];
    const values = [];
    if (bonusCode.code) { fields.push("code = ?"); values.push(bonusCode.code); }
    if (bonusCode.discount_amount !== undefined) { fields.push("discount_amount = ?"); values.push(bonusCode.discount_amount); }
    if (bonusCode.discount_type) { fields.push("discount_type = ?"); values.push(bonusCode.discount_type); }
    if (bonusCode.min_order_amount !== undefined) { fields.push("min_order_amount = ?"); values.push(bonusCode.min_order_amount); }
    if (bonusCode.is_active !== undefined) { fields.push("is_active = ?"); values.push(bonusCode.is_active ? 1 : 0); }
    if (bonusCode.show_in_site !== undefined) { fields.push("show_in_site = ?"); values.push(bonusCode.show_in_site ? 1 : 0); }
    if (bonusCode.title) { fields.push("title = ?"); values.push(bonusCode.title); }
    if (bonusCode.description) { fields.push("description = ?"); values.push(bonusCode.description); }
    if (bonusCode.type) { fields.push("type = ?"); values.push(bonusCode.type); }
    values.push(id);
    this.db.prepare(`UPDATE bonus_codes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  async deleteBonusCode(id: string): Promise<void> {
    this.db.prepare("DELETE FROM bonus_codes WHERE id = ?").run(id);
  }

  async getSiteSettings(): Promise<any> {
    return this.db.prepare("SELECT * FROM site_settings WHERE id = 'default'").get();
  }

  async updateSiteSettings(settings: any): Promise<void> {
    this.db.prepare(`
      UPDATE site_settings SET 
        free_delivery_min = ?, 
        return_days = ?, 
        cashback_percent = ?
      WHERE id = 'default'
    `).run(settings.free_delivery_min, settings.return_days, settings.cashback_percent);
  }

  async getReviews(productId: string): Promise<Review[]> {
    return this.db.prepare("SELECT * FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC").all(productId) as Review[];
  }

  async getAllReviews(): Promise<Review[]> {
    return this.db.prepare("SELECT * FROM reviews ORDER BY created_at DESC").all() as Review[];
  }

  async createReview(review: Partial<Review>): Promise<void> {
    this.db.prepare("INSERT INTO reviews (id, product_id, user_id, user_name, rating, comment, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      review.id, review.product_id, review.user_id, review.user_name, review.rating, review.comment, review.is_approved || 0
    );
  }

  async updateReview(id: string, review: Partial<Review>): Promise<void> {
    this.db.prepare(`
      UPDATE reviews SET 
        comment = ?, 
        rating = ?, 
        is_approved = ?
      WHERE id = ?
    `).run(review.comment, review.rating, review.is_approved, id);
  }

  async deleteReview(id: string): Promise<void> {
    this.db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
  }

  async getUserOrders(userId: string): Promise<any[]> {
    return this.db.prepare("SELECT * FROM orders WHERE user_id = ?").all(userId);
  }

  async getPriceSubscriptions(userId: string): Promise<any[]> {
    return this.db.prepare(`
      SELECT s.*, p.name, p.price as current_price, p.image 
      FROM price_subscriptions s 
      JOIN products p ON s.product_id = p.id 
      WHERE s.user_id = ?
    `).all(userId);
  }

  async addPriceSubscription(sub: Partial<PriceSubscription>): Promise<void> {
    this.db.prepare("INSERT INTO price_subscriptions (id, user_id, product_id, initial_price) VALUES (?, ?, ?, ?)").run(
      sub.id, sub.user_id, sub.product_id, sub.initial_price
    );
  }

  async removePriceSubscription(userId: string, productId: string): Promise<void> {
    this.db.prepare("DELETE FROM price_subscriptions WHERE user_id = ? AND product_id = ?").run(userId, productId);
  }
  
  async getSubscriptionsByProductId(productId: string): Promise<PriceSubscription[]> {
    return this.db.prepare("SELECT * FROM price_subscriptions WHERE product_id = ?").all(productId) as PriceSubscription[];
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return this.db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Notification[];
  }

  async markNotificationRead(id: string, userId: string): Promise<void> {
    this.db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(id, userId);
  }

  async createNotification(notif: Partial<Notification>): Promise<void> {
    this.db.prepare("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)").run(
      notif.id, notif.user_id, notif.title, notif.message, notif.type
    );
  }

  async getAllUsers(): Promise<User[]> {
    return this.db.prepare("SELECT id, email, name, role, bonuses, total_spent FROM users").all() as User[];
  }

  async updateUserBonuses(id: string, bonuses: number): Promise<void> {
    this.db.prepare("UPDATE users SET bonuses = ? WHERE id = ?").run(bonuses, id);
  }

  async resetStats(): Promise<void> {
    this.db.prepare("DELETE FROM order_items").run();
    this.db.prepare("DELETE FROM orders").run();
  }

  async getAdminStats(): Promise<{
    totalSales: number;
    orderCount: number;
    avgOrderValue: number;
    totalBonuses: number;
    salesByDay: { name: string; sales: number }[];
    salesByCategory: { name: string; value: number }[];
  }> {
    const orders = this.db.prepare("SELECT total, created_at FROM orders WHERE status != 'cancelled'").all() as any[];
    const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const orderCount = orders.length;
    const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

    const users = this.db.prepare("SELECT bonuses FROM users").all() as any[];
    const totalBonuses = users.reduce((sum, u) => sum + Number(u.bonuses), 0);

    const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { 
        name: days[d.getDay()], 
        dateStr: d.toISOString().split('T')[0],
        sales: 0 
      };
    });

    orders.forEach(o => {
      const dateStr = new Date(o.created_at).toISOString().split('T')[0];
      const day = last7Days.find(d => d.dateStr === dateStr);
      if (day) day.sales += Number(o.total);
    });

    const categorySales = this.db.prepare(`
      SELECT p.category as name, SUM(oi.price * oi.quantity) as value
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
      GROUP BY p.category
    `).all() as any[];

    return {
      totalSales,
      orderCount,
      avgOrderValue,
      totalBonuses,
      salesByDay: last7Days.map(d => ({ name: d.name, sales: d.sales })),
      salesByCategory: categorySales.map(c => ({ name: c.name, value: Number(c.value) }))
    };
  }
}
