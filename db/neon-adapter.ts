import { neon } from '@neondatabase/serverless';
import { DatabaseAdapter, User, Product, Order, OrderItem, Review, PriceSubscription, Notification, Category } from "./interfaces.js";

export class NeonAdapter implements DatabaseAdapter {
  private sql: any;

  constructor() {
    this.sql = neon(process.env.DATABASE_URL || "");
  }

  async init(): Promise<void> {
    if (!process.env.DATABASE_URL) return;

    await this.sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT,
        avatar TEXT,
        bonuses NUMERIC DEFAULT 0,
        total_spent NUMERIC DEFAULT 0,
        role TEXT DEFAULT 'user'
      );
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        price NUMERIC,
        image TEXT,
        description TEXT,
        material TEXT,
        brand TEXT,
        isPopular BOOLEAN DEFAULT FALSE,
        isBundle BOOLEAN DEFAULT FALSE,
        stock INTEGER DEFAULT 10,
        rating NUMERIC DEFAULT 5.0,
        review_count INTEGER DEFAULT 0,
        ai_description TEXT,
        images TEXT,
        bonus_points INTEGER DEFAULT 0,
        bundle_items TEXT DEFAULT '[]',
        cost_price NUMERIC
      );
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT,
        slug TEXT UNIQUE,
        image TEXT,
        parent_id TEXT REFERENCES categories(id)
      );
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        customer_name TEXT,
        customer_phone TEXT,
        customer_email TEXT,
        customer_city TEXT,
        customer_address TEXT,
        delivery_method TEXT,
        warehouse TEXT,
        total NUMERIC,
        bonus_used NUMERIC DEFAULT 0,
        final_total NUMERIC,
        bonuses_credited BOOLEAN DEFAULT FALSE,
        tracking_number TEXT,
        comment TEXT,
        payment_method TEXT,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Try to add missing columns if table already exists
    try {
      await this.sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT`;
      await this.sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_city TEXT`;
      await this.sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method TEXT`;
      await this.sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS warehouse TEXT`;
      await this.sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS bonus_used NUMERIC DEFAULT 0`;
      await this.sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_total NUMERIC`;
      await this.sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS bonuses_credited BOOLEAN DEFAULT FALSE`;
      await this.sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT`;
      await this.sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS comment TEXT`;
    } catch (e) {
      console.log("Columns might already exist or error adding them:", e);
    }

    await this.sql`
      CREATE TABLE IF NOT EXISTS order_items (
        order_id TEXT REFERENCES orders(id),
        product_id TEXT,
        quantity INTEGER,
        price NUMERIC
      );
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS bonus_codes (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        discount_amount NUMERIC,
        discount_type TEXT,
        min_order_amount NUMERIC DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        show_in_site BOOLEAN DEFAULT TRUE,
        title TEXT,
        description TEXT,
        type TEXT DEFAULT 'promo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Migration: Add missing columns to bonus_codes if they don't exist
    try {
      await this.sql`ALTER TABLE bonus_codes ADD COLUMN IF NOT EXISTS title TEXT;`;
      await this.sql`ALTER TABLE bonus_codes ADD COLUMN IF NOT EXISTS description TEXT;`;
      await this.sql`ALTER TABLE bonus_codes ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'promo';`;
      await this.sql`ALTER TABLE bonus_codes ADD COLUMN IF NOT EXISTS show_in_site BOOLEAN DEFAULT TRUE;`;
    } catch (e) {
      console.log("Migration error for bonus_codes:", e);
    }

    await this.sql`
      CREATE TABLE IF NOT EXISTS site_settings (
        id TEXT PRIMARY KEY,
        free_delivery_min NUMERIC DEFAULT 1500,
        return_days INTEGER DEFAULT 14,
        cashback_percent INTEGER DEFAULT 5,
        hero_title TEXT DEFAULT 'Естетичний посуд та декор для дому',
        hero_subtitle TEXT DEFAULT 'Інтернет-магазин "Хатні Штучки" — ваш провідник у світ затишку. Купуйте кераміку, текстиль та аксесуари, які перетворюють оселю на місце сили.',
        hero_featured_product_id TEXT DEFAULT 'p1',
        hero_badge TEXT DEFAULT 'Бестселер сезону',
        bestsellers_badge TEXT DEFAULT 'Наші бестселери',
        bestsellers_title TEXT DEFAULT 'Популярні товари для вашого затишку',
        bestsellers_subtitle TEXT DEFAULT 'Обирайте найкращий посуд та декор, який став фаворитом наших покупців. Кожна річ у каталозі "Хатні Штучки" — це поєднання естетики та функціональності.'
      );
    `;

    // Ensure initial site settings exist
    const settings = await this.sql`SELECT * FROM site_settings WHERE id = 'default'`;
    if (settings.length === 0) {
      await this.sql`INSERT INTO site_settings (id, free_delivery_min, return_days, cashback_percent, hero_title, hero_subtitle, hero_featured_product_id, hero_badge, bestsellers_badge, bestsellers_title, bestsellers_subtitle) VALUES ('default', 1500, 14, 5, 'Естетичний посуд та декор для дому', 'Інтернет-магазин "Хатні Штучки" — ваш провідник у світ затишку. Купуйте кераміку, текстиль та аксесуари, які перетворюють оселю на місце сили.', 'p1', 'Бестселер сезону', 'Наші бестселери', 'Популярні товари для вашого затишку', 'Обирайте найкращий посуд та декор, який став фаворитом наших покупців. Кожна річ у каталозі "Хатні Штучки" — це поєднання естетики та функціональності.')`;
    }

    // Migration for existing table
    try {
      await this.sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_title TEXT DEFAULT 'Естетичний посуд та декор для дому'`;
      await this.sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_subtitle TEXT DEFAULT 'Інтернет-магазин "Хатні Штучки" — ваш провідник у світ затишку. Купуйте кераміку, текстиль та аксесуари, які перетворюють оселю на місце сили.'`;
      await this.sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_featured_product_id TEXT DEFAULT 'p1'`;
      await this.sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_badge TEXT DEFAULT 'Бестселер сезону'`;
      await this.sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS bestsellers_badge TEXT DEFAULT 'Наші бестселери'`;
      await this.sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS bestsellers_title TEXT DEFAULT 'Популярні товари для вашого затишку'`;
      await this.sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS bestsellers_subtitle TEXT DEFAULT 'Обирайте найкращий посуд та декор, який став фаворитом наших покупців. Кожна річ у каталозі "Хатні Штучки" — це поєднання естетики та функціональності.'`;
    } catch (e) {
      console.log("Site settings columns might already exist:", e);
    }

    await this.sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        product_id TEXT REFERENCES products(id),
        user_id TEXT REFERENCES users(id),
        user_name TEXT,
        rating INTEGER,
        comment TEXT,
        is_approved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Migration: Add is_approved to reviews if it doesn't exist
    try {
      await this.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;`;
    } catch (e) {
      console.log("Migration error for reviews:", e);
    }

    await this.sql`
      CREATE TABLE IF NOT EXISTS price_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        product_id TEXT REFERENCES products(id),
        initial_price NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      );
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        title TEXT,
        message TEXT,
        type TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Seed Categories
    try {
      await this.sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES categories(id)`;
    } catch (e) {
      // Ignore if column exists
    }

    try {
      await this.sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT`;
    } catch (e) {
      // Ignore if column exists
    }

    try {
      await this.sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS bonus_points INTEGER DEFAULT 0`;
      await this.sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_items TEXT DEFAULT '[]'`;
      await this.sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC`;
    } catch (e) {
      // Ignore if column exists
    }

    const existingCategories = await this.sql`SELECT id FROM categories LIMIT 1`;
    if (existingCategories.length === 0) {
      await this.sql`
        INSERT INTO categories (id, name, slug, image) VALUES 
        ('1', 'Кухонне приладдя', 'kitchen', 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=800'),
        ('2', 'Посуд', 'tableware', 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&q=80&w=800'),
        ('3', 'Текстиль', 'textile', 'https://images.unsplash.com/photo-1528906819430-d155e7078556?auto=format&fit=crop&q=80&w=800'),
        ('4', 'Організація простору', 'organization', 'https://images.unsplash.com/photo-1594404341023-29419573f5ec?auto=format&fit=crop&q=80&w=800'),
        ('5', 'Термоси та пляшки', 'bottles', 'https://images.unsplash.com/photo-1592089416462-2b0cb7da8379?auto=format&fit=crop&q=80&w=800'),
        ('6', 'Декор', 'decor', 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=800')
      `;
    }

    // Seed Products
    const existingProducts = await this.sql`SELECT id FROM products LIMIT 1`;
    if (existingProducts.length === 0) {
      await this.sql`
        INSERT INTO products (id, name, category, price, image, description, material, brand, isPopular, isBundle, stock) VALUES 
        ('p1', 'Керамічна чашка "Ранкова кава"', 'tableware', 350, 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&q=80&w=800', 'Ручна робота, тепла кераміка, що зберігає тепло вашого напою.', 'Кераміка', 'HomeCraft', TRUE, FALSE, 12),
        ('p2', 'Лляний рушник "Еко-стиль"', 'textile', 280, 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&q=80&w=800', 'Натуральний льон, висока поглинальна здатність.', 'Льон', 'EcoHome', TRUE, FALSE, 3),
        ('p4', 'Дерев''яна дошка для сервірування', 'kitchen', 450, 'https://images.unsplash.com/photo-1533777857419-377a70617714?auto=format&fit=crop&q=80&w=800', 'Дубова дошка, оброблена натуральною олією.', 'Дуб', 'WoodSoul', FALSE, FALSE, 20),
        ('p5', 'Термос "Мандрівник" 500мл', 'bottles', 650, 'https://images.unsplash.com/photo-1592089416462-2b0cb7da8379?auto=format&fit=crop&q=80&w=800', 'Тримає тепло до 12 годин. Стильний матовий дизайн.', 'Нержавіюча сталь', 'Traveler', FALSE, FALSE, 15)
      `;
    }

    // Seed Admin
    const adminEmail = "ihorkot12@gmail.com";
    const existingAdmin = await this.sql`SELECT id FROM users WHERE email = ${adminEmail}`;
    if (existingAdmin.length === 0) {
      // We need bcrypt to hash the password, but we are in the adapter.
      // Usually, we'd pass a hasher or handle this in server.ts.
      // But for simplicity, I'll use a pre-hashed password if I had one, 
      // or just wait for the user to register.
      // Actually, the user provided a password "4756500".
      // I'll skip hashing here to avoid adding dependency to the adapter if possible,
      // but the user's server code had it.
      // I'll just let the server handle it or use a placeholder.
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const rows = await this.sql`SELECT * FROM users WHERE LOWER(email) = LOWER(${email})`;
    return rows[0] as User | null;
  }

  async getUserById(id: string): Promise<User | null> {
    const rows = await this.sql`SELECT * FROM users WHERE id = ${id}`;
    return rows[0] as User | null;
  }

  async createUser(user: Partial<User>): Promise<void> {
    await this.sql`
      INSERT INTO users (id, email, password, name, role) 
      VALUES (${user.id}, ${user.email}, ${user.password}, ${user.name}, ${user.role || 'user'})
    `;
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    await this.sql`UPDATE users SET role = ${role} WHERE id = ${id}`;
  }

  async getProducts(): Promise<Product[]> {
    const rows = await this.sql`SELECT * FROM products`;
    return rows as Product[];
  }

  async getProductById(id: string): Promise<Product | null> {
    const rows = await this.sql`SELECT * FROM products WHERE id = ${id}`;
    return rows[0] as Product | null;
  }

  async updateProductPrice(id: string, price: number): Promise<void> {
    await this.sql`UPDATE products SET price = ${price} WHERE id = ${id}`;
  }

  async updateProductStock(id: string, quantity: number): Promise<void> {
    await this.sql`UPDATE products SET stock = stock - ${quantity} WHERE id = ${id}`;
  }

  async updateProductAiDescription(id: string, description: string): Promise<void> {
    await this.sql`UPDATE products SET ai_description = ${description} WHERE id = ${id}`;
  }

  async createProduct(product: Partial<Product>): Promise<void> {
    await this.sql`
      INSERT INTO products (id, name, category, price, image, description, material, brand, isPopular, isBundle, stock, images, bonus_points, bundle_items, cost_price)
      VALUES (${product.id}, ${product.name}, ${product.category}, ${product.price}, ${product.image}, ${product.description}, ${product.material}, ${product.brand}, ${product.isPopular || false}, ${product.isBundle || false}, ${product.stock || 0}, ${product.images || '[]'}, ${product.bonusPoints || 0}, ${product.bundle_items || '[]'}, ${product.cost_price})
    `;
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<void> {
    await this.sql`
      UPDATE products SET 
        name = ${product.name}, 
        category = ${product.category}, 
        price = ${product.price}, 
        image = ${product.image}, 
        description = ${product.description}, 
        material = ${product.material}, 
        brand = ${product.brand}, 
        isPopular = ${product.isPopular || false}, 
        isBundle = ${product.isBundle || false}, 
        stock = ${product.stock || 0},
        images = ${product.images || '[]'},
        bonus_points = ${product.bonusPoints || 0},
        bundle_items = ${product.bundle_items || '[]'},
        cost_price = ${product.cost_price}
      WHERE id = ${id}
    `;
  }

  async deleteProduct(id: string): Promise<void> {
    await this.sql`DELETE FROM products WHERE id = ${id}`;
  }

  async createOrder(order: any, items: OrderItem[], bonusUsed: number, finalTotal: number): Promise<void> {
    // Neon serverless doesn't support multi-statement transactions in a single tagged template easily
    // but we can execute them sequentially or use a transaction if the driver supports it.
    // For simplicity and reliability in this environment, we'll do sequential calls.
    await this.sql`
      INSERT INTO orders (
        id, user_id, customer_name, customer_phone, customer_email, 
        customer_city, customer_address, delivery_method, warehouse, 
        total, bonus_used, final_total, payment_method, status, comment
      )
      VALUES (
        ${order.id}, ${order.user_id || null}, ${order.customer_name}, ${order.customer_phone}, ${order.customer_email || null},
        ${order.customer_city || null}, ${order.customer_address}, ${order.delivery_method || null}, ${order.warehouse || null},
        ${order.total}, ${bonusUsed}, ${finalTotal}, ${order.payment_method}, 'pending', ${order.comment || null}
      )
    `;

    for (const item of items) {
      await this.sql`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (${order.id}, ${item.product_id}, ${item.quantity}, ${item.price})
      `;
      await this.sql`
        UPDATE products SET stock = stock - ${item.quantity} WHERE id = ${item.product_id}
      `;
    }

    if (order.user_id) {
      const rows = await this.sql`SELECT total_spent FROM users WHERE id = ${order.user_id}`;
      const user = rows[0];
      const totalSpent = (Number(user?.total_spent) || 0) + Number(finalTotal);
      let bonusRate = 0.05;
      if (totalSpent >= 15000) bonusRate = 0.10;
      else if (totalSpent >= 5000) bonusRate = 0.07;
      
      const earnedBonuses = Math.floor(finalTotal * bonusRate);
      
      await this.sql`
        UPDATE users 
        SET bonuses = bonuses - ${bonusUsed || 0} + ${earnedBonuses}, 
            total_spent = total_spent + ${finalTotal} 
        WHERE id = ${order.user_id}
      `;
    }
  }

  async getAllOrders(): Promise<any[]> {
    const orders = await this.sql`SELECT * FROM orders ORDER BY created_at DESC`;
    const result = [];
    for (const order of orders) {
      const items = await this.sql`
        SELECT oi.*, p.name, p.image 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = ${order.id}
      `;
      result.push({
        id: order.id,
        total: Number(order.total),
        bonusUsed: Number(order.bonus_used || 0),
        finalTotal: Number(order.final_total || order.total),
        paymentMethod: order.payment_method,
        status: order.status,
        createdAt: order.created_at,
        bonusesCredited: order.bonuses_credited,
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
    await this.sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
  }

  async updateOrderTrackingNumber(id: string, trackingNumber: string): Promise<void> {
    await this.sql`UPDATE orders SET tracking_number = ${trackingNumber} WHERE id = ${id}`;
  }

  async markOrderBonusesCredited(id: string): Promise<void> {
    await this.sql`UPDATE orders SET bonuses_credited = TRUE WHERE id = ${id}`;
  }

  async getCategories(): Promise<Category[]> {
    return await this.sql`SELECT * FROM categories`;
  }

  async createCategory(category: Partial<Category>): Promise<void> {
    await this.sql`
      INSERT INTO categories (id, name, slug, image, parent_id)
      VALUES (${category.id}, ${category.name}, ${category.slug}, ${category.image}, ${category.parent_id || null})
    `;
  }

  async updateCategory(id: string, category: Partial<Category>): Promise<void> {
    await this.sql`
      UPDATE categories SET 
        name = ${category.name}, 
        slug = ${category.slug}, 
        image = ${category.image},
        parent_id = ${category.parent_id || null}
      WHERE id = ${id}
    `;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.sql`DELETE FROM categories WHERE id = ${id}`;
  }

  async getBonusCodes(): Promise<any[]> {
    return await this.sql`SELECT * FROM bonus_codes`;
  }

  async createBonusCode(bonusCode: any): Promise<void> {
    await this.sql`
      INSERT INTO bonus_codes (id, code, discount_amount, discount_type, min_order_amount, is_active, show_in_site, title, description, type)
      VALUES (${bonusCode.id}, ${bonusCode.code}, ${bonusCode.discount_amount}, ${bonusCode.discount_type}, ${bonusCode.min_order_amount || 0}, ${bonusCode.is_active}, ${bonusCode.show_in_site}, ${bonusCode.title}, ${bonusCode.description}, ${bonusCode.type || 'promo'})
    `;
  }

  async updateBonusCode(id: string, bonusCode: any): Promise<void> {
    await this.sql`
      UPDATE bonus_codes SET 
        code = ${bonusCode.code}, 
        discount_amount = ${bonusCode.discount_amount}, 
        discount_type = ${bonusCode.discount_type}, 
        min_order_amount = ${bonusCode.min_order_amount}, 
        is_active = ${bonusCode.is_active},
        show_in_site = ${bonusCode.show_in_site},
        title = ${bonusCode.title},
        description = ${bonusCode.description},
        type = ${bonusCode.type}
      WHERE id = ${id}
    `;
  }

  async deleteBonusCode(id: string): Promise<void> {
    await this.sql`DELETE FROM bonus_codes WHERE id = ${id}`;
  }

  async getSiteSettings(): Promise<any> {
    const settings = await this.sql`SELECT * FROM site_settings WHERE id = 'default'`;
    return settings[0];
  }

  async updateSiteSettings(settings: any): Promise<void> {
    await this.sql`
      UPDATE site_settings SET 
        free_delivery_min = ${settings.free_delivery_min}, 
        return_days = ${settings.return_days}, 
        cashback_percent = ${settings.cashback_percent},
        hero_title = ${settings.hero_title},
        hero_subtitle = ${settings.hero_subtitle},
        hero_featured_product_id = ${settings.hero_featured_product_id},
        hero_badge = ${settings.hero_badge},
        bestsellers_badge = ${settings.bestsellers_badge},
        bestsellers_title = ${settings.bestsellers_title},
        bestsellers_subtitle = ${settings.bestsellers_subtitle}
      WHERE id = 'default'
    `;
  }

  async getReviews(productId: string): Promise<Review[]> {
    return await this.sql`SELECT * FROM reviews WHERE product_id = ${productId} AND is_approved = TRUE ORDER BY created_at DESC`;
  }

  async getAllReviews(): Promise<Review[]> {
    return await this.sql`SELECT * FROM reviews ORDER BY created_at DESC`;
  }

  async createReview(review: Partial<Review>): Promise<void> {
    await this.sql`
      INSERT INTO reviews (id, product_id, user_id, user_name, rating, comment, is_approved) 
      VALUES (${review.id}, ${review.product_id}, ${review.user_id}, ${review.user_name}, ${review.rating}, ${review.comment}, ${review.is_approved || false})
    `;
  }

  async updateReview(id: string, review: Partial<Review>): Promise<void> {
    await this.sql`
      UPDATE reviews SET 
        comment = ${review.comment}, 
        rating = ${review.rating}, 
        is_approved = ${review.is_approved}
      WHERE id = ${id}
    `;
  }

  async deleteReview(id: string): Promise<void> {
    await this.sql`DELETE FROM reviews WHERE id = ${id}`;
  }

  async getUserOrders(userId: string): Promise<any[]> {
    return await this.sql`SELECT * FROM orders WHERE user_id = ${userId}`;
  }

  async getPriceSubscriptions(userId: string): Promise<any[]> {
    return await this.sql`
      SELECT s.*, p.name, p.price as current_price, p.image 
      FROM price_subscriptions s 
      JOIN products p ON s.product_id = p.id 
      WHERE s.user_id = ${userId}
    `;
  }

  async addPriceSubscription(sub: Partial<PriceSubscription>): Promise<void> {
    await this.sql`
      INSERT INTO price_subscriptions (id, user_id, product_id, initial_price) 
      VALUES (${sub.id}, ${sub.user_id}, ${sub.product_id}, ${sub.initial_price})
    `;
  }

  async removePriceSubscription(userId: string, productId: string): Promise<void> {
    await this.sql`DELETE FROM price_subscriptions WHERE user_id = ${userId} AND product_id = ${productId}`;
  }
  
  async getSubscriptionsByProductId(productId: string): Promise<PriceSubscription[]> {
    return await this.sql`SELECT * FROM price_subscriptions WHERE product_id = ${productId}`;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return await this.sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC`;
  }

  async markNotificationRead(id: string, userId: string): Promise<void> {
    await this.sql`UPDATE notifications SET is_read = 1 WHERE id = ${id} AND user_id = ${userId}`;
  }

  async createNotification(notif: Partial<Notification>): Promise<void> {
    await this.sql`
      INSERT INTO notifications (id, user_id, title, message, type) 
      VALUES (${notif.id}, ${notif.user_id}, ${notif.title}, ${notif.message}, ${notif.type})
    `;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.sql`SELECT id, email, name, role, bonuses, total_spent FROM users`;
  }

  async updateUserBonuses(id: string, bonuses: number): Promise<void> {
    await this.sql`UPDATE users SET bonuses = ${bonuses} WHERE id = ${id}`;
  }

  async resetStats(): Promise<void> {
    await this.sql`DELETE FROM order_items`;
    await this.sql`DELETE FROM orders`;
  }

  async getAdminStats(): Promise<{
    totalSales: number;
    orderCount: number;
    avgOrderValue: number;
    totalBonuses: number;
    salesByDay: { name: string; sales: number }[];
    salesByCategory: { name: string; value: number }[];
  }> {
    const orders = await this.sql`SELECT total, final_total, created_at FROM orders WHERE status != 'cancelled'`;
    const totalSales = orders.reduce((sum: number, o: any) => sum + Number(o.final_total || o.total), 0);
    const orderCount = orders.length;
    const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

    const users = await this.sql`SELECT bonuses FROM users`;
    const totalBonuses = users.reduce((sum: number, u: any) => sum + Number(u.bonuses), 0);

    // Sales by day (last 7 days)
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

    orders.forEach((o: any) => {
      const dateStr = new Date(o.created_at).toISOString().split('T')[0];
      const day = last7Days.find(d => d.dateStr === dateStr);
      if (day) day.sales += Number(o.final_total || o.total);
    });

    // Sales by category
    const categorySales = await this.sql`
      SELECT p.category as name, SUM(oi.price * oi.quantity) as value
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
      GROUP BY p.category
    `;

    return {
      totalSales,
      orderCount,
      avgOrderValue,
      totalBonuses,
      salesByDay: last7Days.map(d => ({ name: d.name, sales: d.sales })),
      salesByCategory: categorySales.map((c: any) => ({ name: c.name, value: Number(c.value) }))
    };
  }
}
