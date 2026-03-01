import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseAdapter, User, Product, Order, OrderItem, Review, PriceSubscription, Notification, Category } from "./interfaces";

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
      INSERT INTO products (id, name, category, price, image, description, material, brand, isPopular, isBundle, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product.id, product.name, product.category, product.price, product.image,
      product.description, product.material, product.brand, product.isPopular ? 1 : 0, product.isBundle ? 1 : 0, product.stock
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

  async createOrder(order: Partial<Order>, items: OrderItem[], bonusUsed: number, finalTotal: number): Promise<void> {
    const insertOrder = this.db.prepare(`
      INSERT INTO orders (id, user_id, customer_name, customer_phone, customer_address, total, payment_method, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        order.customer_address,
        finalTotal,
        order.payment_method,
        'pending'
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
    return this.db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  }

  async updateOrderStatus(id: string, status: string): Promise<void> {
    this.db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
  }

  async getCategories(): Promise<Category[]> {
    return this.db.prepare("SELECT * FROM categories").all() as Category[];
  }

  async createCategory(category: Partial<Category>): Promise<void> {
    this.db.prepare("INSERT INTO categories (id, name, slug, image) VALUES (?, ?, ?, ?)").run(
      category.id, category.name, category.slug, category.image
    );
  }

  async updateCategory(id: string, category: Partial<Category>): Promise<void> {
    this.db.prepare("UPDATE categories SET name = ?, slug = ?, image = ? WHERE id = ?").run(
      category.name, category.slug, category.image, id
    );
  }

  async deleteCategory(id: string): Promise<void> {
    this.db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  }

  async getReviews(productId: string): Promise<Review[]> {
    return this.db.prepare("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC").all(productId) as Review[];
  }

  async createReview(review: Partial<Review>): Promise<void> {
    this.db.prepare("INSERT INTO reviews (id, product_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?, ?)").run(
      review.id, review.product_id, review.user_id, review.user_name, review.rating, review.comment
    );
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
}
