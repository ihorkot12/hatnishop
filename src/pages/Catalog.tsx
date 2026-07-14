import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { QuickView } from '../components/QuickView';
import { Product } from '../types';
import { isBundleProduct } from '../utils/productFlags';
import { fetchJsonCachedOr } from '../utils/apiCache';

export const Catalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');
  const searchUrlQuery = searchParams.get('search');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(5000);
  const [popularOnly, setPopularOnly] = useState(false);
  const [bundleOnly, setBundleOnly] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'low' | 'out'>('all');
  const [selectedMaterial, setSelectedMaterial] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [budgetPreset, setBudgetPreset] = useState<'all' | 'under-300' | '300-700' | '700-plus'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchUrlQuery || '');
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'popular'>('default');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPromo, setShowPromo] = useState(false);
  const isBundleRoute = categoryFilter === 'bundles' || searchParams.get('bundles') === '1';

  useEffect(() => {
    const hasSeenPromo = localStorage.getItem('hasSeenCatalogPromo');
    if (!hasSeenPromo) {
      setShowPromo(true);
      localStorage.setItem('hasSeenCatalogPromo', 'true');
    }
  }, []);

  useEffect(() => {
    document.title = isBundleRoute
      ? 'Готові набори — Хатні Штучки'
      : categoryFilter 
      ? `${categories.find(c => c.slug === categoryFilter)?.name || 'Каталог'} — Хатні Штучки` 
      : "Каталог товарів для дому та затишку — Хатні Штучки";
  }, [categoryFilter, categories, isBundleRoute]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [prodData, catData] = await Promise.all([
          fetchJsonCachedOr<Product[]>('/api/products/catalog', []),
          fetchJsonCachedOr<any[]>('/api/categories/catalog', [])
        ]);

        setProducts(Array.isArray(prodData) ? prodData : []);
        setCategories(Array.isArray(catData) ? catData : []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setProducts([]);
        setCategories([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const normalizeSearchValue = (value: unknown) => String(value || '').toLowerCase().trim();

  const filterOptions = useMemo(() => {
    const materials = Array.from(new Set(products.map(product => String(product.material || '').trim()).filter(Boolean))).sort();
    const brands = Array.from(new Set(products.map(product => String(product.brand || '').trim()).filter(Boolean))).sort();
    return { materials, brands };
  }, [products]);

  const activeFilterCount = [
    popularOnly,
    bundleOnly,
    availabilityFilter !== 'all',
    selectedMaterial !== 'all',
    selectedBrand !== 'all',
    budgetPreset !== 'all',
    minPrice > 0 || maxPrice < 5000
  ].filter(Boolean).length;

  const resetCatalogFilters = () => {
    setSearchParams({});
    setMinPrice(0);
    setMaxPrice(5000);
    setPopularOnly(false);
    setBundleOnly(false);
    setAvailabilityFilter('all');
    setSelectedMaterial('all');
    setSelectedBrand('all');
    setBudgetPreset('all');
    setSearchQuery('');
  };

  const filteredProducts = useMemo(() => {
    const selectedCategory = isBundleRoute ? null : categories.find(c => c.slug === categoryFilter);
    const childCategorySlugs = selectedCategory 
      ? categories.filter(c => c.parent_id === selectedCategory.id).map(c => c.slug)
      : [];
    const allowedCategories = selectedCategory 
      ? [selectedCategory.slug, ...childCategorySlugs]
      : [];

    const query = normalizeSearchValue(searchQuery);
    let result = products.filter(p => {
      const stock = Number(p.stock || 0);
      if (categoryFilter && !isBundleRoute && !allowedCategories.includes(p.category)) return false;
      if (p.price < minPrice || p.price > maxPrice) return false;
      if (budgetPreset === 'under-300' && p.price > 300) return false;
      if (budgetPreset === '300-700' && (p.price < 300 || p.price > 700)) return false;
      if (budgetPreset === '700-plus' && p.price < 700) return false;
      if (popularOnly && !p.isPopular) return false;
      if ((bundleOnly || isBundleRoute) && !isBundleProduct(p as any)) return false;
      if (availabilityFilter === 'available' && stock <= 0) return false;
      if (availabilityFilter === 'low' && !(stock > 0 && stock < 5)) return false;
      if (availabilityFilter === 'out' && stock > 0) return false;
      if (selectedMaterial !== 'all' && String(p.material || '') !== selectedMaterial) return false;
      if (selectedBrand !== 'all' && String(p.brand || '') !== selectedBrand) return false;
      if (query) {
        const haystack = [
          p.name,
          p.category,
          p.description,
          p.material,
          p.brand
        ].map(normalizeSearchValue).join(' ');
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    if (sortBy === 'price-asc') result.sort((a, b) => a.price - b.price);
    if (sortBy === 'price-desc') result.sort((a, b) => b.price - a.price);
    if (sortBy === 'popular') result.sort((a, b) => (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0));

    return result;
  }, [categoryFilter, isBundleRoute, minPrice, maxPrice, budgetPreset, popularOnly, bundleOnly, availabilityFilter, selectedMaterial, selectedBrand, searchQuery, sortBy, products, categories]);

  return (
    <div className="bg-[#F9F7F5] min-h-screen">
      {/* Editorial Header */}
      <div className="bg-white border-b border-slate-100 pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-tiffany-deep">
                <span aria-hidden="true" className="h-px w-10 bg-gold" /> Колекція 2026
              </div>
              <h1 className="text-5xl md:text-7xl font-serif font-bold text-slate-900 mb-6 leading-tight">
                {isBundleRoute ? 'Готові набори' : categoryFilter ? categories.find(c => c.slug === categoryFilter)?.name : 'Каталог товарів для дому'}
              </h1>
              <p className="text-slate-500 text-lg leading-relaxed">
                {isBundleRoute
                  ? 'Зібрані комплекти з реальних товарів каталогу: для кави, сервірування, зберігання та кухні.'
                  : 'Естетичний посуд, декор і текстиль, відібрані вручну. Обирайте предмети, що створюють настрій та затишок у вашій оселі.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/bundle-builder"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-950 px-6 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-xl shadow-slate-950/10 hover:bg-tiffany hover:no-underline"
              >
                Зібрати набір
              </Link>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-tiffany transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Пошук товарів..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-50 border-none rounded-lg pl-12 pr-6 py-4 w-64 focus:ring-2 focus:ring-tiffany transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-6 mb-12 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-tiffany transition-all"
            >
              <SlidersHorizontal size={16} /> Фільтри
            </button>
            <div className="h-8 w-px bg-slate-100 hidden md:block" />
            <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              Знайдено: <span className="text-slate-900">{filteredProducts.length} товарів</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-slate-50 border-none rounded-xl pl-6 pr-12 py-3 text-xs font-bold uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-tiffany cursor-pointer"
              >
                <option value="default">За замовчуванням</option>
                <option value="popular">Найпопулярніші</option>
                <option value="price-asc">Ціна: від дешевих</option>
                <option value="price-desc">Ціна: від дорогих</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        <div className="mb-10 grid gap-3 rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm md:grid-cols-4">
          {([
            { value: 'all', label: 'Усі бюджети', hint: 'без обмежень' },
            { value: 'under-300', label: 'До 300 грн', hint: 'малий подарунок' },
            { value: '300-700', label: '300-700 грн', hint: 'найчастіший вибір' },
            { value: '700-plus', label: '700+ грн', hint: 'преміум / набір' }
          ] as const).map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setBudgetPreset(option.value)}
              className={`rounded-lg px-5 py-4 text-left transition-all ${
                budgetPreset === option.value
                  ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/10'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="text-sm font-bold">{option.label}</div>
              <div className={`mt-1 text-[10px] font-bold uppercase tracking-widest ${budgetPreset === option.value ? 'text-white/50' : 'text-slate-400'}`}>{option.hint}</div>
            </button>
          ))}
        </div>

        <div className="mb-10 grid gap-3 rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm md:grid-cols-4">
          <select
            value={availabilityFilter}
            onChange={(event) => setAvailabilityFilter(event.target.value as 'all' | 'available' | 'low' | 'out')}
            className="rounded-lg border-none bg-slate-50 px-5 py-4 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-tiffany"
          >
            <option value="all">Уся наявність</option>
            <option value="available">В наявності</option>
            <option value="low">Мало залишилось</option>
            <option value="out">Немає в наявності</option>
          </select>
          <select
            value={selectedMaterial}
            onChange={(event) => setSelectedMaterial(event.target.value)}
            className="rounded-lg border-none bg-slate-50 px-5 py-4 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-tiffany"
          >
            <option value="all">Усі матеріали</option>
            {filterOptions.materials.map(material => (
              <option key={material} value={material}>{material}</option>
            ))}
          </select>
          <select
            value={selectedBrand}
            onChange={(event) => setSelectedBrand(event.target.value)}
            className="rounded-lg border-none bg-slate-50 px-5 py-4 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-tiffany"
          >
            <option value="all">Усі бренди</option>
            {filterOptions.brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={resetCatalogFilters}
            className="rounded-lg bg-slate-950 px-5 py-4 text-sm font-bold text-white transition-all hover:bg-tiffany"
          >
            Скинути фільтри{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Grid */}
          <div className="lg:col-span-12">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {[...Array(8)].map((_, index) => (
                    <div key={index} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div className="aspect-[4/5] animate-pulse bg-cream-dark" />
                      <div className="space-y-3 p-5">
                        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                        <div className="h-5 w-4/5 animate-pulse rounded bg-slate-100" />
                        <div className="h-5 w-1/2 animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length > 0 ? (
                <motion.div 
                  layout
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
                >
                  {filteredProducts.map(product => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      onQuickView={(p) => setSelectedProduct(p)}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-32 bg-white rounded-lg border border-dashed border-slate-200"
                >
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                    <Search size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Нічого не знайдено</h2>
                  <p className="text-slate-500 mb-8">Спробуйте змінити параметри фільтрації або пошуковий запит.</p>
                  <button 
                    onClick={() => {setSearchParams({}); setMinPrice(0); setMaxPrice(5000); setPopularOnly(false); setBundleOnly(false); setSearchQuery('');}}
                    className="bg-slate-900 text-white px-8 py-4 rounded-lg font-bold hover:bg-tiffany transition-all"
                  >
                    Скинути все
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Filter Sidebar Drawer */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.aside 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-[70] shadow-2xl p-10 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-12">
                <h2 className="text-3xl font-serif font-bold">Фільтри</h2>
                <button 
                  onClick={() => setShowFilters(false)}
                  className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-12">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-6">Категорії</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => setSearchParams({})}
                      className={`text-left px-6 py-4 rounded-lg font-bold transition-all ${!categoryFilter ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      Всі товари
                    </button>
                    {categories.filter(c => !c.parent_id).map(parent => (
                      <div key={parent.id} className="space-y-1">
                        <button 
                          onClick={() => setSearchParams({ category: parent.slug })}
                          className={`w-full text-left px-6 py-4 rounded-lg font-bold transition-all ${categoryFilter === parent.slug ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                        >
                          {parent.name}
                        </button>
                        <div className="pl-6 space-y-1">
                          {categories.filter(c => c.parent_id === parent.id).map(child => (
                            <button 
                              key={child.id}
                              onClick={() => setSearchParams({ category: child.slug })}
                              className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-all ${categoryFilter === child.slug ? 'text-tiffany font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              — {child.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-6">Ціновий діапазон</h3>
                  <div className="bg-slate-50 p-8 rounded-[2rem]">
                    <div className="flex justify-between items-end mb-6">
                      <div className="text-2xl font-bold text-slate-900">{minPrice} - {maxPrice} <span className="text-sm font-normal text-slate-400">грн</span></div>
                    </div>
                    
                    <div className="relative h-1.5 bg-slate-200 rounded-lg mb-4">
                      <div 
                        className="absolute h-full bg-tiffany rounded-lg" 
                        style={{ left: `${(minPrice / 5000) * 100}%`, right: `${100 - (maxPrice / 5000) * 100}%` }}
                      />
                      <input 
                        type="range" 
                        min="0" 
                        max="5000" 
                        step="50"
                        value={minPrice}
                        onChange={(e) => setMinPrice(Math.min(Number(e.target.value), maxPrice - 50))}
                        className="absolute w-full -top-1.5 h-1.5 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-tiffany [&::-webkit-slider-thumb]:rounded-full"
                      />
                      <input 
                        type="range" 
                        min="0" 
                        max="5000" 
                        step="50"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(Math.max(Number(e.target.value), minPrice + 50))}
                        className="absolute w-full -top-1.5 h-1.5 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-tiffany [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                    
                    <div className="flex justify-between text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                      <span>0 грн</span>
                      <span>5000 грн</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-6">Популярність</h3>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    {/* sr-only, а не hidden: display:none викидає інпут із tab-order,
                        і фільтр ставав недоступним з клавіатури */}
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={popularOnly}
                      onChange={(e) => setPopularOnly(e.target.checked)}
                    />
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-tiffany-deep peer-focus-visible:ring-offset-2 ${popularOnly ? 'bg-tiffany border-tiffany' : 'border-slate-300 group-hover:border-tiffany'}`}>
                      {popularOnly && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="font-bold text-slate-700 group-hover:text-slate-900">Тільки популярні товари</span>
                  </label>
                  <label className="mt-4 flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={bundleOnly}
                      onChange={(e) => setBundleOnly(e.target.checked)}
                    />
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-tiffany-deep peer-focus-visible:ring-offset-2 ${bundleOnly ? 'bg-tiffany border-tiffany' : 'border-slate-300 group-hover:border-tiffany'}`}>
                      {bundleOnly && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="font-bold text-slate-700 group-hover:text-slate-900">Тільки готові набори</span>
                  </label>
                </div>
              </div>

              <div className="mt-12 pt-12 border-t border-slate-100">
                <button 
                  onClick={() => setShowFilters(false)}
                  className="w-full bg-slate-900 text-white py-5 rounded-lg font-bold text-lg hover:bg-tiffany transition-all shadow-xl shadow-slate-900/10"
                >
                  Показати результати
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <QuickView 
        product={selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />

      {/* Promotion Notification */}
      <AnimatePresence>
        {showPromo && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="pointer-events-none fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-6 md:w-96"
          >
            <div className="pointer-events-auto rounded-lg border border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-950/20">
              <button 
                onClick={() => setShowPromo(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div className="relative z-10">
                <div className="text-tiffany font-bold text-[10px] uppercase tracking-widest mb-2">Спеціальна пропозиція</div>
                <h3 className="text-2xl font-serif font-bold mb-4">Вітаємо у нашому каталозі!</h3>
                <p className="text-white/60 text-sm mb-6 leading-relaxed">
                  Використовуйте промокод <span className="text-white font-bold">WELCOME10</span> для отримання знижки 10% на ваше перше замовлення.
                </p>
                <button 
                  onClick={() => setShowPromo(false)}
                  className="w-full bg-tiffany text-white py-4 rounded-lg font-bold hover:bg-white hover:text-tiffany transition-all"
                >
                  Зрозуміло, дякую!
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
