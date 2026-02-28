import React from 'react';
import { Truck, RotateCcw, ShieldCheck, Gift } from 'lucide-react';

export const TopBar = () => {
  return (
    <div className="bg-slate-900 text-white py-2.5 px-4 overflow-hidden border-b border-white/5">
      <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] uppercase tracking-[0.15em] font-bold">
        <div className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Truck size={14} className="text-tiffany" />
            <span>Безкоштовна доставка від 1500 грн</span>
          </div>
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-tiffany" />
            <span>14 днів на повернення</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mx-auto md:mx-0">
          <Gift size={14} className="text-tiffany animate-pulse" />
          <span>5% кешбек на кожну покупку</span>
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <ShieldCheck size={14} className="text-tiffany" />
          <span>Гарантія якості</span>
        </div>
      </div>
    </div>
  );
};
