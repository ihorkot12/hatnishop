import React from 'react';
import { motion } from 'framer-motion';
import { Gift, TrendingUp, Star, ShieldCheck } from 'lucide-react';

const tiers = [
  { id: 'bronze', name: 'Bronze', rate: '5%', min: '0 грн', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  { id: 'silver', name: 'Silver', rate: '7%', min: '5 000 грн', color: 'text-slate-400', bg: 'bg-slate-400/10' },
  { id: 'gold', name: 'Gold', rate: '10%', min: '15 000 грн', color: 'text-gold', bg: 'bg-gold/10' },
];

export const BonusSystem = () => {
  return (
    <section className="py-24 bg-warm-bg overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-tiffany/10 text-tiffany text-[10px] uppercase font-bold tracking-widest mb-6">
            <Gift size={14} fill="currentColor" />
            <span>Програма лояльності</span>
          </div>
          <h2 className="text-5xl font-serif font-bold text-slate-900 mb-6 leading-tight">Купуйте — накопичуйте — <span className="text-tiffany italic">економте</span></h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg">Ваша лояльність винагороджується. Чим більше ви купуєте, тим вищий ваш статус та більший кешбек на наступні покупки.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {tiers.map((tier, idx) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 group"
            >
              <div className={`w-16 h-16 ${tier.bg} ${tier.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                <Star size={32} fill="currentColor" />
              </div>
              <h3 className={`text-2xl font-bold mb-2 ${tier.color}`}>{tier.name}</h3>
              <div className="text-4xl font-bold text-slate-900 mb-4">{tier.rate} <span className="text-sm font-normal text-slate-400">кешбек</span></div>
              <p className="text-slate-500 text-sm mb-8">Від {tier.min} загальних витрат</p>
              <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                <div className={`h-full ${tier.bg.replace('/10', '')} w-full opacity-30`} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="bg-slate-900 rounded-[3rem] p-12 flex flex-col lg:flex-row items-center justify-between gap-12 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-tiffany/10 -skew-x-12 translate-x-1/4" />
          
          <div className="max-w-xl relative z-10">
            <h3 className="text-3xl font-serif font-bold mb-4">Як це працює?</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-tiffany shrink-0">1</div>
                <p className="text-white/70">Робіть покупки на сайті, авторизувавшись у своєму профілі.</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-tiffany shrink-0">2</div>
                <p className="text-white/70">Отримуйте кешбек на бонусний рахунок після кожної покупки.</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-tiffany shrink-0">3</div>
                <p className="text-white/70">Оплачуйте бонусами до 50% вартості наступних замовлень.</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-center lg:text-left">
            <div className="text-tiffany font-bold text-6xl mb-4">50%</div>
            <p className="text-white/60 uppercase tracking-widest text-xs font-bold">Максимальна знижка бонусами</p>
          </div>
        </div>
      </div>
    </section>
  );
};
