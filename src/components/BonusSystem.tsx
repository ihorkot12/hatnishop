import React from 'react';
import { motion } from 'framer-motion';
import { Gift, ShieldCheck, Star } from 'lucide-react';
import { formatCashbackRate, loyaltyTiers } from '../utils/loyalty';
import { Eyebrow } from './Eyebrow';

export const BonusSystem = () => {
  return (
    <section className="bg-cream py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <Eyebrow icon={<Gift size={14} />}>Програма лояльності</Eyebrow>
            <h2 className="text-3xl font-serif font-bold leading-tight text-slate-950 sm:text-4xl">
              Бонуси, які не заважають купувати красиво
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-slate-600 md:text-right">
            Кешбек повертається на рахунок після підтвердження замовлення. Статус росте разом із історією покупок.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {loyaltyTiers.map((tier, index) => (
            <motion.article
              key={tier.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              viewport={{ once: true }}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${tier.tone}`}>
                    <Star size={16} fill="currentColor" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{tier.name}</span>
                </div>
                <div className="text-3xl font-bold leading-none text-slate-950">{formatCashbackRate(tier.cashbackRate)}</div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-tiffany" style={{ width: `${55 + index * 20}%` }} />
                </div>
                <span className="whitespace-nowrap text-xs text-slate-500">
                  {tier.minSpent === 0 ? 'від 1-ї покупки' : `від ${tier.minSpent.toLocaleString('uk-UA')} грн`}
                </span>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:gap-8">
          <div className="grid flex-1 gap-4 sm:grid-cols-3">
            {[
              'Увійдіть у профіль перед покупкою',
              'Оплатіть або завершіть замовлення',
              'Витратьте бонуси до 30% наступної суми',
            ].map((item, index) => (
              <div key={item} className="flex items-start gap-2.5">
                <span className="text-xs font-bold text-tiffany">0{index + 1}</span>
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-slate-950 px-5 py-3 text-white sm:shrink-0">
            <ShieldCheck size={26} className="shrink-0 text-tiffany" />
            <div>
              <span className="text-2xl font-bold">30%</span>
              <span className="ml-2 text-xs leading-5 text-white/65">максимум оплати бонусами</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
