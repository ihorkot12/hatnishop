import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, ShoppingCart, Sparkles, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../store/CartContext';

interface HeroProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  featuredProduct?: any;
  loading?: boolean;
}

const DEFAULT_TITLE = 'Естетичний посуд та декор для дому';
const DEFAULT_SUBTITLE = 'Інтернет-магазин "Хатні Штучки" - добірка кераміки, текстилю та домашніх аксесуарів, які додають оселі тепла без зайвого візуального шуму.';
const HIGHLIGHT = 'декор для дому';

const renderTitle = (value?: string) => {
  const text = value || DEFAULT_TITLE;
  const index = text.toLowerCase().indexOf(HIGHLIGHT);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <span className="italic text-tiffany">{text.slice(index, index + HIGHLIGHT.length)}</span>
      {text.slice(index + HIGHLIGHT.length)}
    </>
  );
};

export const Hero = ({ title, subtitle, badge, featuredProduct: propProduct, loading }: HeroProps) => {
  const { addToCart } = useCart();
  const featuredProduct = propProduct || null;

  return (
    <section className="relative overflow-hidden bg-[#f8f4ef]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.65)_0%,rgba(255,255,255,0)_56%)]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.92fr] gap-10 lg:gap-16 items-center min-h-[calc(100vh-150px)]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 rounded-lg border border-tiffany/20 bg-white/70 px-4 py-2 text-[11px] font-bold uppercase text-tiffany">
              <Star size={14} fill="currentColor" />
              <span>{badge || (loading ? 'Завантаження...' : 'Бестселер сезону')}</span>
            </div>

            <h1 className="mt-8 text-5xl sm:text-6xl lg:text-7xl font-serif font-bold text-slate-950 leading-none tracking-normal">
              {loading ? (
                <span className="block h-32 max-w-xl animate-pulse rounded-lg bg-white/70" />
              ) : (
                renderTitle(title)
              )}
            </h1>

            <div className="mt-7 max-w-2xl text-lg sm:text-xl leading-8 text-slate-600">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-4 w-full animate-pulse rounded bg-white/80" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-white/80" />
                </div>
              ) : (
                subtitle || DEFAULT_SUBTITLE
              )}
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center gap-3 rounded-lg bg-slate-950 px-7 py-4 font-bold text-white shadow-lg shadow-slate-950/15 transition-colors hover:bg-tiffany"
              >
                До каталогу <ArrowRight size={20} />
              </Link>
              <Link
                to="/catalog?category=bundles"
                className="inline-flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-7 py-4 font-bold text-slate-950 transition-colors hover:border-tiffany hover:text-tiffany"
              >
                Готові набори <Sparkles size={18} />
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-600">
              {['Відправка по Україні', 'Бонуси за покупки', 'Живі фото товарів'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg border border-white/70 bg-white/55 px-4 py-3">
                  <ShieldCheck size={16} className="text-tiffany" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
            className="relative"
          >
            <div className="overflow-hidden rounded-lg border border-white/80 bg-white shadow-2xl shadow-slate-900/10">
              <div className="relative aspect-[4/5] bg-slate-100">
                {featuredProduct ? (
                  <img
                    src={featuredProduct.image}
                    alt={featuredProduct.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-slate-200" />
                )}
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-4 p-5 sm:p-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Товар дня</p>
                  <h2 className="mt-1 truncate text-lg font-bold text-slate-950">
                    {featuredProduct?.name || 'Добірка для затишної кухні'}
                  </h2>
                  <div className="mt-2 text-2xl font-bold text-tiffany">
                    {featuredProduct?.price || 0} <span className="text-sm font-medium text-slate-400">грн</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => featuredProduct && addToCart(featuredProduct as any)}
                  disabled={!featuredProduct}
                  aria-label="Додати товар дня у кошик"
                  className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-950 text-white transition-colors hover:bg-tiffany disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <ShoppingCart size={22} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
