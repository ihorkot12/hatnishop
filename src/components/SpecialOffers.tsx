import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Gift, ShoppingBag, Sparkles, Tag, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../store/CartContext';
import { isBundleProduct } from '../utils/productFlags';
import { fetchJsonCachedOr } from '../utils/apiCache';

export const SpecialOffers = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [promos, setPromos] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchJsonCachedOr<any[]>('/api/bonus-codes', [])
      .then((data) => {
        if (!Array.isArray(data)) return;
        setPromos(data.filter((code) => code.is_active && code.type === 'promo' && code.show_in_site));
        setOffers(data.filter((code) => code.is_active && code.type === 'offer' && code.show_in_site));
      })
      .catch((error) => console.error(error));

    fetchJsonCachedOr<any[]>('/api/products/catalog', [])
      .then((data) => {
        if (Array.isArray(data)) {
          setBundles(data.filter((product) => isBundleProduct(product)).slice(0, 4));
        }
      })
      .catch((error) => console.error(error));
  }, []);

  const hasContent = promos.length > 0 || offers.length > 0 || bundles.length > 0;

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(''), 1800);
    } catch {
      setCopiedCode('');
    }
  };

  if (!hasContent) return null;

  return (
    <>
      <motion.button
        type="button"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setIsOpen(true)}
        aria-label="Відкрити акції та набори"
        className="fixed right-3 top-36 z-40 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white shadow-xl shadow-slate-950/20 transition-colors hover:bg-tiffany sm:bottom-6 sm:left-6 sm:right-auto sm:top-auto sm:h-12 sm:w-auto sm:gap-2 sm:px-4"
      >
        <Gift size={18} />
        <span className="hidden sm:inline">Акції</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-cream shadow-2xl"
            >
              <header className="flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
                <div>
                  <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-950">
                    <Sparkles className="text-tiffany" size={22} />
                    Акції та набори
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">Промокоди, добірки й бонусна програма в одному місці.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Закрити акції"
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950"
                >
                  <X size={22} />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                {offers.length > 0 && (
                  <section className="mb-8">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                      <Sparkles size={14} /> Спеціальні пропозиції
                    </h3>
                    <div className="space-y-3">
                      {offers.map((offer, index) => (
                        <div key={`${offer.id || offer.title}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="font-bold text-slate-950">{offer.title}</div>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{offer.description}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="mb-8">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                    <Tag size={14} /> Промокоди
                  </h3>
                  <div className="space-y-3">
                    {promos.map((promo, index) => (
                      <div key={`${promo.id || promo.code}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-slate-200 bg-white p-4">
                        <div className="min-w-0">
                          <div className="text-xs font-bold uppercase text-tiffany">{promo.code}</div>
                          <div className="mt-1 font-bold text-slate-950">{promo.title || 'Промокод на знижку'}</div>
                          <p className="mt-1 text-sm leading-5 text-slate-500">{promo.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyCode(promo.code)}
                          className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold uppercase text-slate-600 transition-colors hover:border-tiffany hover:text-tiffany"
                        >
                          {copiedCode === promo.code ? <Check size={16} /> : 'Копіювати'}
                        </button>
                      </div>
                    ))}
                    {promos.length === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                        Активних промокодів зараз немає.
                      </div>
                    )}
                  </div>
                </section>

                {bundles.length > 0 && (
                  <section className="mb-8">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                      <ShoppingBag size={14} /> Готові набори
                    </h3>
                    <div className="space-y-4">
                      {bundles.map((bundle) => (
                        <div key={bundle.id} className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="grid grid-cols-[88px_1fr] gap-4">
                            <img src={bundle.image || undefined} alt={bundle.name} loading="lazy" decoding="async" className="h-[88px] w-[88px] rounded-lg object-cover" referrerPolicy="no-referrer" />
                            <div className="min-w-0">
                              <h4 className="line-clamp-2 font-bold text-slate-950">{bundle.name}</h4>
                              <div className="mt-2 font-bold text-tiffany">{bundle.price} грн</div>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <Link
                              to={`/product/${bundle.id}`}
                              onClick={() => setIsOpen(false)}
                              className="rounded-lg bg-slate-100 py-3 text-center text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 hover:no-underline"
                            >
                              Детальніше
                            </Link>
                            <button
                              type="button"
                              onClick={() => addToCart(bundle)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 py-3 text-sm font-bold text-white transition-colors hover:bg-tiffany"
                            >
                              В кошик <ArrowRight size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <div className="rounded-lg bg-slate-950 p-5 text-white">
                  <h4 className="text-xl font-bold">Бонусна програма</h4>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Накопичуйте бонуси за покупки та використовуйте їх для наступних замовлень після підтвердження оплати.
                  </p>
                  <Link
                    to="/catalog"
                    onClick={() => setIsOpen(false)}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-tiffany hover:no-underline"
                  >
                    Перейти до каталогу <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
