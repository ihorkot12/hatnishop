import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, ArrowRight, Tag, Sparkles, ShoppingBag } from 'lucide-react';
import { MOCK_PRODUCTS } from '../constants';
import { useCart } from '../store/CartContext';
import { Link } from 'react-router-dom';

export const SpecialOffers = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [promos, setPromos] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const { addToCart } = useCart();

  useEffect(() => {
    // Fetch bonus codes
    fetch('/api/bonus-codes')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Show promo codes only if show_in_site is true
          setPromos(data.filter(bc => bc.is_active && bc.type === 'promo' && bc.show_in_site));
          // Show offers (info) always if active (assuming info type is inherently for display)
          // Or we can also respect show_in_site for info type if we want full control
          setOffers(data.filter(bc => bc.is_active && bc.type === 'offer' && bc.show_in_site));
        }
      })
      .catch(err => console.error(err));

    // Fetch products for bundles
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBundles(data.filter(p => p.isBundle));
        }
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <>
      {/* Floating Trigger Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 left-8 z-40 bg-slate-900 text-white p-5 rounded-full shadow-2xl flex items-center gap-3 group overflow-hidden"
      >
        <div className="relative z-10 flex items-center gap-3">
          <Gift className="group-hover:rotate-12 transition-transform" />
          <span className="font-bold text-sm hidden md:block">Акції та набори</span>
        </div>
        <motion.div 
          className="absolute inset-0 bg-tiffany opacity-0 group-hover:opacity-100 transition-opacity"
          initial={false}
        />
      </motion.button>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-warm-bg z-50 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="text-tiffany" size={24} /> Спеціальні пропозиції
                  </h2>
                  <p className="text-slate-400 text-sm">Ваш затишок за вигідною ціною</p>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                {/* Special Offers (Informational) */}
                {offers.length > 0 && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                      <Sparkles size={14} /> Спеціальні пропозиції
                    </h3>
                    <div className="space-y-4">
                      {offers.map((offer, i) => (
                        <div key={i} className="relative group">
                          <div className="absolute inset-0 bg-emerald-500 opacity-5 rounded-2xl blur-xl group-hover:opacity-10 transition-opacity" />
                          <div className="relative bg-white border border-slate-100 p-6 rounded-2xl">
                            <div className="text-slate-900 font-bold text-sm mb-1">{offer.title}</div>
                            <div className="text-slate-500 text-xs">{offer.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Promo Codes */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                    <Tag size={14} /> Промокоди на знижку
                  </h3>
                  <div className="space-y-4">
                    {promos.map((promo, i) => (
                      <div key={i} className="relative group">
                        <div className={`absolute inset-0 bg-tiffany opacity-10 rounded-2xl blur-xl group-hover:opacity-20 transition-opacity`} />
                        <div className="relative bg-white border border-slate-100 p-6 rounded-2xl flex items-center justify-between">
                          <div>
                            <div className={`text-xs font-bold uppercase tracking-widest mb-1 text-tiffany`}>
                              {promo.code}
                            </div>
                            <div className="text-slate-900 font-bold text-sm mb-1">{promo.title}</div>
                            <div className="text-slate-500 text-xs">{promo.description}</div>
                          </div>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(promo.code);
                              // Could add a toast here
                            }}
                            className="text-[10px] font-bold uppercase tracking-tighter text-slate-400 hover:text-tiffany transition-colors"
                          >
                            Копіювати
                          </button>
                        </div>
                      </div>
                    ))}
                    {promos.length === 0 && (
                      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Tag size={24} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-slate-400 text-xs">Наразі активних промокодів немає</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Bundles */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                    <ShoppingBag size={14} /> Готові набори
                  </h3>
                  <div className="space-y-6">
                    {bundles.map(bundle => (
                      <div key={bundle.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex gap-5 mb-6">
                          <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0">
                            <img src={bundle.image} alt={bundle.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 mb-1">{bundle.name}</h4>
                            <div className="text-tiffany font-bold text-lg">{bundle.price} грн</div>
                            <div className="text-xs text-slate-400 line-through">{(bundle.price * 1.15).toFixed(0)} грн</div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Link 
                            to={`/product/${bundle.id}`}
                            onClick={() => setIsOpen(false)}
                            className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl text-center text-sm font-bold hover:bg-slate-100 transition-colors"
                          >
                            Детальніше
                          </Link>
                          <button 
                            onClick={() => addToCart(bundle)}
                            className="flex-1 bg-tiffany text-white py-3 rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
                          >
                            В кошик <ArrowRight size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Bonus Info */}
                <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
                  <div className="relative z-10">
                    <h4 className="font-bold text-xl mb-2">Бонусна програма</h4>
                    <p className="text-white/60 text-sm mb-6 leading-relaxed">
                      Отримуйте 5% кешбеку з кожного замовлення та витрачайте їх на нові покупки.
                    </p>
                    <Link 
                      to="/catalog" 
                      onClick={() => setIsOpen(false)}
                      className="text-tiffany font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all"
                    >
                      Дізнатись більше <ArrowRight size={16} />
                    </Link>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-tiffany/20 rounded-full blur-2xl" />
                </div>
              </div>

              {/* Footer */}
              <div className="p-8 bg-white border-t border-slate-100">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-tiffany transition-all"
                >
                  Продовжити покупки
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
