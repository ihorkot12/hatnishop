export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  avatar?: string;
  bonuses: number;
  total_spent: number;
  role: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  material: string;
  brand: string;
  isPopular: number;
  isBundle: number;
  stock: number;
  rating: number;
  review_count: number;
  ai_description?: string;
}

export interface Order {
  id: string;
  user_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total: number;
  payment_method: string;
  status: string;
  created_at?: string;
}

export interface OrderItem {
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at?: string;
}

export interface PriceSubscription {
  id: string;
  user_id: string;
  product_id: string;
  initial_price: number;
  created_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
}

export interface DatabaseAdapter {
  init(): Promise<void>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  createUser(user: Partial<User>): Promise<void>;
  updateUserRole(id: string, role: string): Promise<void>;
  getProducts(): Promise<Product[]>;
  getProductById(id: string): Promise<Product | null>;
  updateProductPrice(id: string, price: number): Promise<void>;
  updateProductStock(id: string, quantity: number): Promise<void>;
  updateProductAiDescription(id: string, description: string): Promise<void>;
  createProduct(product: Partial<Product>): Promise<void>;
  updateProduct(id: string, product: Partial<Product>): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  createOrder(order: Partial<Order>, items: OrderItem[], bonusUsed: number, finalTotal: number): Promise<void>;
  getAllOrders(): Promise<any[]>;
  updateOrderStatus(id: string, status: string): Promise<void>;
  getCategories(): Promise<Category[]>;
  createCategory(category: Partial<Category>): Promise<void>;
  updateCategory(id: string, category: Partial<Category>): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  getReviews(productId: string): Promise<Review[]>;
  createReview(review: Partial<Review>): Promise<void>;
  getPriceSubscriptions(userId: string): Promise<any[]>;
  addPriceSubscription(sub: Partial<PriceSubscription>): Promise<void>;
  removePriceSubscription(userId: string, productId: string): Promise<void>;
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string, userId: string): Promise<void>;
  createNotification(notif: Partial<Notification>): Promise<void>;
  getAllUsers(): Promise<User[]>;
}
