import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const categories = [
  { id: 'kitchen', name: 'Кухня', image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80', count: 24 },
  { id: 'tableware', name: 'Посуд', image: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=800&q=80', count: 18 },
  { id: 'textile', name: 'Текстиль', image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80', count: 12 },
  { id: 'decor', name: 'Декор', image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80', count: 15 },
];

export const CategoryGrid = () => {
  return (
    <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl font-serif font-bold text-slate-900 mb-4">Оберіть категорію</h2>
          <p className="text-slate-500 max-w-md">Все необхідне для вашого затишку, структуроване для зручного пошуку.</p>
        </div>
        <Link to="/catalog" className="hidden md:flex items-center gap-2 text-tiffany font-bold hover:underline underline-offset-8">
          Весь каталог <ArrowRight size={20} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {categories.map((cat, idx) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            viewport={{ once: true }}
          >
            <Link to={`/catalog?category=${cat.id}`} className="group block relative aspect-[3/4] rounded-[2.5rem] overflow-hidden shadow-lg">
              <img 
                src={cat.image} 
                alt={cat.name} 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
              <div className="absolute bottom-8 left-8">
                <div className="text-white/60 text-[10px] uppercase font-bold tracking-widest mb-1">{cat.count} товарів</div>
                <h3 className="text-white text-3xl font-serif font-bold">{cat.name}</h3>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
