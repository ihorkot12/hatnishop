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
  const [isEnriching, setIsEnriching] = useState(false);
  const [existingProducts, setExistingProducts] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setExistingProducts(data))
      .catch(err => console.error(err));
  }, []);

  // Background enrichment queue
  useEffect(() => {
    if (isEnriching || isParsing) return;

    const nextPending = drafts.find(d => d.status === 'pending');
    if (nextPending) {
      const processNext = async () => {
        setIsEnriching(true);
        // Small delay to let UI breathe
        await new Promise(resolve => setTimeout(resolve, 1000));
        await autoGenerateAI(nextPending.id);
        setIsEnriching(false);
      };
      processNext();
    }
  }, [drafts, isEnriching, isParsing]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      // Use setTimeout to move parsing out of the main thread's immediate execution
      setTimeout(() => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          const draftsMap = new Map<string, DraftProduct>();
          
          data.forEach((row, index) => {
            if (index < 5) return;

            const name = row[0]?.toString().trim();
            const stock = parseFloat(row[1]) || 0;
            const price = parseFloat(row[2]) || 0;
            const size = row[3]?.toString().trim();

            if (!name || (!price && !stock)) return;

            const key = name.toLowerCase();
            if (draftsMap.has(key)) {
              const existing = draftsMap.get(key)!;
              if (size) {
                if (!existing.variants) existing.variants = [];
                existing.variants.push({ size, price, stock });
                existing.stock += stock;
              }
            } else {
              const isDuplicate = existingProducts.some(p => p.name.toLowerCase() === key);
              const newDraft: DraftProduct = {
                id: `draft-${Date.now()}-${index}`,
                name,
                price,
                stock,
                category: '',
                description: '',
                image: '',
                status: 'pending',
                isDuplicate,
                variants: size ? [{ size, price, stock }] : undefined
              };
              draftsMap.set(key, newDraft);
            }
          });

          setDrafts(Array.from(draftsMap.values()));
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

  const autoGenerateAI = async (id: string) => {
    // Get the latest draft state
    setDrafts(prev => {
      const draft = prev.find(d => d.id === id);
      if (!draft || draft.status !== 'pending') return prev;
      
      return prev.map(d => d.id === id ? { ...d, status: 'processing' } : d);
    });

    try {
      // We need to find the draft again to get its data
      const currentDrafts = await new Promise<DraftProduct[]>(resolve => {
        setDrafts(prev => {
          resolve(prev);
          return prev;
        });
      });
      
      const draft = currentDrafts.find(d => d.id === id);
      if (!draft) return;

      const category = draft.category || 'Дім';
      
      const [description, image] = await Promise.all([
        aiGenerateDescription(draft.name, category),
        aiGenerateProductImage(draft.name, category)
      ]);

      setDrafts(prev => prev.map(d => d.id === id ? { 
        ...d, 
        description: description || '', 
        image: image || '',
        status: 'ready' 
      } : d));
    } catch (err) {
      console.error('AI Auto-generation error:', err);
      setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'pending' } : d));
    }
  };

  const generateDescription = async (id: string) => {
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    
    if (draft.description && draft.description.trim().length > 0) {
      if (!confirm('Опис вже існує. Ви впевнені, що хочете перегенерувати його?')) {
        return;
      }
    }

    setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'processing' } : d));

    try {
      const text = await aiGenerateDescription(draft.name, draft.category);
      if (text) {
        setDrafts(prev => prev.map(d => d.id === id ? { 
          ...d, 
          description: text, 
          status: 'ready' 
        } : d));
      }
    } catch (err) {
      console.error(err);
      setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'pending' } : d));
    }
  };

  const generateImage = async (id: string) => {
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;

    setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'processing' } : d));

    try {
      const image = await aiGenerateProductImage(draft.name, draft.category);
      if (image) {
        setDrafts(prev => prev.map(d => d.id === id ? { 
          ...d, 
          image: image, 
          status: 'ready' 
        } : d));
      }
    } catch (err) {
      console.error(err);
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

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-12 hover:border-tiffany transition-all group">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFileUpload}
            className="hidden" 
            id="file-upload" 
          />
          <label htmlFor="file-upload" className="cursor-pointer text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:text-tiffany group-hover:bg-tiffany/10 transition-all mb-4 mx-auto">
              {isParsing ? <Loader2 className="animate-spin" /> : <Upload size={32} />}
            </div>
            <div className="text-lg font-bold text-slate-900 mb-2">Завантажити файл каталогу</div>
            <p className="text-slate-400 text-sm">Підтримуються формати .xlsx, .xls, .csv</p>
          </label>
        </div>

        {(isEnriching || drafts.some(d => d.status === 'pending')) && drafts.length > 0 && (
          <div className="mt-8 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Обробка товарів ШІ...</span>
              <span>{drafts.filter(d => d.status === 'ready' || d.status === 'saved' || d.status === 'error').length} / {drafts.length}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-tiffany"
                initial={{ width: 0 }}
                animate={{ width: `${(drafts.filter(d => d.status === 'ready' || d.status === 'saved' || d.status === 'error').length / drafts.length) * 100}%` }}
              />
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
              <h3 className="text-xl font-bold">Знайдено товарів: {drafts.filter(d => d.status !== 'saved').length}</h3>
              <button 
                onClick={() => setDrafts([])}
                className="text-sm text-red-500 font-bold hover:underline"
              >
                Очистити список
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {drafts.map((draft) => (
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
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
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

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <div className="flex items-end gap-2">
                          <button 
                            onClick={() => generateDescription(draft.id)}
                            disabled={draft.status === 'processing' || draft.status === 'saved'}
                            className="flex-1 flex items-center justify-center gap-2 bg-tiffany/10 text-tiffany hover:bg-tiffany hover:text-white px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                          >
                            {draft.status === 'processing' ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                            AI Опис
                          </button>
                          <button 
                            onClick={() => generateImage(draft.id)}
                            disabled={draft.status === 'processing' || draft.status === 'saved'}
                            className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                          >
                            {draft.status === 'processing' ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />}
                            AI Фото
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Опис</label>
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
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">URL Фото</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="https://..."
                            value={draft.image}
                            onChange={(e) => setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, image: e.target.value } : d))}
                            className="flex-1 bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                          />
                          <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden">
                            {draft.image ? <img src={draft.image} className="w-full h-full object-cover" /> : <ImageIcon size={20} />}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex lg:flex-col justify-end gap-2">
                      {draft.status === 'saved' ? (
                        <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm px-4 py-3">
                          <Check size={16} /> Збережено
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => saveProduct(draft.id)}
                            className="flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-tiffany px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-900/10"
                          >
                            <Save size={16} /> Опублікувати
                          </button>
                          <button 
                            onClick={() => removeDraft(draft.id)}
                            className="flex items-center justify-center gap-2 bg-red-50 text-red-500 hover:bg-red-100 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                          >
                            <X size={16} /> Видалити
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
