import React from 'react';
import { motion } from 'framer-motion';
import { Gift, ShieldCheck, Star } from 'lucide-react';
import { formatCashbackRate, loyaltyTiers } from '../utils/loyalty';
import { Eyebrow } from './Eyebrow';

export const BonusSystem = () => {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <Eyebrow icon={<Gift size={14} />}>Програма лояльності</Eyebrow>
          <h2 className="text-4xl font-serif font-bold leading-tight text-slate-950 sm:text-5xl">
            Бонуси, які не заважають купувати красиво
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Після підтвердження замовлення кешбек повертається на рахунок. Статус росте разом із вашою історією покупок.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {loyaltyTiers.map((tier, index) => (
            <motion.article
              key={tier.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              viewport={{ once: true }}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className={`mb-8 inline-flex h-12 w-12 items-center justify-center rounded-lg border ${tier.tone}`}>
                <Star size={24} fill="currentColor" />
              </div>
              <div className="text-[11px] font-bold uppercase text-slate-400">{tier.name}</div>
              <div className="mt-2 text-5xl font-bold text-slate-950">{formatCashbackRate(tier.cashbackRate)}</div>
              <div className="mt-2 text-sm text-slate-500">
                кешбек, {tier.minSpent === 0 ? 'від першої покупки' : `від ${tier.minSpent.toLocaleString('uk-UA')} грн`}
              </div>
              <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-tiffany" style={{ width: `${55 + index * 20}%` }} />
              </div>
            </motion.article>
          ))}
        </div>

        <div className="mt-6 grid overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid-cols-[1fr_0.8fr]">
          <div className="p-6 sm:p-8">
            <h3 className="text-3xl font-serif font-bold text-slate-950">Як це працює</h3>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {[
                'Увійдіть у профіль перед покупкою',
                'Оплатіть або завершіть замовлення',
                'Використайте бонуси до 30% наступної суми',
              ].map((item, index) => (
                <div key={item} className="border-l border-slate-200 pl-4">
                  <div className="mb-3 text-xs font-bold text-tiffany">0{index + 1}</div>
                  <p className="text-sm leading-6 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-6 bg-slate-950 p-6 text-white sm:p-8">
            <ShieldCheck size={38} className="shrink-0 text-tiffany" />
            <div>
              <div className="text-4xl font-bold">30%</div>
              <p className="mt-1 text-sm leading-6 text-white/65">максимум замовлення, який можна оплатити бонусами</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
