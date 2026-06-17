import React from 'react';
import { motion } from 'framer-motion';
import { Eye, Heart, ShoppingCart, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { useCart } from '../store/CartContext';
import { useWishlist } from '../store/WishlistContext';

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

const formatPrice = (value: number | string) => `${Number(value || 0).toLocaleString('uk-UA')} грн`;

export const ProductCard: React.FC<ProductCardProps> = ({ product, onQuickView }) => {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const isWishlisted = isInWishlist(product.id);
  const stock = Number(product.stock || 0);
  const isLowStock = stock > 0 && stock < 5;
  const isAvailable = stock > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow duration-500 hover:shadow-2xl hover:shadow-slate-950/10"
    >
      <Link to={`/product/${product.id}`} className="relative block aspect-[4/5] overflow-hidden bg-[#f4f0ea] hover:no-underline">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          referrerPolicy="no-referrer"
        />

        <div className="absolute left-4 top-4 flex flex-col gap-2">
          {product.isPopular && (
            <span className="rounded-md bg-slate-950 px-3 py-1 text-[10px] font-bold uppercase text-white">
              Вибір покупців
            </span>
          )}
          {isLowStock && (
            <span className="rounded-md bg-white px-3 py-1 text-[10px] font-bold uppercase text-red-600 shadow-sm">
              Лишилось {stock} шт
            </span>
          )}
          {!isAvailable && (
            <span className="rounded-md bg-white px-3 py-1 text-[10px] font-bold uppercase text-slate-500 shadow-sm">
              Немає в наявності
            </span>
          )}
        </div>

        <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              if (isAvailable) addToCart(product);
            }}
            disabled={!isAvailable}
            aria-label={`Додати ${product.name} у кошик`}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-950 shadow-lg transition-colors hover:bg-tiffany hover:text-white disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <ShoppingCart size={19} strokeWidth={1.7} />
          </button>
          {onQuickView && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onQuickView(product);
              }}
              aria-label={`Швидко переглянути ${product.name}`}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-950 shadow-lg transition-colors hover:bg-slate-950 hover:text-white"
            >
              <Eye size={19} strokeWidth={1.7} />
            </button>
          )}
        </div>
      </Link>

      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="truncate text-[11px] font-bold uppercase text-slate-400">{product.category}</span>
          <span className="flex items-center gap-1 text-xs font-bold text-slate-700">
            <Star size={13} fill="currentColor" className="text-gold" />
            {Number(product.rating || 5).toFixed(1)}
          </span>
        </div>

        <Link
          to={`/product/${product.id}`}
          className="line-clamp-2 min-h-[3.25rem] text-xl font-serif font-bold leading-tight text-slate-950 transition-colors hover:text-tiffany hover:no-underline"
        >
          {product.name}
        </Link>

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div>
            <div className="text-xl font-bold text-slate-950">{formatPrice(product.price)}</div>
            {product.bonusPoints ? (
              <div className="mt-1 text-[11px] font-bold text-emerald-600">+{product.bonusPoints} бонусів</div>
            ) : (
              <div className="mt-1 text-[11px] text-slate-400">Доставка по Україні</div>
            )}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              toggleWishlist(product);
            }}
            aria-label={isWishlisted ? `Прибрати ${product.name} з обраного` : `Додати ${product.name} в обране`}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
              isWishlisted
                ? 'border-pink-200 bg-pink-50 text-pink-500'
                : 'border-slate-200 text-slate-400 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500'
            }`}
          >
            <Heart size={18} strokeWidth={1.7} fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </motion.article>
  );
};
