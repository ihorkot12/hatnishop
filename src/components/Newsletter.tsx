import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Send, CheckCircle2 } from 'lucide-react';

export const Newsletter = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribed(true);
  };

  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-tiffany/5 rounded-[3rem] p-12 lg:p-24 relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-16">
          <div className="absolute top-0 left-0 w-1/3 h-full bg-tiffany/5 skew-x-12 -translate-x-1/4" />
          
          <div className="max-w-xl relative z-10 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-tiffany/10 text-tiffany text-[10px] uppercase font-bold tracking-widest mb-6">
              <Mail size={14} fill="currentColor" />
              <span>Будьте в курсі</span>
            </div>
            <h2 className="text-5xl font-serif font-bold text-slate-900 mb-6 leading-tight">Даруємо <span className="text-tiffany italic">200 бонусів</span> за підписку</h2>
            <p className="text-slate-500 text-lg">Підпишіться на нашу розсилку, щоб першими дізнаватися про нові колекції, акції та отримувати персональні пропозиції.</p>
          </div>

          <div className="w-full max-w-md relative z-10">
            {subscribed ? (
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white p-10 rounded-[2rem] shadow-xl border border-slate-100 text-center"
              >
                <div className="w-16 h-16 bg-tiffany/10 text-tiffany rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Дякуємо за підписку!</h3>
                <p className="text-slate-500">Ваші 200 бонусів вже чекають на вас у профілі.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white p-4 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 flex flex-col sm:flex-row gap-4 border border-slate-100">
                <input 
                  type="email" 
                  placeholder="Ваш email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-grow bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 focus:ring-2 focus:ring-tiffany transition-all"
                />
                <button 
                  type="submit"
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-tiffany transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10"
                >
                  Отримати <Send size={18} />
                </button>
              </form>
            )}
            <p className="text-center text-[10px] text-slate-400 mt-6 uppercase tracking-widest font-bold">Натискаючи кнопку, ви погоджуєтесь з політикою конфіденційності</p>
          </div>
        </div>
      </div>
    </section>
  );
};
