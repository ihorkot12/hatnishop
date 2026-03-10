import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { QuickView } from '../components/QuickView';
import { Product } from '../types';

export const Catalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');
  const searchUrlQuery = searchParams.get('search');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [priceRange, setPriceRange] = useState(5000);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchUrlQuery || '');
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'popular'>('default');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    document.title = categoryFilter 
      ? `${categories.find(c => c.slug === categoryFilter)?.name || 'Каталог'} — Хатні Штучки` 
      : "Каталог товарів для дому та затишку — Хатні Штучки";
  }, [categoryFilter, categories]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories')
        ]);
        const [prodData, catData] = await Promise.all([
          prodRes.json(),
          catRes.json()
        ]);
        setProducts(prodData);
        setCategories(catData);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => {
    const selectedCategory = categories.find(c => c.slug === categoryFilter);
    const childCategorySlugs = selectedCategory 
      ? categories.filter(c => c.parent_id === selectedCategory.id).map(c => c.slug)
      : [];
    const allowedCategories = selectedCategory 
      ? [selectedCategory.slug, ...childCategorySlugs]
      : [];

    let result = products.filter(p => {
      if (categoryFilter && !allowedCategories.includes(p.category)) return false;
      if (p.price > priceRange) return false;
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    if (sortBy === 'price-asc') result.sort((a, b) => a.price - b.price);
    if (sortBy === 'price-desc') result.sort((a, b) => b.price - a.price);
    if (sortBy === 'popular') result.sort((a, b) => (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0));

    return result;
  }, [categoryFilter, priceRange, searchQuery, sortBy]);

  return (
    <div className="bg-[#F9F7F5] min-h-screen">
      {/* Editorial Header */}
      <div className="bg-white border-b border-slate-100 pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="max-w-2xl">
              <div className="text-tiffany font-bold text-[10px] uppercase tracking-[0.3em] mb-4">Колекція 2024</div>
              <h1 className="text-5xl md:text-7xl font-serif font-bold text-slate-900 mb-6 leading-tight">
                {categoryFilter ? categories.find(c => c.slug === categoryFilter)?.name : 'Каталог товарів для дому'}
              </h1>
              <p className="text-slate-500 text-lg leading-relaxed">
                Найкращий вибір естетичного посуду, декору та текстилю в Україні. Обирайте предмети, що створюють настрій та затишок у вашій оселі.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-tiffany transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Пошук товарів..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 w-64 focus:ring-2 focus:ring-tiffany transition-all"
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Grid */}
          <div className="lg:col-span-12">
            <AnimatePresence mode="popLayout">
              {filteredProducts.length > 0 ? (
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
                  className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-slate-200"
                >
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                    <Search size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Нічого не знайдено</h2>
                  <p className="text-slate-500 mb-8">Спробуйте змінити параметри фільтрації або пошуковий запит.</p>
                  <button 
                    onClick={() => {setSearchParams({}); setPriceRange(5000); setSearchQuery('');}}
                    className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-tiffany transition-all"
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
                      className={`text-left px-6 py-4 rounded-2xl font-bold transition-all ${!categoryFilter ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      Всі товари
                    </button>
                    {categories.filter(c => !c.parent_id).map(parent => (
                      <div key={parent.id} className="space-y-1">
                        <button 
                          onClick={() => setSearchParams({ category: parent.slug })}
                          className={`w-full text-left px-6 py-4 rounded-2xl font-bold transition-all ${categoryFilter === parent.slug ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
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
                      <div className="text-3xl font-bold text-slate-900">{priceRange} <span className="text-sm font-normal text-slate-400">грн</span></div>
                      <div className="text-[10px] font-bold text-tiffany uppercase tracking-widest">Макс. ціна</div>
                    </div>
                    <input 
                      type="range" 
                      min="100" 
                      max="5000" 
                      step="50"
                      value={priceRange}
                      onChange={(e) => setPriceRange(Number(e.target.value))}
                      className="w-full accent-tiffany h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-slate-300 mt-4 uppercase tracking-widest">
                      <span>100 грн</span>
                      <span>5000 грн</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-12 border-t border-slate-100">
                <button 
                  onClick={() => setShowFilters(false)}
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-tiffany transition-all shadow-xl shadow-slate-900/10"
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
    </div>
  );
};
