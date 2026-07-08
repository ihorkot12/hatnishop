import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Category } from '../types';

export const CategoryGrid = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories/catalog')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setCategories(Array.isArray(data) ? data.filter((category: Category) => !category.parent_id) : []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  if (isLoading || categories.length === 0) return null;

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 text-[11px] font-bold uppercase text-tiffany">Категорії</div>
            <h2 className="text-4xl font-serif font-bold leading-tight text-slate-950 sm:text-5xl">
              Зібрано як полиці у добрій крамниці
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Посуд, текстиль, декор і дрібниці для кухні розкладені так, щоб потрібна річ знаходилась без зайвого пошуку.
            </p>
          </div>
          <Link
            to="/catalog"
            className="hidden items-center gap-2 rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:border-tiffany hover:text-tiffany hover:no-underline lg:inline-flex"
          >
            Весь каталог <ArrowRight size={18} />
          </Link>
        </div>

        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              viewport={{ once: true }}
              className="snap-start"
            >
              <Link
                to={`/catalog?category=${category.slug}`}
                className="group block w-[260px] overflow-hidden rounded-lg border border-slate-200 bg-white hover:no-underline sm:w-[320px]"
              >
                <div className="relative aspect-[5/6] overflow-hidden bg-[#f4f0ea]">
                  <img
                    src={category.image || undefined}
                    alt={category.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/75 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="mb-2 text-[10px] font-bold uppercase text-white/70">
                      Колекція {String(index + 1).padStart(2, '0')}
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-white">{category.name}</h3>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-4">
                  <span className="text-sm font-bold text-slate-600">Переглянути</span>
                  <ArrowRight size={18} className="text-tiffany transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
