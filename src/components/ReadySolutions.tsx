import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../store/CartContext';

const bundles = [
  {
    id: 'b1',
    name: 'Набір "Ранкова кава"',
    price: 1200,
    oldPrice: 1500,
    discount: '20%',
    image: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=900&q=80',
    items: ['2 керамічні чашки', 'Турка', 'Дерев\'яний піднос'],
  },
  {
    id: 'b2',
    name: 'Набір для сніданку',
    price: 1800,
    oldPrice: 2200,
    discount: '18%',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80',
    items: ['Тарілки для двох', 'Лляні серветки', 'Молочник'],
  },
];

export const ReadySolutions = () => {
  const { addToCart } = useCart();

  return (
    <section className="bg-slate-950 py-20 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 text-[11px] font-bold uppercase text-tiffany">Готові рішення</div>
            <h2 className="text-4xl font-serif font-bold leading-tight sm:text-5xl">
              Набори, які вже мають власний ритм
            </h2>
            <p className="mt-4 text-lg leading-8 text-white/65">
              Для сніданку, кави, подарунка або першої полиці нової кухні. Ми зібрали поєднання, які виглядають цілісно одразу.
            </p>
          </div>
          <Link
            to="/catalog?category=bundles"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-bold text-white transition-colors hover:border-tiffany hover:text-tiffany hover:no-underline"
          >
            Усі набори <ArrowRight size={18} />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {bundles.map((bundle, index) => (
            <motion.article
              key={bundle.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              viewport={{ once: true }}
              className="group grid overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] md:grid-cols-[0.9fr_1fr]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-white/5 md:aspect-auto">
                <img
                  src={bundle.image}
                  alt={bundle.name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <span className="absolute left-4 top-4 rounded-md bg-tiffany px-3 py-1 text-[10px] font-bold uppercase text-slate-950">
                  -{bundle.discount}
                </span>
              </div>

              <div className="flex min-h-[320px] flex-col justify-between p-6">
                <div>
                  <div className="mb-3 text-[11px] font-bold uppercase text-white/40">Комплект {index + 1}</div>
                  <h3 className="text-3xl font-serif font-bold">{bundle.name}</h3>
                  <div className="mt-6 space-y-3">
                    {bundle.items.map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm text-white/65">
                        <span className="h-px w-6 bg-tiffany" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/35 line-through">{bundle.oldPrice.toLocaleString('uk-UA')} грн</div>
                    <div className="text-3xl font-bold text-tiffany">{bundle.price.toLocaleString('uk-UA')} грн</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToCart(bundle as any)}
                    aria-label={`Додати ${bundle.name} у кошик`}
                    className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-slate-950 transition-colors hover:bg-tiffany hover:text-white"
                  >
                    <ShoppingCart size={21} />
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};
