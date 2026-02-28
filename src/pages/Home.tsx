import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Star, ShoppingBag, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { ProductCard } from '../components/ProductCard';
import { QuickView } from '../components/QuickView';
import { CategoryGrid } from '../components/CategoryGrid';
import { ReadySolutions } from '../components/ReadySolutions';
import { BonusSystem } from '../components/BonusSystem';
import { Newsletter } from '../components/Newsletter';
import { MOCK_PRODUCTS } from '../constants';
import { Product } from '../types';

export const Home = () => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const bestSellers = MOCK_PRODUCTS.filter(p => p.isPopular).slice(0, 4);

  return (
    <div className="bg-white pb-24">
      <Hero />
      
      <CategoryGrid />

      {/* Best Sellers */}
      <section className="py-24 bg-warm-bg overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-xl">
              <div className="text-tiffany font-bold text-[10px] uppercase tracking-[0.2em] mb-4">Наші бестселери</div>
              <h2 className="text-5xl font-serif font-bold text-slate-900 mb-6 leading-tight">Популярні серед <span className="text-tiffany italic">наших клієнтів</span></h2>
              <p className="text-slate-500 text-lg">Ці товари обирають найчастіше. Перевірена якість та бездоганний стиль для вашого дому.</p>
            </div>
            <Link to="/catalog" className="flex items-center gap-2 text-tiffany font-bold hover:underline underline-offset-8">
              Дивитись всі товари <ArrowRight size={20} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {bestSellers.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onQuickView={(p) => setSelectedProduct(p)}
              />
            ))}
          </div>
        </div>
      </section>

      <ReadySolutions />

      {/* Social Proof */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="relative">
              <div className="grid grid-cols-2 gap-6">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  className="aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl"
                >
                  <img src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80" alt="" className="w-full h-full object-cover" />
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl translate-y-12"
                >
                  <img src="https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=800&q=80" alt="" className="w-full h-full object-cover" />
                </motion.div>
              </div>
              
              {/* Floating Stats */}
              <div className="absolute -bottom-10 -left-10 bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-50 z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-tiffany/10 text-tiffany rounded-full flex items-center justify-center">
                    <Users size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">5,000+</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Задоволених клієнтів</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-gold">
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                </div>
              </div>
            </div>

            <div>
              <div className="text-tiffany font-bold text-[10px] uppercase tracking-[0.2em] mb-4">Чому обирають нас</div>
              <h2 className="text-5xl font-serif font-bold text-slate-900 mb-10 leading-tight">Ми створюємо простір, де <span className="text-tiffany italic">хочеться жити</span></h2>
              
              <div className="space-y-8">
                {[
                  { title: 'Якість понад усе', desc: 'Кожен виріб проходить ретельну перевірку перед відправкою.', icon: <CheckCircle2 size={24} /> },
                  { title: 'Швидка доставка', desc: 'Відправляємо ваші замовлення протягом 24 годин Новою Поштою.', icon: <TrendingUp size={24} /> },
                  { title: 'Ексклюзивний дизайн', desc: 'Більшість наших товарів — це унікальні знахідки, які ви не зустрінете в мас-маркеті.', icon: <Star size={24} /> }
                ].map((item, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-6"
                  >
                    <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-xl shadow-slate-900/10">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                      <p className="text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <BonusSystem />
      <Newsletter />
      
      <QuickView 
        product={selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />
    </div>
  );
};
