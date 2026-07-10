import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BadgePercent, Check, Gift, PackageCheck, Search, ShoppingBag, Sparkles, X } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../store/CartContext';
import { calculateBundlePrice, suggestBundleItemsLocally } from '../utils/bundleRecommendations';
import { isBundleProduct } from '../utils/productFlags';
import { fetchJsonCachedOr } from '../utils/apiCache';

const MIN_BUNDLE_ITEMS = 2;
const MAX_BUNDLE_ITEMS = 6;
const BUNDLE_DISCOUNT_RATE = 0.12;

const SCENARIOS = [
  {
    id: 'morning',
    title: 'Р Р°РЅРєРѕРІР° РєР°РІР°',
    copy: 'Р§Р°С€РєРё, Р±Р»СЋРґС†СЏ, СЃРєР»Рѕ С– РјР°Р»РµРЅСЊРєС– СЂРµС‡С– РґР»СЏ РєСЂР°СЃРёРІРѕРіРѕ СЂР°РЅРєСѓ.',
    keywords: ['РєР°РІР°', 'С‡Р°С€', 'РєСЂСѓР¶', 'РєРµР»РёС…', 'Р±Р»СЋРґ', 'С†СѓРєРѕСЂ', 'Р»РѕР¶'],
  },
  {
    id: 'serving',
    title: 'РЎС‚С–Р» РґР»СЏ РіРѕСЃС‚РµР№',
    copy: 'РџРѕСЃСѓРґ, С‚Р°СЂС–Р»РєРё, СЃР°Р»Р°С‚РЅРёРєРё С– СЃРµСЂРІС–СЂСѓРІР°РЅРЅСЏ РѕРґРЅРёРј РЅР°Р±РѕСЂРѕРј.',
    keywords: ['С‚Р°СЂС–Р»', 'Р±Р»СЋРґ', 'СЃР°Р»Р°С‚', 'РєРµР»РёС…', 'РіР»РµС‡', 'СЃРµСЂРІ', 'РЅР°Р±С–СЂ'],
  },
  {
    id: 'storage',
    title: 'РћСЂРіР°РЅС–Р·Р°С†С–СЏ РєСѓС…РЅС–',
    copy: 'РљРѕРЅС‚РµР№РЅРµСЂРё, Р±Р°РЅРєРё, С”РјРЅРѕСЃС‚С– С– РІСЃРµ РґР»СЏ Р°РєСѓСЂР°С‚РЅРѕРіРѕ Р·Р±РµСЂС–РіР°РЅРЅСЏ.',
    keywords: ['С”РјРЅ', 'РєРѕРЅС‚РµР№РЅ', 'Р±Р°РЅРєР°', 'РѕСЂРіР°РЅ', 'Р·Р±РµСЂ', 'СЃРёРїСѓС‡', 'РєРѕС€РёРє'],
  },
  {
    id: 'gift',
    title: 'РџРѕРґР°СЂСѓРЅРѕРє',
    copy: 'Р•СЃС‚РµС‚РёС‡РЅС– С‚РѕРІР°СЂРё, СЏРєС– Р»РµРіРєРѕ РґР°СЂСѓРІР°С‚Рё РєРѕРјРїР»РµРєС‚РѕРј.',
    keywords: ['РЅР°Р±С–СЂ', 'РїРѕРґР°СЂ', 'РґРµРєРѕСЂ', 'С‚РµРєСЃС‚РёР»СЊ', 'СЃРІС–С‡', 'СЃРµСЂРІРµС‚'],
  },
];

const formatPrice = (value: number | string) => `${Number(value || 0).toLocaleString('uk-UA')} РіСЂРЅ`;

const normalize = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const productText = (product: Product) =>
  normalize([product.name, product.category, product.material, product.brand, product.description].filter(Boolean).join(' '));

