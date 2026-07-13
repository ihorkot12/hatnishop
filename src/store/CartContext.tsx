import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { CartItem, Product } from '../types';
import { useAuth } from './AuthContext';
import { fetchJsonCachedOr } from '../utils/apiCache';

export interface BundleOffer {
  id: string;
  title: string;
  productIds: string[];
  discountRate: number;
  createdAt: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  addBundleToCart: (products: Product[], options?: { title?: string; discountRate?: number }) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  clearBundleOffer: () => void;
  totalItems: number;
  totalPrice: number;
  activeBundleOffer: BundleOffer | null;
  bundleDiscount: number;
  userBonuses: number;
  applyBonuses: (amount: number) => void;
  appliedBonuses: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('cart');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const { user } = useAuth();
  const [appliedBonuses, setAppliedBonuses] = useState(0);
  const [activeBundleOffer, setActiveBundleOffer] = useState<BundleOffer | null>(() => {
    try {
      const saved = localStorage.getItem('activeBundleOffer');
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed && Array.isArray(parsed.productIds) ? parsed : null;
    } catch {
      return null;
    }
  });

  const userBonuses = user?.bonuses || 0;

  useEffect(() => {
    if (cart.length === 0) return;

    let cancelled = false;
    fetchJsonCachedOr<Product[]>('/api/products/catalog', [])
      .then((products: Product[]) => {
        if (cancelled || !Array.isArray(products)) return;
        const availableProducts = new Map(products.map(product => [product.id, product]));

        setCart(prev => {
          const next = prev
            .map(item => {
              const liveProduct = availableProducts.get(item.id);
              if (!liveProduct) return item;
              if (Number(liveProduct.stock || 0) < 1) return null;

              return {
                ...liveProduct,
                quantity: Math.min(item.quantity, Number(liveProduct.stock || item.quantity)),
              };
            })
            .filter(Boolean) as CartItem[];

          return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (activeBundleOffer) {
      localStorage.setItem('activeBundleOffer', JSON.stringify(activeBundleOffer));
    } else {
      localStorage.removeItem('activeBundleOffer');
    }
  }, [activeBundleOffer]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const addBundleToCart = (products: Product[], options: { title?: string; discountRate?: number } = {}) => {
    const availableProducts = products.filter(product => product && Number(product.stock || 0) > 0);
    const uniqueProducts = Array.from(new Map(availableProducts.map(product => [product.id, product])).values()).slice(0, 8);
    if (uniqueProducts.length < 2) return;

    setCart(prev => {
      let next = [...prev];
      for (const product of uniqueProducts) {
        const existing = next.find(item => item.id === product.id);
        if (existing) {
          next = next.map(item =>
            item.id === product.id
              ? { ...item, quantity: Math.min(Number(product.stock || item.quantity + 1), item.quantity + 1) }
              : item
          );
        } else {
          next.push({ ...product, quantity: 1 });
        }
      }
      return next;
    });

    setActiveBundleOffer({
      id: `bundle-${Date.now()}`,
      title: options.title || 'Персональний набір',
      productIds: uniqueProducts.map(product => product.id),
      discountRate: Math.min(0.18, Math.max(0.05, Number(options.discountRate || 0.12))),
      createdAt: new Date().toISOString(),
    });
  };

  const applyBonuses = (amount: number) => {
    if (amount <= userBonuses) {
      setAppliedBonuses(amount);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
    setActiveBundleOffer(prev => prev?.productIds.includes(productId) ? null : prev);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.id === productId ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedBonuses(0);
    setActiveBundleOffer(null);
  };

  const clearBundleOffer = () => {
    setActiveBundleOffer(null);
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const bundleDiscount = useMemo(() => {
    if (!activeBundleOffer) return 0;
    const productIds = Array.from(new Set(activeBundleOffer.productIds)).slice(0, 8);
    if (productIds.length < 2) return 0;

    let eligibleTotal = 0;
    for (const productId of productIds) {
      const item = cart.find(cartItem => cartItem.id === productId && cartItem.quantity > 0);
      if (!item) return 0;
      eligibleTotal += Number(item.price || 0);
    }

    return Math.max(0, Math.round(eligibleTotal * activeBundleOffer.discountRate));
  }, [activeBundleOffer, cart]);

  return (
    <CartContext.Provider value={{ 
      cart, 
      addToCart, 
      addBundleToCart,
      removeFromCart, 
      updateQuantity, 
      clearCart, 
      clearBundleOffer,
      totalItems, 
      totalPrice,
      activeBundleOffer,
      bundleDiscount,
      userBonuses,
      applyBonuses,
      appliedBonuses
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
