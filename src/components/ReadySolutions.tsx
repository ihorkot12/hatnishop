import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../store/CartContext';

const bundles = [
  {
    id: 'b1',
    name: 'Набір "Ранкова кава"',
    price: 1200,
    oldPrice: 1500,
    discount: '20%',
    image: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=800&q=80',
    items: ['2 чашки', 'Турка', 'Піднос'],
    category: 'bundles'
  },
  {
    id: 'b2',
    name: 'Набір для сніданку',
    price: 1800,
    oldPrice: 2200,
    discount: '18%',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80',
    items: ['Набір тарілок', 'Серветки', 'Глечик'],
    category: 'bundles'
  }
];

export const ReadySolutions = () => {
  const { addToCart } = useCart();

  return (
    <section className="py-24 bg-slate-900 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="max-w-xl">
            <div className="text-tiffany font-bold text-[10px] uppercase tracking-[0.2em] mb-4">Готові рішення</div>
            <h2 className="text-5xl font-serif font-bold mb-6 leading-tight">Купуйте наборами — <span className="text-tiffany italic">заощаджуйте до 20%</span></h2>
            <p className="text-white/60 text-lg">Ми підібрали ідеальні поєднання товарів, щоб ви не витрачали час на пошук. Готові комплекти для вашого дому або на подарунок.</p>
          </div>
          <Link to="/catalog?category=bundles" className="flex items-center gap-2 text-tiffany font-bold hover:underline underline-offset-8">
            Дивитись всі набори <ArrowRight size={20} />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {bundles.map((bundle, idx) => (
            <motion.div
              key={bundle.id}
              initial={{ opacity: 0, x: idx % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="group relative bg-white/5 rounded-[3rem] p-10 border border-white/10 flex flex-col md:flex-row gap-10 hover:bg-white/10 transition-all duration-500"
            >
              <div className="w-full md:w-1/2 aspect-square rounded-[2rem] overflow-hidden relative">
                <img 
                  src={bundle.image} 
                  alt={bundle.name} 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                />
                <div className="absolute top-4 left-4 bg-tiffany text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full shadow-xl">
                  Знижка {bundle.discount}
                </div>
              </div>

              <div className="w-full md:w-1/2 flex flex-col justify-between">
                <div>
                  <h3 className="text-3xl font-serif font-bold mb-4">{bundle.name}</h3>
                  <div className="space-y-3 mb-8">
                    {bundle.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-white/60 text-sm">
                        <div className="w-1.5 h-1.5 bg-tiffany rounded-full" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white/40 text-sm line-through mb-1">{bundle.oldPrice} грн</div>
                    <div className="text-3xl font-bold text-tiffany">{bundle.price} грн</div>
                  </div>
                  <button 
                    onClick={() => addToCart(bundle as any)}
                    className="w-16 h-16 bg-tiffany text-white rounded-2xl flex items-center justify-center hover:bg-white hover:text-tiffany transition-all shadow-xl shadow-tiffany/20"
                  >
                    <ShoppingCart size={24} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
