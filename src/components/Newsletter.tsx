import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Mail, Send } from 'lucide-react';

export const Newsletter = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubscribed(true);
  };

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-[#f8f4ef] lg:grid-cols-[1fr_0.78fr]">
          <div className="p-8 sm:p-12 lg:p-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-tiffany/20 bg-white/70 px-4 py-2 text-[11px] font-bold uppercase text-tiffany">
              <Mail size={14} />
              Листи з користю
            </div>
            <h2 className="max-w-2xl text-4xl font-serif font-bold leading-tight text-slate-950 sm:text-5xl">
              Першими показуємо нові добірки і тихі знижки
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Без спаму. Тільки нові поставки, готові поєднання, сезонні промокоди та короткі ідеї для дому.
            </p>
          </div>

          <div className="flex items-center bg-white p-6 sm:p-8 lg:p-10">
            {subscribed ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-lg border border-emerald-100 bg-emerald-50 p-6 text-center"
              >
                <CheckCircle2 size={34} className="mx-auto mb-4 text-emerald-600" />
                <h3 className="text-xl font-bold text-slate-950">Підписку оформлено</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Дякуємо. Найцікавіші добірки прийдуть на {email}.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="w-full space-y-3">
                <label htmlFor="newsletter-email" className="text-sm font-bold text-slate-950">
                  Email для добірок
                </label>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    id="newsletter-email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-[52px] rounded-lg border border-slate-200 bg-white px-4 text-slate-950 outline-none transition-colors focus:border-tiffany"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-[52px] items-center justify-center gap-2 rounded-lg bg-slate-950 px-6 font-bold text-white transition-colors hover:bg-tiffany"
                  >
                    Підписатися <Send size={17} />
                  </button>
                </div>
                <p className="text-xs leading-5 text-slate-400">
                  Натискаючи кнопку, ви погоджуєтеся отримувати листи від магазину. Відписатися можна будь-коли.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
