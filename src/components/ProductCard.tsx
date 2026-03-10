import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Heart, Star, Eye } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../store/CartContext';
import { useWishlist } from '../store/WishlistContext';
import { Link } from 'react-router-dom';

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onQuickView }) => {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const isWishlisted = isInWishlist(product.id);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -10 }}
      className="group relative bg-white rounded-[2.5rem] overflow-hidden transition-all duration-700 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.12)] border border-slate-100"
    >
      <Link to={`/product/${product.id}`} className="block aspect-square overflow-hidden relative">
        <img 
          src={product.image} 
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-125"
          referrerPolicy="no-referrer"
        />
        
        {/* Badges */}
        <div className="absolute top-6 left-6 flex flex-col gap-2">
          {product.isPopular && (
            <div className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] shadow-xl">
              Top Choice
            </div>
          )}
          {product.stock < 5 && (
            <div className="bg-red-500 text-white px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] shadow-xl animate-pulse">
              Залишилось {product.stock} шт
            </div>
          )}
        </div>

        {/* Quick Actions Overlay */}
        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors duration-500 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100">
          <button 
            onClick={(e) => {
              e.preventDefault();
              addToCart(product);
            }}
            className="w-14 h-14 bg-white text-slate-900 rounded-2xl flex items-center justify-center hover:bg-tiffany hover:text-white transition-all shadow-2xl scale-90 group-hover:scale-100 duration-500"
            title="Додати в кошик"
          >
            <ShoppingCart size={20} strokeWidth={1.5} />
          </button>
          {onQuickView && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                onQuickView(product);
              }}
              className="w-14 h-14 bg-white text-slate-900 rounded-2xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-2xl scale-90 group-hover:scale-100 duration-500 delay-75"
              title="Швидкий перегляд"
            >
              <Eye size={20} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </Link>

      <div className="p-8">
        <div className="flex justify-between items-start mb-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-tiffany font-bold">
            {product.category}
          </div>
          <div className="flex items-center gap-1 text-gold">
            <Star size={12} fill="currentColor" />
            <span className="text-[10px] font-bold text-slate-900">{product.rating || '5.0'}</span>
            <span className="text-[10px] text-slate-400">({product.reviewCount || 0})</span>
          </div>
        </div>

        <Link to={`/product/${product.id}`} className="block text-2xl font-serif text-slate-900 mb-6 hover:text-tiffany transition-colors duration-300 leading-tight">
          {product.name}
        </Link>

        <div className="flex items-center justify-between pt-6 border-t border-slate-50">
          <div className="text-2xl font-bold text-slate-900">
            {product.price} <span className="text-xs font-normal text-slate-400 ml-1">грн</span>
          </div>
          <button 
            onClick={(e) => {
              e.preventDefault();
              toggleWishlist(product);
            }}
            className={`transition-all duration-300 ${isWishlisted ? 'text-pink-500' : 'text-slate-300 hover:text-pink-500'}`}
          >
            <Heart size={20} strokeWidth={1.5} fill={isWishlisted ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
