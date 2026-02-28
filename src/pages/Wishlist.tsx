import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { useWishlist } from '../store/WishlistContext';
import { useCart } from '../store/CartContext';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';

export const Wishlist = () => {
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  return (
    <div className="bg-[#F9F7F5] min-h-screen pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="text-tiffany font-bold text-[10px] uppercase tracking-[0.3em] mb-4">Ваша колекція</div>
          <h1 className="text-5xl md:text-7xl font-serif font-bold text-slate-900 mb-6">Обране</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Предмети, які ви відклали для особливого моменту. Вони чекають, щоб стати частиною вашого дому.
          </p>
        </div>

        {wishlist.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {wishlist.map(product => (
              <div key={product.id} className="relative group">
                <ProductCard product={product} />
                <button 
                  onClick={() => removeFromWishlist(product.id)}
                  className="absolute top-4 right-16 z-20 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-all shadow-lg opacity-0 group-hover:opacity-100"
                  title="Видалити з обраного"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-slate-200">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-200">
              <Heart size={48} />
            </div>
            <h2 className="text-3xl font-serif font-bold text-slate-900 mb-4">Ваш список обраного порожній</h2>
            <p className="text-slate-500 mb-10 max-w-md mx-auto">
              Додавайте товари, які вам сподобались, щоб не загубити їх та повернутися до покупки пізніше.
            </p>
            <Link 
              to="/catalog" 
              className="inline-flex items-center gap-3 bg-slate-900 text-white px-10 py-5 rounded-2xl font-bold hover:bg-tiffany transition-all shadow-xl shadow-slate-900/10"
            >
              Перейти до каталогу <ArrowRight size={20} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
