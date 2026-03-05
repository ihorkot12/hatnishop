import React, { useState, useEffect } from 'react';
import { Truck, RotateCcw, ShieldCheck, Gift } from 'lucide-react';

export const TopBar = () => {
  const [settings, setSettings] = useState({
    free_delivery_min: 1500,
    return_days: 14,
    cashback_percent: 5
  });

  useEffect(() => {
    fetch('/api/site-settings')
      .then(res => res.json())
      .then(data => {
        if (data) setSettings(data);
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="bg-slate-900 text-white py-2.5 px-4 overflow-hidden border-b border-white/5">
      <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] uppercase tracking-[0.15em] font-bold">
        <div className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Truck size={14} className="text-tiffany" />
            <span>{settings.free_delivery_min > 0 ? `Безкоштовна доставка від ${settings.free_delivery_min} грн` : 'Безкоштовна доставка на все'}</span>
          </div>
          {settings.return_days > 0 && (
            <div className="flex items-center gap-2">
              <RotateCcw size={14} className="text-tiffany" />
              <span>{settings.return_days} днів на повернення</span>
            </div>
          )}
        </div>
        
        {settings.cashback_percent > 0 && (
          <div className="flex items-center gap-2 mx-auto md:mx-0">
            <Gift size={14} className="text-tiffany animate-pulse" />
            <span>{settings.cashback_percent}% кешбек на кожну покупку</span>
          </div>
        )}

        <div className="hidden lg:flex items-center gap-2">
          <ShieldCheck size={14} className="text-tiffany" />
          <span>Гарантія якості</span>
        </div>
      </div>
    </div>
  );
};
