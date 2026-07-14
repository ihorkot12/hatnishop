import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { ProductCard } from '../components/ProductCard';
import { QuickView } from '../components/QuickView';
import { CategoryGrid } from '../components/CategoryGrid';
import { ReadySolutions } from '../components/ReadySolutions';
import { BonusSystem } from '../components/BonusSystem';
import { Eyebrow } from '../components/Eyebrow';
import { Product } from '../types';
import { fetchJsonCachedOr } from '../utils/apiCache';

const FALLBACK_HEADING = 'Популярні речі для оселі з характером';
const FALLBACK_SUBTITLE = 'Кераміка, текстиль і декор, які виглядають зібраними, а не випадково доданими в кошик.';

const serviceItems = [
  {
    title: 'Ретельний відбір',
    text: 'У каталозі лишаються речі з виразною фактурою, зрозумілою користю і спокійним виглядом у реальному домі.',
    icon: CheckCircle2,
  },
  {
    title: 'Доставка по Україні',
    text: 'Пакуємо крихке окремо, перевіряємо комплектацію і передаємо у доставку з запасом захисту.',
    icon: Truck,
  },
  {
    title: 'Повернення 14 днів',
    text: 'Якщо річ не підійшла за розміром, кольором або настроєм, є час спокійно оформити повернення.',
    icon: PackageCheck,
  },
];

export const Home = () => {
  const prefersReducedMotion = useReducedMotion();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [siteSettings, setSiteSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Хатні Штучки - естетичний посуд, декор і текстиль для дому';

    Promise.all([
      fetchJsonCachedOr<Product[]>('/api/products/catalog', []),
      fetchJsonCachedOr('/api/site-settings', null),
    ])
      .then(([productsData, settingsData]) => {
        setProducts(Array.isArray(productsData) ? productsData : []);
        setSiteSettings(settingsData);
        setLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setLoading(false);
      });
  }, []);

  const bestSellers = useMemo(() => {
    const popular = products.filter((product: any) => product.isPopular || product.ispopular);
    return (popular.length ? popular : products).slice(0, 4);
  }, [products]);

  const featuredProduct = products.find((product) => product.id === siteSettings?.hero_featured_product_id) || (loading ? undefined : products[0]);

  return (
    <div className="bg-white pb-16">
      <Hero
        title={siteSettings?.hero_title}
        subtitle={siteSettings?.hero_subtitle}
        badge={siteSettings?.hero_badge}
        featuredProduct={featuredProduct}
        loading={loading}
      />

      <CategoryGrid />

      <section className="border-t border-slate-900/10 bg-cream py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <Eyebrow>{siteSettings?.bestsellers_badge || 'Вибір покупців'}</Eyebrow>
              <h2 className="text-4xl font-serif font-bold leading-tight text-slate-950 sm:text-5xl">
                {siteSettings?.bestsellers_title || FALLBACK_HEADING}
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                {siteSettings?.bestsellers_subtitle || FALLBACK_SUBTITLE}
              </p>
            </div>
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-tiffany hover:no-underline"
            >
              Дивитись каталог <ArrowRight size={18} />
            </Link>
          </div>

          {bestSellers.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={{ visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.08 } } }}
            >
              {bestSellers.map((product) => (
                <motion.div
                  key={product.id}
                  variants={{
                    hidden: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: 'easeOut' }}
                >
                  <ProductCard product={product} onQuickView={(item) => setSelectedProduct(item)} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              Товари завантажуються. Якщо каталог порожній, додайте позиції в адмінці.
            </div>
          )}
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.85fr_1fr] lg:gap-16 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-lg border border-slate-200 bg-cream-dark"
          >
            <img
              src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80"
              alt="Тиха кухня з дерев'яними та керамічними деталями"
              loading="lazy"
              decoding="async"
              className="h-full min-h-[420px] w-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-slate-950/80 p-5 text-white backdrop-blur-sm">
              <div className="text-[11px] font-bold uppercase text-tiffany">Quiet Craft</div>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Речі мають не перекривати дім, а збирати його в один спокійний образ.
              </p>
            </div>
          </motion.div>

          <div className="flex flex-col justify-center">
            <Eyebrow>Чому це працює</Eyebrow>
            <h2 className="text-4xl font-serif font-bold leading-tight text-slate-950 sm:text-5xl">
              Менше випадкових покупок, більше цілісних рішень
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Ми будуємо каталог як систему: предмети мають поєднуватись між собою, не сперечатись з інтер'єром і витримувати щоденне користування.
            </p>

            <div className="mt-9 grid gap-4">
              {serviceItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                    viewport={{ once: true }}
                    className="border-l border-slate-900/15 py-1 pl-6"
                  >
                    <h3 className="flex items-center gap-2.5 font-bold text-slate-950">
                      <Icon size={17} className="text-tiffany-deep" /> {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.text}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <ReadySolutions />

      <BonusSystem />

      <section className="bg-slate-950 py-24 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <Eyebrow icon={<ShieldCheck size={14} />}>Спільнота</Eyebrow>
            <h2 className="max-w-3xl text-4xl font-serif font-bold leading-tight sm:text-5xl">
              Нові поставки, добірки і закриті промокоди в Telegram
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">
              Канал для тих, хто любить бачити речі до того, як вони зникають із полиці.
            </p>
          </div>
          <a
            href="https://t.me/+gcAKeeKFKL43NjYy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 rounded-lg bg-tiffany px-7 py-4 font-bold text-slate-950 transition-colors hover:bg-white hover:no-underline"
          >
            Підписатися <ArrowRight size={19} />
          </a>
        </div>
      </section>

      <QuickView product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </div>
  );
};
