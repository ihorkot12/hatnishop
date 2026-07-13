import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, ShoppingCart, Sparkles } from 'lucide-react';
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
      <span className="italic text-tiffany-deep">{text.slice(index, index + HIGHLIGHT.length)}</span>
      {text.slice(index + HIGHLIGHT.length)}
    </>
  );
};

export const Hero = ({ title, subtitle, badge, featuredProduct: propProduct, loading }: HeroProps) => {
  const { addToCart } = useCart();
  const featuredProduct = propProduct || null;

  return (
    <section className="relative overflow-hidden bg-cream">
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid min-h-[calc(100vh-190px)] grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.85fr] lg:gap-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">
              <span aria-hidden="true" className="h-px w-12 bg-gold" />
              <span>{badge || (loading ? 'Завантаження...' : 'Бестселер сезону')}</span>
            </div>

            <h1 className="mt-9 font-serif text-5xl font-bold leading-[0.98] tracking-tight text-slate-950 sm:text-7xl lg:text-[5.5rem]">
              {loading ? (
                <span className="block h-32 max-w-xl animate-pulse rounded-lg bg-white/70" />
              ) : (
                renderTitle(title)
              )}
            </h1>

            <div className="mt-8 max-w-xl text-lg leading-8 text-slate-600">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-4 w-full animate-pulse rounded bg-white/80" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-white/80" />
                </div>
              ) : (
                subtitle || DEFAULT_SUBTITLE
              )}
            </div>

            <div className="mt-11 flex flex-wrap items-center gap-7">
              <Link
                to="/catalog"
                className="group inline-flex items-center justify-center gap-3 rounded-lg bg-slate-950 px-9 py-4 font-bold text-white transition-colors hover:bg-slate-800 hover:no-underline"
              >
                До каталогу <ArrowRight size={19} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/bundle-builder"
                className="group inline-flex items-center gap-2 border-b border-slate-300 pb-1 text-sm font-bold uppercase tracking-widest text-slate-700 transition-colors hover:border-gold hover:text-slate-950 hover:no-underline"
              >
                Зібрати свій набір · −12% <Sparkles size={15} className="text-gold" />
              </Link>
            </div>

            <div className="mt-14 flex flex-col gap-4 border-t border-slate-900/10 pt-7 text-sm text-slate-600 sm:flex-row sm:items-center sm:gap-10">
              {['Безкоштовна доставка від 1500 грн', '5% кешбек на кожну покупку', 'Гарантія якості на кожен товар'].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <ShieldCheck size={15} className="shrink-0 text-tiffany-deep" />
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
            <div className="absolute -left-6 top-10 hidden h-[70%] w-px bg-slate-900/10 lg:block" />
            <div className="overflow-hidden rounded-lg border border-slate-900/10 bg-white shadow-xl shadow-slate-950/5">
              <div className="relative aspect-[4/5] bg-slate-100">
                {featuredProduct ? (
                  <img
                    src={featuredProduct.image || undefined}
                    alt={featuredProduct.name}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    className="h-full w-full object-cover object-[center_bottom]"
                    referrerPolicy="no-referrer"
                  />
                ) : loading ? (
                  <div className="h-full w-full animate-pulse bg-slate-200" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-cream-dark">
                    <span className="font-serif text-5xl font-bold uppercase text-slate-300">Hatni</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-4 p-5 sm:p-6">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    <span aria-hidden="true" className="h-px w-5 bg-gold" /> Товар дня
                  </p>
                  <h2 className="mt-2 truncate font-serif text-xl font-bold text-slate-950">
                    {featuredProduct?.name || 'Добірка для затишної кухні'}
                  </h2>
                  <div className="mt-2 text-2xl font-bold text-slate-950">
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
