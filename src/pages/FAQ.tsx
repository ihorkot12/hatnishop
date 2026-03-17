import React from 'react';
import { motion } from 'framer-motion';
import { Truck, RotateCcw, HelpCircle } from 'lucide-react';

export const FAQ = () => {
  const sections = [
    {
      title: 'Доставка та оплата',
      icon: <Truck className="text-tiffany" size={24} />,
      items: [
        { q: 'Які терміни відправки замовлення?', a: 'Ми відправляємо замовлення протягом 1-2 робочих днів після підтвердження. Зазвичай, якщо ви замовили до 14:00, посилка поїде до вас того ж дня.' },
        { q: 'Якими службами доставки ви користуєтесь?', a: 'Наразі ми працюємо з Новою Поштою (у відділення, поштомат або кур\'єром).' },
        { q: 'Скільки коштує доставка?', a: 'Вартість доставки розраховується за тарифами перевізника. При замовленні на суму від 3000 грн доставка у відділення — безкоштовна.' },
        { q: 'Як можна оплатити замовлення?', a: 'Ви можете оплатити замовлення онлайн картою (Apple Pay, Google Pay) або при отриманні у відділенні (накладений платіж).' }
      ]
    },
    {
      title: 'Повернення та обмін',
      icon: <RotateCcw className="text-tiffany" size={24} />,
      items: [
        { q: 'Що робити, якщо товар приїхав пошкодженим?', a: 'Обов\'язково перевіряйте посилку при отриманні. Якщо ви помітили пошкодження, складіть акт у відділенні Нової Пошти та відмовтесь від отримання. Потім повідомте нам, і ми надішлемо новий товар або повернемо кошти.' },
        { q: 'Чи можна повернути товар, якщо він мені не підійшов?', a: 'Так, ви можете повернути або обміняти товар протягом 14 днів з моменту отримання, якщо він не був у використанні та зберіг товарний вигляд і пакування.' },
        { q: 'Хто оплачує доставку при поверненні?', a: 'Якщо повернення відбувається через брак або помилку з нашого боку — доставку оплачуємо ми. В інших випадках доставку оплачує покупець.' }
      ]
    }
  ];

  return (
    <div className="bg-white min-h-screen pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <div className="text-tiffany font-bold text-[10px] uppercase tracking-[0.2em] mb-4">Допомога</div>
          <h1 className="text-5xl font-serif font-bold text-slate-900 mb-8 leading-tight">
            Поширені <span className="text-tiffany italic">запитання</span>
          </h1>
          <p className="text-slate-500 text-lg">
            Ми зібрали відповіді на найчастіші запитання, щоб ваш шопінг був максимально комфортним та зрозумілим.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-20">
          {sections.map((section, idx) => (
            <div key={idx}>
              <div className="flex items-center gap-4 mb-10 pb-4 border-b border-slate-100">
                <div className="p-3 bg-tiffany/10 rounded-2xl">
                  {section.icon}
                </div>
                <h2 className="text-3xl font-serif font-bold text-slate-900">{section.title}</h2>
              </div>
              <div className="space-y-6">
                {section.items.map((item, i) => (
                  <div key={i} className="bg-slate-50 p-8 rounded-[2rem] border border-transparent hover:border-tiffany/20 transition-all group">
                    <div className="flex gap-4">
                      <HelpCircle className="text-slate-300 group-hover:text-tiffany transition-colors shrink-0" size={20} />
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-3">{item.q}</h3>
                        <p className="text-slate-600 leading-relaxed">{item.a}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-32 p-12 bg-tiffany/5 rounded-[3rem] border border-tiffany/10 text-center max-w-3xl mx-auto">
          <h3 className="text-2xl font-serif font-bold text-slate-900 mb-4">Не знайшли відповідь?</h3>
          <p className="text-slate-600 mb-8">Напишіть нам у Telegram або Instagram, і ми з радістю вам допоможемо!</p>
          <div className="flex justify-center gap-4">
            <a href="#" className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-tiffany transition-all">Написати нам</a>
          </div>
        </div>
      </div>
    </div>
  );
};
