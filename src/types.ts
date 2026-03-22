export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  material?: string;
  brand?: string;
  isPopular?: boolean;
  isBundle?: boolean;
  bundleItems?: string[];
  bonusPoints?: number;
  stock: number;
  rating: number;
  reviewCount: number;
  aiDescription?: string;
  images?: string[];
  cost_price?: number;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  slug: string;
  parent_id?: string | null;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  discount: number;
  bonusUsed: number;
  finalTotal: number;
  customer: {
    name: string;
    phone: string;
    address: string;
    deliveryMethod: 'nova-poshta' | 'ukr-poshta';
    city: string;
    warehouse: string;
  };
  paymentMethod: 'mono' | 'liqpay' | 'cash';
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
  createdAt: string;
  comment?: string;
  trackingNumber?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  bonuses: number;
  total_spent: number;
  avatar?: string;
  role?: 'user' | 'admin';
  isDegraded?: boolean;
}

export type User = UserProfile;

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  is_approved: number;
  created_at: string;
}
