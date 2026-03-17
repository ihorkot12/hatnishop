import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { generateDescription as aiGenerateDescription, generateProductImage as aiGenerateProductImage } from '../services/aiService';
import { Upload, FileText, Check, X, Sparkles, Image as ImageIcon, Loader2, Save, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Variant {
  size: string;
  price: number;
  stock: number;
}

interface DraftProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  description: string;
  image: string;
  status: 'pending' | 'processing' | 'ready' | 'saved' | 'error';
  errorMessage?: string;
  isDuplicate?: boolean;
  variants?: Variant[];
}

export const ProductImporter = ({ onComplete, categories }: { onComplete: () => void, categories: any[] }) => {
  const [drafts, setDrafts] = useState<DraftProduct[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [existingProducts, setExistingProducts] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setExistingProducts(data))
      .catch(err => console.error(err));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setTimeout(() => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          const draftsMap = new Map<string, DraftProduct>();
          let currentCategory = '';
          
          data.forEach((row, index) => {
            // Skip header row
            if (index === 0) return;

            const sku = row[0]?.toString().trim();
            const name = row[1]?.toString().trim();
            const categoryName = row[2]?.toString().trim();
            const stock = parseFloat(row[3]) || 0;
            const price = parseFloat(row[4]) || 0;
            const description = row[5]?.toString().trim() || '';

            if (!name || (!price && !stock)) return;

            // Try to match category
            let itemCategory = '';
            if (categoryName) {
              const matchedCat = categories.find(c => 
                categoryName.toLowerCase().includes(c.name.toLowerCase()) || 
                c.name.toLowerCase().includes(categoryName.toLowerCase())
              );
              if (matchedCat) itemCategory = matchedCat.slug;
            }

            const key = name.toLowerCase();
            if (draftsMap.has(key)) {
              const existing = draftsMap.get(key)!;
              existing.stock += stock;
            } else {
              const isDuplicate = existingProducts.some(p => p.name.toLowerCase() === key);
              const newDraft: DraftProduct = {
                id: `draft-${Date.now()}-${index}`,
                name: sku ? `${sku} - ${name}` : name,
                price,
                stock,
                category: itemCategory,
                description: description,
                image: '',
                status: 'pending',
                isDuplicate
              };
              draftsMap.set(key, newDraft);
            }
          });

          setDrafts(Array.from(draftsMap.values()));
          setCurrentPage(1);
        } catch (err) {
          console.error('Parsing error:', err);
          alert('Помилка при читанні файлу');
        } finally {
          setIsParsing(false);
        }
      }, 10);
    };
    reader.readAsBinaryString(file);
  };

  const generateDescription = async (id: string) => {
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'processing' } : d));

    try {
      const category = draft.category || 'Дім';
      const description = await aiGenerateDescription(draft.name, category);
      setDrafts(prev => prev.map(d => d.id === id ? { 
        ...d, 
        description: description || d.description, 
        status: 'ready' 
      } : d));
    } catch (err) {
      console.error('AI Description error:', err);
      setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'pending' } : d));
    }
  };

  const generateImage = async (id: string) => {
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;

    setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'processing' } : d));

    try {
      const category = draft.category || 'Дім';
      const image = await aiGenerateProductImage(draft.name, category, draft.image);
      setDrafts(prev => prev.map(d => d.id === id ? { 
        ...d, 
        image: image || d.image,
        status: 'ready' 
      } : d));
    } catch (err) {
      console.error('AI Image error:', err);
      setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'pending' } : d));
    }
  };

  const saveProduct = async (id: string) => {
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    if (!draft.category) {
      alert('Будь ласка, виберіть категорію');
      return;
    }

    // If there are variants, format them into the description
    let finalDescription = draft.description;
    if (draft.variants && draft.variants.length > 0) {
      const variantsText = draft.variants.map(v => `- ${v.size}: ${v.price} грн`).join('\n');
      finalDescription += `\n\nДоступні розміри:\n${variantsText}`;
    }

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          price: draft.price,
          stock: draft.stock,
          category: draft.category,
          description: finalDescription,
          image: draft.image || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
          isPopular: false,
          isBundle: false,
          bonusPoints: Math.floor(draft.price * 0.05),
          rating: 5,
          reviewCount: 0
        })
      });

      if (res.ok) {
        setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'saved' } : d));
      } else {
        const errorData = await res.json();
        setDrafts(prev => prev.map(d => d.id === id ? { 
          ...d, 
          status: 'error', 
          errorMessage: errorData.error || 'Помилка при збереженні' 
        } : d));
      }
    } catch (err) {
      console.error(err);
      setDrafts(prev => prev.map(d => d.id === id ? { 
        ...d, 
        status: 'error', 
        errorMessage: 'Помилка при з\'єднанні з сервером' 
      } : d));
    }
  };

  const removeDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  const filteredDrafts = drafts.filter(d => filterCategory === 'all' || d.category === filterCategory);
  const totalPages = Math.ceil(filteredDrafts.length / itemsPerPage);
  const paginatedDrafts = filteredDrafts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-tiffany/30 bg-tiffany/5 rounded-3xl p-12 hover:border-tiffany hover:bg-tiffany/10 transition-all group">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFileUpload}
            className="hidden" 
            id="file-upload" 
          />
          <label htmlFor="file-upload" className="cursor-pointer text-center w-full">
            <div className="w-20 h-20 bg-tiffany text-white rounded-full flex items-center justify-center shadow-lg shadow-tiffany/20 group-hover:scale-110 transition-all mb-6 mx-auto">
              {isParsing ? <Loader2 className="animate-spin" /> : <Upload size={36} />}
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-2">Завантажити файл каталогу</div>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">Натисніть сюди, щоб вибрати файл .xlsx або .csv з вашим списком товарів</p>
            <div className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-tiffany transition-all">
              Вибрати файл
            </div>
          </label>
        </div>

        {drafts.length > 0 && (
          <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-tiffany/10 text-tiffany rounded-full flex items-center justify-center">
                <FileText size={20} />
              </div>
              <div>
                <div className="font-bold text-slate-900">Модерація товарів</div>
                <div className="text-xs text-slate-500">Перевірте дані перед публікацією</div>
              </div>
            </div>
            <div className="text-sm font-bold text-slate-900">
              {drafts.filter(d => d.status === 'saved').length} / {drafts.length} збережено
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {drafts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold">Знайдено товарів: {drafts.filter(d => d.status !== 'saved').length}</h3>
                {drafts.some(d => d.status === 'ready' || (d.status === 'pending' && d.category)) && (
                  <button 
                    onClick={async () => {
                      const toSave = drafts.filter(d => (d.status === 'ready' || d.status === 'pending') && d.category);
                      if (confirm(`Опублікувати ${toSave.length} товарів?`)) {
                        for (const d of toSave) {
                          await saveProduct(d.id);
                        }
                      }
                    }}
                    className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all flex items-center gap-2"
                  >
                    <Check size={16} /> Опублікувати всі готові
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <select 
                  value={filterCategory}
                  onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
                  className="bg-slate-50 border-none rounded-xl p-2 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-tiffany cursor-pointer"
                >
                  <option value="all">Всі категорії</option>
                  <option value="">Без категорії</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
                <button 
                  onClick={() => setDrafts([])}
                  className="text-sm text-red-500 font-bold hover:underline"
                >
                  Очистити список
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {paginatedDrafts.map((draft) => (
                <motion.div 
                  key={draft.id}
                  layout
                  className={`bg-white p-6 rounded-3xl border transition-all ${
                    draft.status === 'saved' ? 'border-emerald-100 bg-emerald-50/30 opacity-60' : 
                    draft.status === 'error' ? 'border-red-100 bg-red-50/30' :
                    draft.isDuplicate ? 'border-amber-100 bg-amber-50/30' :
                    'border-slate-100 shadow-sm'
                  }`}
                >
                  {draft.isDuplicate && draft.status !== 'saved' && (
                    <div className="flex items-center gap-2 text-amber-600 text-xs font-bold mb-4 bg-amber-100/50 p-2 rounded-xl">
                      <AlertTriangle size={14} /> Увага: Товар з такою назвою вже є в базі даних
                    </div>
                  )}
                  {draft.status === 'error' && (
                    <div className="flex items-center gap-2 text-red-600 text-xs font-bold mb-4 bg-red-100/50 p-2 rounded-xl">
                      <X size={14} /> Помилка: {draft.errorMessage}
                    </div>
                  )}
                  <div className="flex flex-col gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Назва</label>
                          <input 
                            type="text" 
                            value={draft.name}
                            onChange={(e) => setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, name: e.target.value } : d))}
                            className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Ціна (грн)</label>
                          <input 
                            type="number" 
                            value={draft.price}
                            onChange={(e) => setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, price: parseFloat(e.target.value) } : d))}
                            className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Залишок</label>
                          <input 
                            type="number" 
                            value={draft.stock}
                            onChange={(e) => setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, stock: parseFloat(e.target.value) } : d))}
                            className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Категорія</label>
                          <select 
                            value={draft.category}
                            onChange={(e) => setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, category: e.target.value } : d))}
                            className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                          >
                            <option value="">Виберіть категорію</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.slug}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Опис</label>
                          <button 
                            onClick={() => generateDescription(draft.id)}
                            disabled={draft.status === 'processing' || draft.status === 'saved'}
                            className="flex items-center gap-1 text-[10px] font-bold text-tiffany hover:text-tiffany/80 transition-colors disabled:opacity-50"
                          >
                            {draft.status === 'processing' ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                            Згенерувати AI Опис
                          </button>
                        </div>
                        <textarea 
                          value={draft.description}
                          onChange={(e) => setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, description: e.target.value } : d))}
                          rows={3}
                          className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany resize-none"
                        />
                      </div>

                      {draft.variants && draft.variants.length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Варіанти (Розміри)</label>
                          <div className="space-y-2">
                            {draft.variants.map((v, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <input 
                                  type="text" 
                                  value={v.size}
                                  onChange={(e) => {
                                    const newVariants = [...(draft.variants || [])];
                                    newVariants[idx].size = e.target.value;
                                    setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, variants: newVariants } : d));
                                  }}
                                  className="flex-1 bg-white border-none rounded-lg p-2 text-xs focus:ring-1 focus:ring-tiffany"
                                  placeholder="Розмір"
                                />
                                <input 
                                  type="number" 
                                  value={v.price}
                                  onChange={(e) => {
                                    const newVariants = [...(draft.variants || [])];
                                    newVariants[idx].price = parseFloat(e.target.value);
                                    setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, variants: newVariants } : d));
                                  }}
                                  className="w-24 bg-white border-none rounded-lg p-2 text-xs focus:ring-1 focus:ring-tiffany"
                                  placeholder="Ціна"
                                />
                                <button 
                                  onClick={() => {
                                    const newVariants = draft.variants?.filter((_, i) => i !== idx);
                                    setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, variants: newVariants } : d));
                                  }}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">URL Фото або Завантажити</label>
                          <button 
                            onClick={() => generateImage(draft.id)}
                            disabled={draft.status === 'processing' || draft.status === 'saved'}
                            className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors disabled:opacity-50"
                          >
                            {draft.status === 'processing' ? <Loader2 className="animate-spin" size={12} /> : <ImageIcon size={12} />}
                            Згенерувати AI Фото
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="https://..."
                            value={draft.image}
                            onChange={(e) => setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, image: e.target.value } : d))}
                            className="flex-1 bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                          />
                          <div className="relative w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden group cursor-pointer hover:bg-slate-200 transition-colors">
                            {draft.image ? <img src={draft.image} className="w-full h-full object-cover" /> : <Upload size={20} />}
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.readAsDataURL(file);
                                  reader.onload = () => {
                                    setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, image: reader.result as string } : d));
                                  };
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                      {draft.status === 'saved' ? (
                        <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm px-4 py-2">
                          <Check size={16} /> Збережено
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => removeDraft(draft.id)}
                            className="flex items-center justify-center gap-2 bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-500 px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
                          >
                            <X size={16} /> Видалити
                          </button>
                          <button 
                            onClick={() => saveProduct(draft.id)}
                            className="flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-tiffany px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-900/10"
                          >
                            <Save size={16} /> Опублікувати
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl font-bold text-sm bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-all"
                >
                  Попередня
                </button>
                <div className="text-sm font-bold text-slate-500 px-4">
                  Сторінка {currentPage} з {totalPages}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-xl font-bold text-sm bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-all"
                >
                  Наступна
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
