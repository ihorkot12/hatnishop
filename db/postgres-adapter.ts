import { sql, db } from "@vercel/postgres";
import { DatabaseAdapter, User, Product, Order, OrderItem, Review, PriceSubscription, Notification, Category } from "./interfaces";

export class PostgresAdapter implements DatabaseAdapter {
  async init(): Promise<void> {
    await sql`
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
    `;

    await sql`
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
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        total REAL,
        payment_method TEXT,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        order_id TEXT,
        product_id TEXT,
        quantity INTEGER,
        price REAL,
        FOREIGN KEY(order_id) REFERENCES orders(id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        product_id TEXT,
        user_id TEXT,
        user_name TEXT,
        rating INTEGER,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS price_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        product_id TEXT,
        initial_price REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(product_id) REFERENCES products(id),
        UNIQUE(user_id, product_id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT,
        message TEXT,
        type TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `;

    // Ensure role column exists (idempotent check is harder in raw SQL, but ADD COLUMN IF NOT EXISTS is supported in Postgres 9.6+)
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`;
    } catch (e) {
      // Ignore if column exists
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { rows } = await sql`SELECT * FROM users WHERE LOWER(email) = LOWER(${email})`;
    return rows[0] as User | null;
  }

  async getUserById(id: string): Promise<User | null> {
    const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
    return rows[0] as User | null;
  }

  async createUser(user: Partial<User>): Promise<void> {
    await sql`
      INSERT INTO users (id, email, password, name, role) 
      VALUES (${user.id}, ${user.email}, ${user.password}, ${user.name}, ${user.role || 'user'})
    `;
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    await sql`UPDATE users SET role = ${role} WHERE id = ${id}`;
  }

  async getProducts(): Promise<Product[]> {
    const { rows } = await sql`SELECT * FROM products`;
    return rows as Product[];
  }

  async getProductById(id: string): Promise<Product | null> {
    const { rows } = await sql`SELECT * FROM products WHERE id = ${id}`;
    return rows[0] as Product | null;
  }

  async updateProductPrice(id: string, price: number): Promise<void> {
    await sql`UPDATE products SET price = ${price} WHERE id = ${id}`;
  }

  async updateProductStock(id: string, quantity: number): Promise<void> {
    await sql`UPDATE products SET stock = stock - ${quantity} WHERE id = ${id}`;
  }

  async updateProductAiDescription(id: string, description: string): Promise<void> {
    await sql`UPDATE products SET ai_description = ${description} WHERE id = ${id}`;
  }

  async createProduct(product: Partial<Product>): Promise<void> {
    await sql`
      INSERT INTO products (id, name, category, price, image, description, material, brand, isPopular, isBundle, stock)
      VALUES (${product.id}, ${product.name}, ${product.category}, ${product.price}, ${product.image}, ${product.description}, ${product.material}, ${product.brand}, ${product.isPopular ? 1 : 0}, ${product.isBundle ? 1 : 0}, ${product.stock})
    `;
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<void> {
    // Dynamic update is tricky with tagged template literals in vercel/postgres without a helper.
    // We'll update all fields for simplicity or use a more verbose approach.
    // Since we don't have a dynamic query builder here, let's just update all fields that are typically editable.
    await sql`
      UPDATE products SET 
        name = ${product.name}, 
        category = ${product.category}, 
        price = ${product.price}, 
        image = ${product.image}, 
        description = ${product.description}, 
        material = ${product.material}, 
        brand = ${product.brand}, 
        isPopular = ${product.isPopular ? 1 : 0}, 
        isBundle = ${product.isBundle ? 1 : 0}, 
        stock = ${product.stock}
      WHERE id = ${id}
    `;
  }

  async deleteProduct(id: string): Promise<void> {
    await sql`DELETE FROM products WHERE id = ${id}`;
  }

  async createOrder(order: Partial<Order>, items: OrderItem[], bonusUsed: number, finalTotal: number): Promise<void> {
    const client = await db.connect();
    
    try {
      await client.sql`BEGIN`;

      await client.sql`
        INSERT INTO orders (id, user_id, customer_name, customer_phone, customer_address, total, payment_method, status)
        VALUES (${order.id}, ${order.user_id || null}, ${order.customer_name}, ${order.customer_phone}, ${order.customer_address}, ${finalTotal}, ${order.payment_method}, 'pending')
      `;

      for (const item of items) {
        await client.sql`
          INSERT INTO order_items (order_id, product_id, quantity, price)
          VALUES (${order.id}, ${item.product_id}, ${item.quantity}, ${item.price})
        `;
        await client.sql`
          UPDATE products SET stock = stock - ${item.quantity} WHERE id = ${item.product_id}
        `;
      }

      if (order.user_id) {
        const { rows } = await client.sql`SELECT total_spent FROM users WHERE id = ${order.user_id}`;
        const user = rows[0];
        const totalSpent = (user?.total_spent || 0) + finalTotal;
        let bonusRate = 0.05;
        if (totalSpent >= 15000) bonusRate = 0.10;
        else if (totalSpent >= 5000) bonusRate = 0.07;
        
        const earnedBonuses = Math.floor(finalTotal * bonusRate);
        
        await client.sql`
          UPDATE users 
          SET bonuses = bonuses - ${bonusUsed || 0} + ${earnedBonuses}, 
              total_spent = total_spent + ${finalTotal} 
          WHERE id = ${order.user_id}
        `;
      }

      await client.sql`COMMIT`;
    } catch (error) {
      await client.sql`ROLLBACK`;
      throw error;
    } finally {
      client.release();
    }
  }

  async getAllOrders(): Promise<any[]> {
    const { rows } = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    return rows;
  }

  async updateOrderStatus(id: string, status: string): Promise<void> {
    await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
  }

  async getCategories(): Promise<Category[]> {
    const { rows } = await sql`SELECT * FROM categories`;
    return rows as Category[];
  }

  async createCategory(category: Partial<Category>): Promise<void> {
    await sql`
      INSERT INTO categories (id, name, slug, image)
      VALUES (${category.id}, ${category.name}, ${category.slug}, ${category.image})
    `;
  }

  async updateCategory(id: string, category: Partial<Category>): Promise<void> {
    await sql`
      UPDATE categories SET 
        name = ${category.name}, 
        slug = ${category.slug}, 
        image = ${category.image}
      WHERE id = ${id}
    `;
  }

  async deleteCategory(id: string): Promise<void> {
    await sql`DELETE FROM categories WHERE id = ${id}`;
  }

  async getReviews(productId: string): Promise<Review[]> {
    const { rows } = await sql`SELECT * FROM reviews WHERE product_id = ${productId} ORDER BY created_at DESC`;
    return rows as Review[];
  }

  async createReview(review: Partial<Review>): Promise<void> {
    await sql`
      INSERT INTO reviews (id, product_id, user_id, user_name, rating, comment) 
      VALUES (${review.id}, ${review.product_id}, ${review.user_id}, ${review.user_name}, ${review.rating}, ${review.comment})
    `;
  }

  async getPriceSubscriptions(userId: string): Promise<any[]> {
    const { rows } = await sql`
      SELECT s.*, p.name, p.price as current_price, p.image 
      FROM price_subscriptions s 
      JOIN products p ON s.product_id = p.id 
      WHERE s.user_id = ${userId}
    `;
    return rows;
  }

  async addPriceSubscription(sub: Partial<PriceSubscription>): Promise<void> {
    await sql`
      INSERT INTO price_subscriptions (id, user_id, product_id, initial_price) 
      VALUES (${sub.id}, ${sub.user_id}, ${sub.product_id}, ${sub.initial_price})
    `;
  }

  async removePriceSubscription(userId: string, productId: string): Promise<void> {
    await sql`DELETE FROM price_subscriptions WHERE user_id = ${userId} AND product_id = ${productId}`;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    const { rows } = await sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows as Notification[];
  }

  async markNotificationRead(id: string, userId: string): Promise<void> {
    await sql`UPDATE notifications SET is_read = 1 WHERE id = ${id} AND user_id = ${userId}`;
  }

  async createNotification(notif: Partial<Notification>): Promise<void> {
    await sql`
      INSERT INTO notifications (id, user_id, title, message, type) 
      VALUES (${notif.id}, ${notif.user_id}, ${notif.title}, ${notif.message}, ${notif.type})
    `;
  }

  async getAllUsers(): Promise<User[]> {
    const { rows } = await sql`SELECT id, email, name, role, bonuses, total_spent FROM users`;
    return rows as User[];
  }
}
