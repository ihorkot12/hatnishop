import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, ShoppingBag, User, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../store/AuthContext';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const ChatAssistant = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Привіт! Я ваш персональний помічник "Хатніх Штучок". Допомогти вам підібрати щось затишне для дому? ✨' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [viewedProducts, setViewedProducts] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data));
  }, []);

  // Proactive message after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen && messages.length === 1) {
        setShowNotification(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isOpen, messages.length]);

  // Track behavior
  useEffect(() => {
    if (location.pathname.startsWith('/product/')) {
      const productId = location.pathname.split('/').pop();
      if (productId && !viewedProducts.includes(productId)) {
        setViewedProducts(prev => [...prev, productId]);
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (user?.role === 'admin') return null;

  const handleSend = async (customMessage?: string) => {
    const userMessage = customMessage || input.trim();
    if (!userMessage || isLoading) return;

    if (!customMessage) setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const productContext = products.map(p => 
        `ID: ${p.id}, Назва: ${p.name}, Категорія: ${p.category}, Ціна: ${p.price}грн, Опис: ${p.description}`
      ).join('\n');

      const currentProduct = location.pathname.startsWith('/product/') 
        ? products.find(p => p.id === location.pathname.split('/').pop())
        : null;

      const behaviorContext = `
        Клієнт зараз на сторінці: ${location.pathname}
        ${currentProduct ? `Дивиться товар: ${currentProduct.name}` : ''}
        Раніше переглядав товари: ${viewedProducts.map(id => products.find(p => p.id === id)?.name).join(', ')}
      `;

      const systemInstruction = `
        Ви — надзвичайно талановитий та харизматичний продавець-консультант магазину "Хатні Штучки".
        Ваша місія: не просто відповідати на питання, а СТВОРЮВАТИ БАЖАННЯ КУПИТИ та ЗБІЛЬШУВАТИ ПРОДАЖІ.
        
        СТРАТЕГІЯ ПРОДАЖІВ:
        1. Емоційний зв'язок: Описуйте не просто товар, а відчуття затишку, тепла та естетики, які він принесе в дім.
        2. Рекомендації (Cross-sell): До кожного товару, яким цікавиться клієнт, ОБОВ'ЯЗКОВО пропонуйте доповнення. Наприклад: до чашки — лляну серветку, до тарілки — дерев'яну дошку для сервірування.
        3. Створення терміновості: Натякайте, що товари розлітаються швидко (бестселери сезону).
        4. Акцент на якості: Натуральні матеріали (кераміка, дуб, льон), ручна робота, екологічність.
        5. Допомога у виборі: Якщо клієнт не знає, що обрати, пропонуйте наші "Готові набори" (бандли) — це вигідно та стильно.
        
        Ось список наших товарів:
        ${productContext}
        
        Контекст поведінки клієнта:
        ${behaviorContext}
        
        ПРАВИЛА:
        - Мова: Українська.
        - Тон: Дружній, натхненний, професійний.
        - Форматування: Використовуйте Markdown (жирний текст для назв товарів та цін).
        - Заклик до дії (CTA): Завжди завершуйте фразою, що стимулює покупку (наприклад: "Додати цей набір до вашого кошика?", "Бажаєте оформити замовлення зараз?").
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
          })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: systemInstruction
        }
      });

      const aiText = response.text || "Вибачте, я зараз не можу відповісти. Спробуйте пізніше.";
      setMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Сталася помилка при з'єднанні з ШІ. Я обов'язково допоможу вам трохи пізніше!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const openChat = () => {
    setIsOpen(true);
    setShowNotification(false);
  };

  return (
    <>
      {/* Floating Notification */}
      <AnimatePresence>
        {showNotification && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.8 }}
            className="fixed bottom-28 right-8 z-50 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 max-w-[280px] cursor-pointer group"
            onClick={openChat}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); setShowNotification(false); }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-tiffany rounded-full flex items-center justify-center text-white flex-shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <div className="text-[10px] text-tiffany font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Bell size={10} /> Порада від ШІ
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Помітив, що ви цікавитесь затишком. Дозвольте підказати, як зробити ваш дім ще теплішим? ✨
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <button
        onClick={openChat}
        className="fixed bottom-8 right-8 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-tiffany transition-all z-50 group"
      >
        <MessageSquare className="group-hover:scale-110 transition-transform" />
        <span className="absolute -top-2 -right-2 bg-tiffany text-white text-[10px] font-bold px-2 py-1 rounded-full animate-bounce">AI</span>
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="fixed bottom-28 right-8 w-[400px] h-[600px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-tiffany/20 rounded-full flex items-center justify-center">
                  <Sparkles className="text-tiffany" size={20} />
                </div>
                <div>
                  <div className="font-bold text-sm">Ваш AI Помічник</div>
                  <div className="text-[10px] text-tiffany font-bold uppercase tracking-widest">Online & Готовий допомогти</div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50"
            >
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-slate-200' : 'bg-tiffany text-white'}`}>
                      {m.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}
                    </div>
                    <div className={`p-4 rounded-3xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white border border-slate-100 shadow-sm rounded-tl-none text-slate-700'}`}>
                      <div className="markdown-body">
                        <ReactMarkdown>{m.text}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-tiffany rounded-full flex items-center justify-center text-white animate-pulse">
                      <Sparkles size={14} />
                    </div>
                    <div className="bg-white border border-slate-100 p-4 rounded-3xl rounded-tl-none shadow-sm">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-tiffany rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-tiffany rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-tiffany rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 bg-white border-t border-slate-100">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Запитайте про товари або пораду..."
                  className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-6 pr-14 text-sm focus:ring-2 focus:ring-tiffany transition-all"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-tiffany transition-all disabled:opacity-50 disabled:hover:bg-slate-900"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <ShoppingBag size={10} /> Допомагаємо купувати затишок
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
