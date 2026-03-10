import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Category } from '../types';

export const CategoryGrid = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        setCategories(data.filter((c: Category) => !c.parent_id));
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return null;

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

      <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 hide-scrollbar">
        {categories.map((cat, idx) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            viewport={{ once: true }}
            className="snap-start shrink-0 w-[280px] sm:w-[320px] md:w-[360px]"
          >
            <Link to={`/catalog?category=${cat.slug}`} className="group block relative aspect-[3/4] rounded-[2.5rem] overflow-hidden shadow-lg">
              <img 
                src={cat.image} 
                alt={cat.name} 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
              <div className="absolute bottom-8 left-8">
                <h3 className="text-white text-3xl font-serif font-bold">{cat.name}</h3>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
