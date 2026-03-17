import React from 'react';
import { motion } from 'framer-motion';
import { Heart, ShieldCheck, Sparkles } from 'lucide-react';

export const AboutUs = () => {
  return (
    <div className="bg-white min-h-screen pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <div className="text-tiffany font-bold text-[10px] uppercase tracking-[0.2em] mb-4">Наша історія</div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold text-slate-900 mb-8 leading-tight">
            Хатні Штучки — це про <span className="text-tiffany italic">любов до дому</span>
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed">
            Ми віримо, що дім — це не просто стіни, а місце сили, де кожна деталь має значення. Наша місія — допомогти вам створити простір, який надихає та дарує спокій.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center mb-32">
          <div className="relative">
            <div className="aspect-[4/5] rounded-[3rem] overflow-hidden shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1200&q=80" 
                alt="Про нас" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-10 -right-10 bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-50 hidden lg:block">
              <div className="text-4xl font-serif font-bold text-slate-900 mb-2">2024</div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Рік заснування</div>
            </div>
          </div>
          <div className="space-y-8">
            <h2 className="text-4xl font-serif font-bold text-slate-900 leading-tight">Чому ми обрали саме ці товари?</h2>
            <p className="text-slate-600 leading-relaxed">
              Кожен предмет у нашому каталозі проходить ретельний відбір. Ми шукаємо речі, які поєднують у собі три важливі якості: естетику, функціональність та довговічність.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Ми особисто тестуємо більшість товарів, щоб бути впевненими — вони принесуть вам радість. Від керамічних горнят до лляного текстилю — ми обираємо те, що хотіли б бачити у власних оселях.
            </p>
            <div className="grid grid-cols-2 gap-6 pt-8">
              <div className="p-6 bg-slate-50 rounded-3xl">
                <Heart className="text-tiffany mb-4" size={24} />
                <div className="font-bold text-slate-900 mb-1">З душею</div>
                <div className="text-xs text-slate-500">Кожна посилка пакується з любов'ю</div>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl">
                <ShieldCheck className="text-tiffany mb-4" size={24} />
                <div className="font-bold text-slate-900 mb-1">Якість</div>
                <div className="text-xs text-slate-500">Тільки перевірені виробники</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[3rem] p-12 md:p-20 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <Sparkles className="absolute top-10 left-10 text-tiffany" size={100} />
             <Sparkles className="absolute bottom-10 right-10 text-tiffany" size={150} />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-8 leading-tight">Приєднуйтесь до нашої родини</h2>
            <p className="text-white/60 text-lg mb-12 leading-relaxed">
              Дякуємо, що обираєте "Хатні Штучки". Ми раді бути частиною вашого затишку.
            </p>
            <div className="flex flex-wrap justify-center gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-tiffany mb-1">5k+</div>
                <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Клієнтів</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-tiffany mb-1">10k+</div>
                <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Замовлень</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-tiffany mb-1">100%</div>
                <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Задоволення</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
