import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Star, ShieldCheck, Truck, RotateCcw, Bell, Heart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useWishlist } from '../store/WishlistContext';

interface QuickViewProps {
  product: Product | null;
  onClose: () => void;
}

export const QuickView: React.FC<QuickViewProps> = ({ product, onClose }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (product) {
      setSelectedImage(product.image);
      setIsExpanded(false);
    }
  }, [product]);

  useEffect(() => {
    if (user && product) {
      fetch('/api/subscriptions/price-drop')
        .then(res => res.json())
        .then(data => {
          setIsSubscribed(data.some((s: any) => s.product_id === product.id));
        });
    }
  }, [user, product]);

  const toggleSubscription = async () => {
    if (!user || !product) return;
    setSubscribing(true);
    try {
      if (isSubscribed) {
        await fetch(`/api/subscriptions/price-drop/${product.id}`, { method: 'DELETE' });
        setIsSubscribed(false);
      } else {
        await fetch('/api/subscriptions/price-drop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, currentPrice: product.price }),
        });
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubscribing(false);
    }
  };

  if (!product) return null;

  const isWishlisted = isInWishlist(product.id);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-4xl bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col md:flex-row"
        >
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 z-10 w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-lg"
          >
            <X size={24} />
          </button>

          <div className="md:w-1/2 flex flex-col">
            <div className="aspect-square overflow-hidden">
              <img src={selectedImage || product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex gap-2 p-4 overflow-x-auto bg-slate-50">
              <div 
                onClick={() => setSelectedImage(product.image)}
                className={`w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer shrink-0 ${selectedImage === product.image ? 'border-tiffany' : 'border-transparent'}`}
              >
                <img src={product.image} className="w-full h-full object-cover" alt="" />
              </div>
              {product.images && product.images.map((img, i) => (
                <div 
                  key={i}
                  onClick={() => setSelectedImage(img)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer shrink-0 ${selectedImage === img ? 'border-tiffany' : 'border-transparent'}`}
                >
                  <img src={img} className="w-full h-full object-cover" alt="" />
                </div>
              ))}
            </div>
          </div>

          <div className="md:w-1/2 p-12 flex flex-col">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-tiffany font-bold text-[10px] uppercase tracking-widest">{product.category}</span>
              <div className="flex items-center gap-1 text-gold">
                <Star size={14} fill="currentColor" />
                <span className="text-slate-900 font-bold text-sm">{product.rating || '5.0'}</span>
              </div>
            </div>

            <h2 className="text-3xl font-serif font-bold text-slate-900 mb-4">{product.name}</h2>
            <div className="text-2xl font-bold text-slate-900 mb-6">{product.price} грн</div>
            
            <div className="relative mb-8">
              <p className={`text-slate-500 leading-relaxed transition-all duration-300 ${isExpanded ? '' : 'line-clamp-3'}`}>
                {product.description}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-tiffany font-bold text-[10px] uppercase tracking-wider hover:underline"
                >
                  {isExpanded ? 'Згорнути' : 'Читати повністю'}
                </button>
                <Link 
                  to={`/product/${product.id}`}
                  onClick={onClose}
                  className="text-slate-400 font-bold text-[10px] uppercase tracking-wider hover:text-slate-900 flex items-center gap-1"
                >
                  Сторінка товару <ArrowRight size={10} />
                </Link>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <Truck size={16} className="text-tiffany" />
                <span>Безкоштовна доставка від 1500 грн</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <ShieldCheck size={16} className="text-tiffany" />
                <span>Гарантія якості та перевірка перед відправкою</span>
              </div>
            </div>

            <div className="mt-auto flex gap-4">
              <button 
                onClick={() => {
                  addToCart(product);
                  onClose();
                }}
                className="flex-1 bg-slate-900 text-white h-14 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-tiffany transition-all shadow-xl shadow-slate-900/10"
              >
                <ShoppingCart size={20} /> Додати в кошик
              </button>
              <button 
                onClick={() => toggleWishlist(product)}
                className={`w-14 h-14 border rounded-2xl flex items-center justify-center transition-all ${isWishlisted ? 'bg-pink-50 text-pink-500 border-pink-200' : 'border-slate-200 text-slate-400 hover:text-pink-500 hover:border-pink-200'}`}
              >
                <Heart size={20} fill={isWishlisted ? "currentColor" : "none"} />
              </button>
              <button 
                onClick={toggleSubscription}
                disabled={subscribing}
                className={`w-14 h-14 border rounded-2xl flex items-center justify-center transition-all ${isSubscribed ? 'bg-tiffany/10 text-tiffany border-tiffany/20' : 'border-slate-200 text-slate-400 hover:text-tiffany hover:border-tiffany'}`}
                title={isSubscribed ? "Скасувати сповіщення" : "Сповістити про зниження ціни"}
              >
                <Bell size={20} fill={isSubscribed ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
