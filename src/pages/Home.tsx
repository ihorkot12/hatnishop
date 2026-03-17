import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Star, ShoppingBag, TrendingUp, Users, CheckCircle2, Sparkles } from 'lucide-react';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [siteSettings, setSiteSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Хатні Штучки — Естетичні товари для дому та затишку | Купити посуд, декор, текстиль";
    
    Promise.all([
      fetch('/api/products').then(res => res.json()),
      fetch('/api/site-settings').then(res => res.json())
    ]).then(([productsData, settingsData]) => {
      setProducts(productsData);
      setSiteSettings(settingsData);
      setLoading(false);
    });
  }, []);

  const bestSellers = products.filter(p => p.isPopular).slice(0, 4);
  const featuredProduct = products.find(p => p.id === siteSettings?.hero_featured_product_id);

  return (
    <div className="bg-white pb-24">
      <Hero 
        title={siteSettings?.hero_title}
        subtitle={siteSettings?.hero_subtitle}
        badge={siteSettings?.hero_badge}
        featuredProduct={featuredProduct}
      />
      
      <CategoryGrid />

      {/* Best Sellers */}
      <section className="py-24 bg-warm-bg overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-xl">
              <div className="text-tiffany font-bold text-[10px] uppercase tracking-[0.2em] mb-4">Наші бестселери</div>
              <h2 className="text-5xl font-serif font-bold text-slate-900 mb-6 leading-tight">Популярні товари для <span className="text-tiffany italic">вашого затишку</span></h2>
              <p className="text-slate-500 text-lg">Обирайте найкращий посуд та декор, який став фаворитом наших покупців. Кожна річ у каталозі "Хатні Штучки" — це поєднання естетики та функціональності.</p>
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
              <h2 className="text-5xl font-serif font-bold text-slate-900 mb-10 leading-tight">Створюємо простір, де <span className="text-tiffany italic">панує гармонія</span></h2>
              
              <div className="space-y-8">
                {[
                  { title: 'Якісний посуд та декор', desc: 'Ми ретельно відбираємо кожен предмет, щоб ви могли купити посуд найвищої якості, який слугуватиме роками.', icon: <CheckCircle2 size={24} /> },
                  { title: 'Доставка по всій Україні', desc: 'Швидка відправка замовлень Новою Поштою у Київ, Львів, Одесу та будь-який інший куточок країни.', icon: <TrendingUp size={24} /> },
                  { title: 'Естетика та затишок', desc: 'Наш асортимент — це не просто речі, а інструменти для створення особливої атмосфери у вашій оселі.', icon: <Star size={24} /> }
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

      {/* Testimonials */}
      <section className="py-24 bg-warm-bg overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="text-tiffany font-bold text-[10px] uppercase tracking-[0.2em] mb-4">Відгуки наших клієнтів</div>
            <h2 className="text-5xl font-serif font-bold text-slate-900 mb-6">Що про нас <span className="text-tiffany italic">говорять</span></h2>
            <p className="text-slate-500 max-w-2xl mx-auto">Ваші емоції — наше головне натхнення. Ми вдячні кожному, хто ділиться частинкою свого затишку з нами.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Олена К.', city: 'Київ', text: 'Замовляла набір керамічного посуду. Якість просто неймовірна! Кожне горнятко — це витвір мистецтва. Окреме дякую за естетичне пакування.', rating: 5 },
              { name: 'Марина С.', city: 'Львів', text: 'Текстиль від Хатніх Штучок — це любов з першого дотику. Лляна скатертина ідеально вписалася в наш інтер\'єр. Буду замовляти ще!', rating: 5 },
              { name: 'Ірина В.', city: 'Одеса', text: 'Дуже швидка доставка та приємне спілкування. Товар приїхав надійно запакований, все ціле. Рекомендую всім, хто цінує затишок.', rating: 5 }
            ].map((review, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-50 relative"
              >
                <div className="flex gap-1 text-gold mb-6">
                  {[...Array(review.rating)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                </div>
                <p className="text-slate-600 italic mb-8 leading-relaxed">"{review.text}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-tiffany/10 rounded-full flex items-center justify-center text-tiffany font-bold">
                    {review.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{review.name}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{review.city}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-20 text-center">
            <div className="inline-flex items-center gap-4 p-2 bg-white rounded-2xl shadow-lg border border-slate-50">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-white overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <div className="pr-4">
                <span className="text-sm font-bold text-slate-900">Більше 500+ відгуків в Instagram</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Telegram Banner */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 rounded-[3rem] p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
              <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <path fill="#0088cc" d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.6,90,-16.3,88.5,-0.9C87,14.5,81.4,29,73.1,41.9C64.8,54.8,53.8,66.1,40.5,73.4C27.2,80.7,13.6,84,0.3,83.5C-13,83,-26.1,78.7,-38.9,71.8C-51.7,64.9,-64.3,55.4,-72.4,42.9C-80.5,30.4,-84.1,15.2,-83.7,0.2C-83.3,-14.8,-78.9,-29.6,-70.8,-42.1C-62.7,-54.6,-50.9,-64.8,-37.7,-72.5C-24.5,-80.2,-9.9,-85.4,3.1,-90.7C16.1,-96,30.6,-83.6,44.7,-76.4Z" transform="translate(100 100)" />
              </svg>
            </div>
            
            <div className="relative z-10 max-w-2xl text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-tiffany/20 text-tiffany px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                <Sparkles size={14} /> Наша спільнота
              </div>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6 leading-tight">
                Приєднуйтесь до нашого <span className="text-tiffany italic">Telegram-каналу</span>
              </h2>
              <p className="text-white/60 text-lg mb-8">
                Отримуйте доступ до ексклюзивних новинок, секретних розпродажів та натхнення для вашого дому кожного дня.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <a 
                  href="https://t.me/+gcAKeeKFKL43NjYy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-tiffany text-white px-10 py-5 rounded-2xl font-bold hover:bg-white hover:text-slate-900 transition-all shadow-xl shadow-tiffany/20 flex items-center gap-3"
                >
                  Підписатись на канал <ArrowRight size={20} />
                </a>
                <div className="text-white/40 text-sm font-medium">
                  Вже понад 1,200 підписників
                </div>
              </div>
            </div>

            <div className="relative z-10 w-full md:w-auto flex justify-center">
              <div className="w-64 h-64 bg-white/5 rounded-[2.5rem] border border-white/10 flex items-center justify-center backdrop-blur-sm rotate-6 hover:rotate-0 transition-transform duration-500">
                <div className="text-center">
                  <div className="w-20 h-20 bg-tiffany rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-tiffany/40">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
                      <path d="m22 2-7 20-4-9-9-4Z" />
                      <path d="M22 2 11 13" />
                    </svg>
                  </div>
                  <div className="text-white font-bold">@hatni_shtuchky</div>
                  <div className="text-white/40 text-xs">Новинки щодня</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Newsletter />
      
      <QuickView 
        product={selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />
    </div>
  );
};