export const BundleBuilder = () => {
  const navigate = useNavigate();
  const { addBundleToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeScenario, setActiveScenario] = useState(SCENARIOS[0].id);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState('');

  const activeScenarioConfig = SCENARIOS.find(scenario => scenario.id === activeScenario) || SCENARIOS[0];

  useEffect(() => {
    document.title = 'РљРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ РЅР°Р±РѕСЂС–РІ вЂ” РҐР°С‚РЅС– РЁС‚СѓС‡РєРё';
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [productsData, categoriesData] = await Promise.all([
          fetchJsonCachedOr<Product[]>('/api/products/catalog', []),
          fetchJsonCachedOr<any[]>('/api/categories/catalog', []),
        ]);
        if (cancelled) return;
        setProducts(Array.isArray(productsData) ? productsData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } catch {
        if (!cancelled) {
          setProducts([]);
          setCategories([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableProducts = useMemo(
    () => products.filter(product => !isBundleProduct(product as any) && Number(product.stock || 0) > 0),
    [products]
  );

  const selectedProducts = useMemo(
    () => selectedIds
      .map(id => availableProducts.find(product => product.id === id))
      .filter(Boolean) as Product[],
    [availableProducts, selectedIds]
  );

  const bundleTotal = selectedProducts.reduce((sum, product) => sum + Number(product.price || 0), 0);
  const bundlePrice = selectedProducts.length >= MIN_BUNDLE_ITEMS
    ? calculateBundlePrice(selectedProducts as any, BUNDLE_DISCOUNT_RATE)
    : bundleTotal;
  const bundleSavings = Math.max(0, bundleTotal - bundlePrice);

  const categoryOptions = useMemo(() => {
    const usedSlugs = new Set(availableProducts.map(product => product.category).filter(Boolean));
    const knownCategories = categories.filter(category => usedSlugs.has(category.slug));
    const fallbackCategories = Array.from(usedSlugs)
      .filter(slug => !knownCategories.some(category => category.slug === slug))
      .map(slug => ({ id: slug, slug, name: slug }));
    return [...knownCategories, ...fallbackCategories];
  }, [availableProducts, categories]);

  const visibleProducts = useMemo(() => {
    const query = normalize(searchQuery);
    return availableProducts
      .filter(product => categoryFilter === 'all' || product.category === categoryFilter)
      .filter(product => !query || productText(product).includes(query))
      .sort((a, b) => {
        const scenarioA = activeScenarioConfig.keywords.some(keyword => productText(a).includes(keyword)) ? 1 : 0;
        const scenarioB = activeScenarioConfig.keywords.some(keyword => productText(b).includes(keyword)) ? 1 : 0;
        return scenarioB - scenarioA || Number(b.rating || 0) - Number(a.rating || 0);
      })
      .slice(0, 48);
  }, [activeScenarioConfig, availableProducts, categoryFilter, searchQuery]);

  const toggleProduct = (product: Product) => {
    setNotice('');
    setSelectedIds(prev => {
      if (prev.includes(product.id)) return prev.filter(id => id !== product.id);
      if (prev.length >= MAX_BUNDLE_ITEMS) {
        setNotice(`РЈ РЅР°Р±РѕСЂС– РјР°РєСЃРёРјСѓРј ${MAX_BUNDLE_ITEMS} С‚РѕРІР°СЂС–РІ, С‰РѕР± РІС–РЅ Р»РёС€Р°РІСЃСЏ Р·СЂСѓС‡РЅРёРј РґР»СЏ Р·Р°РјРѕРІР»РµРЅРЅСЏ.`);
        return prev;
      }
      return [...prev, product.id];
    });
  };

  const autoPickBundle = (seedProduct?: Product) => {
    if (availableProducts.length === 0) return;
    const scenarioMatches = availableProducts.filter(product =>
      activeScenarioConfig.keywords.some(keyword => productText(product).includes(keyword))
    );
    const baseProduct = seedProduct
      || selectedProducts[0]
      || scenarioMatches[0]
      || availableProducts.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))[0];

    const suggested = suggestBundleItemsLocally(baseProduct as any, availableProducts as any, { limit: MAX_BUNDLE_ITEMS - 1 }) as Product[];
    const picked = Array.from(new Map(
      [baseProduct, ...suggested, ...scenarioMatches]
        .filter(Boolean)
        .map(product => [product.id, product])
    ).values()).slice(0, MAX_BUNDLE_ITEMS);

    setSelectedIds(picked.map(product => product.id));
    setNotice(`РџС–РґС–Р±СЂР°РЅРѕ РЅР°Р±С–СЂ "${activeScenarioConfig.title}" Р· ${picked.length} С‚РѕРІР°СЂС–РІ.`);
  };

  useEffect(() => {
    if (!isLoading && availableProducts.length > 0 && selectedIds.length === 0) {
      autoPickBundle();
    }
  }, [isLoading, availableProducts.length]);

  const addSelectedBundleToCart = () => {
    if (selectedProducts.length < MIN_BUNDLE_ITEMS) {
      setNotice(`Р”РѕРґР°Р№С‚Рµ РјС–РЅС–РјСѓРј ${MIN_BUNDLE_ITEMS} С‚РѕРІР°СЂРё, С‰РѕР± СЃС„РѕСЂРјСѓРІР°С‚Рё РЅР°Р±С–СЂ.`);
      return;
    }

    addBundleToCart(selectedProducts, {
      title: `РќР°Р±С–СЂ "${activeScenarioConfig.title}"`,
      discountRate: BUNDLE_DISCOUNT_RATE,
    });
    navigate('/cart');
  };

  return (
    <div className="min-h-screen bg-[#F9F7F5]">
      <section className="border-b border-slate-100 bg-white pt-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-16">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-tiffany/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-tiffany">
              <Sparkles size={14} /> РљРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ РЅР°Р±РѕСЂС–РІ
            </div>
            <h1 className="max-w-3xl text-5xl font-serif font-bold leading-none text-slate-950 md:text-7xl">
              Р—Р±РµСЂС–С‚СЊ СЃРІС–Р№ РЅР°Р±С–СЂ РґР»СЏ РґРѕРјСѓ
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-500">
              РћР±РµСЂС–С‚СЊ СЃС†РµРЅР°СЂС–Р№, РґРѕРґР°Р№С‚Рµ С‚РѕРІР°СЂРё РІСЂСѓС‡РЅСѓ Р°Р±Рѕ РЅР°С‚РёСЃРЅС–С‚СЊ Р°РІС‚РѕРїС–РґР±С–СЂ. РЎР°Р№С‚ СЃР°Рј РїРѕРєР°Р¶Рµ СЃСѓРјСѓ, РµРєРѕРЅРѕРјС–СЋ С– РґРѕРґР°СЃС‚СЊ РІРµСЃСЊ РЅР°Р±С–СЂ Сѓ РєРѕС€РёРє РѕРґРЅРёРј РєР»С–РєРѕРј.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {SCENARIOS.map(scenario => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => {
                    setActiveScenario(scenario.id);
                    setSelectedIds([]);
                    setNotice('');
                  }}
                  className={`rounded-full px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                    activeScenario === scenario.id
                      ? 'bg-slate-950 text-white shadow-xl shadow-slate-950/10'
                      : 'bg-slate-100 text-slate-500 hover:bg-white hover:text-slate-950'
                  }`}
                >
                  {scenario.title}
                </button>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-slate-100 bg-slate-950 p-8 text-white shadow-2xl shadow-slate-950/20"
          >
            <div className="mb-8 flex items-start justify-between gap-6">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-tiffany">РџРѕС‚РѕС‡РЅРёР№ РЅР°Р±С–СЂ</div>
                <h2 className="mt-2 text-3xl font-serif font-bold">{activeScenarioConfig.title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/50">{activeScenarioConfig.copy}</p>
              </div>
              <Gift className="shrink-0 text-tiffany" size={34} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/5 p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">РўРѕРІР°СЂС–РІ</div>
                <div className="mt-2 text-2xl font-bold">{selectedProducts.length}</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Р Р°Р·РѕРј</div>
                <div className="mt-2 text-2xl font-bold">{formatPrice(bundlePrice)}</div>
              </div>
              <div className="rounded-2xl bg-tiffany/10 p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Р•РєРѕРЅРѕРјС–СЏ</div>
                <div className="mt-2 text-2xl font-bold text-tiffany">{formatPrice(bundleSavings)}</div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              {selectedProducts.length > 0 ? selectedProducts.map(product => (
                <div key={product.id} className="flex items-center gap-4 rounded-2xl bg-white/5 p-3">
                  <img src={product.image || undefined} alt={product.name} className="h-14 w-14 rounded-xl object-cover" referrerPolicy="no-referrer" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{product.name}</div>
                    <div className="text-xs text-white/40">{formatPrice(product.price)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleProduct(product)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-red-500 hover:text-white"
                    aria-label={`РџСЂРёР±СЂР°С‚Рё ${product.name}`}
                  >
                    <X size={16} />
                  </button>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/40">
                  Р’РёР±РµСЂС–С‚СЊ С‚РѕРІР°СЂРё РЅРёР¶С‡Рµ Р°Р±Рѕ РЅР°С‚РёСЃРЅС–С‚СЊ Р°РІС‚РѕРїС–РґР±С–СЂ.
                </div>
              )}
            </div>

            {notice && (
              <div className="mt-5 rounded-2xl bg-white/5 p-4 text-sm text-white/70">{notice}</div>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => autoPickBundle()}
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-950 transition-all hover:bg-tiffany hover:text-white"
              >
                <Sparkles size={18} /> РђРІС‚РѕРїС–РґС–Р±СЂР°С‚Рё
              </button>
              <button
                type="button"
                onClick={addSelectedBundleToCart}
                disabled={selectedProducts.length < MIN_BUNDLE_ITEMS}
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-tiffany px-5 py-4 text-sm font-bold text-white shadow-xl shadow-tiffany/20 transition-all hover:bg-white hover:text-tiffany disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none"
              >
                РЈ РєРѕС€РёРє <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-4 rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="РџРѕС€СѓРє С‚РѕРІР°СЂСѓ РґР»СЏ РЅР°Р±РѕСЂСѓ..."
              className="w-full rounded-2xl border-none bg-slate-50 py-4 pl-12 pr-4 text-sm font-semibold focus:ring-2 focus:ring-tiffany"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={event => setCategoryFilter(event.target.value)}
            className="rounded-2xl border-none bg-slate-50 px-5 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 focus:ring-2 focus:ring-tiffany"
          >
            <option value="all">РЈСЃС– РєР°С‚РµРіРѕСЂС–С—</option>
            {categoryOptions.map(category => (
              <option key={category.id || category.slug} value={category.slug}>{category.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => autoPickBundle()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-tiffany"
          >
            <PackageCheck size={17} /> Р—С–Р±СЂР°С‚Рё Р°РІС‚РѕРјР°С‚РѕРј
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-[2rem] bg-white p-16 text-center text-sm font-bold uppercase tracking-widest text-slate-300">
            Р—Р°РІР°РЅС‚Р°Р¶СѓС”РјРѕ С‚РѕРІР°СЂРё...
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-[2rem] bg-white p-16 text-center">
            <Gift className="mx-auto mb-4 text-slate-200" size={54} />
            <h2 className="text-2xl font-bold text-slate-950">РќС–С‡РѕРіРѕ РЅРµ Р·РЅР°Р№С€Р»Рё</h2>
            <p className="mt-2 text-slate-500">Р—РјС–РЅС–С‚СЊ РїРѕС€СѓРє Р°Р±Рѕ РєР°С‚РµРіРѕСЂС–СЋ.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map(product => {
              const isSelected = selectedIds.includes(product.id);
              return (
                <motion.article
                  key={product.id}
                  layout
                  className={`overflow-hidden rounded-lg border bg-white shadow-sm transition-all ${
                    isSelected ? 'border-tiffany shadow-xl shadow-tiffany/10' : 'border-slate-200 hover:shadow-xl hover:shadow-slate-950/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleProduct(product)}
                    className="group block w-full text-left"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-slate-50">
                      <img
                        src={product.image || undefined}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute right-4 top-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full shadow-lg ${
                          isSelected ? 'bg-tiffany text-white' : 'bg-white text-slate-300'
                        }`}>
                          {isSelected ? <Check size={18} /> : <ShoppingBag size={18} />}
                        </div>
                      </div>
                      {activeScenarioConfig.keywords.some(keyword => productText(product).includes(keyword)) && (
                        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-[10px] font-bold uppercase text-tiffany shadow-sm">
                          <BadgePercent size={12} /> РїС–РґС…РѕРґРёС‚СЊ
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{product.category}</div>
                      <h3 className="line-clamp-2 min-h-[3rem] text-xl font-serif font-bold leading-tight text-slate-950">{product.name}</h3>
                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                        <div className="text-xl font-bold text-slate-950">{formatPrice(product.price)}</div>
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase text-slate-400">
                          {Number(product.stock || 0)} С€С‚
                        </span>
                      </div>
                    </div>
                  </button>
                </motion.article>
              );
            })}
          </div>
        )}

        <div className="mt-10 rounded-[2rem] border border-tiffany/20 bg-white p-6 shadow-sm md:flex md:items-center md:justify-between md:gap-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-tiffany/10 text-tiffany">
              <Gift size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-950">Р“РѕС‚РѕРІС– РЅР°Р±РѕСЂРё С‚РµР¶ Р»РёС€Р°СЋС‚СЊСЃСЏ</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                РЇРєС‰Рѕ С‚СЂРµР±Р° РЅРµ Р·Р±РёСЂР°С‚Рё СЃР°РјРѕРјСѓ, РІС–РґРєСЂРёР№С‚Рµ РіРѕС‚РѕРІС– РєРѕРјРїР»РµРєС‚Рё Р· РєР°С‚Р°Р»РѕРіСѓ.
              </p>
            </div>
          </div>
          <Link
            to="/catalog?category=bundles"
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-6 py-3 text-sm font-bold text-white hover:bg-tiffany hover:no-underline md:mt-0"
          >
            Р“РѕС‚РѕРІС– РЅР°Р±РѕСЂРё
          </Link>
        </div>
      </section>
    </div>
  );
};
