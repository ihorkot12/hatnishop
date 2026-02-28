import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, Minus, ArrowRight, CreditCard, Truck, CheckCircle2, Star, ShieldCheck, RotateCcw } from 'lucide-react';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { Link } from 'react-router-dom';

export const Cart = () => {
  const { cart, updateQuantity, removeFromCart, totalPrice, clearCart, userBonuses, appliedBonuses, applyBonuses } = useCart();
  const { user } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: '',
    city: '',
    deliveryMethod: 'nova-poshta' as 'nova-poshta' | 'ukr-poshta',
    warehouse: '',
    paymentMethod: 'cash' as 'mono' | 'liqpay' | 'cash'
  });

  const [useBonuses, setUseBonuses] = useState(false);

  const finalTotal = totalPrice - (useBonuses ? appliedBonuses : 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    const order = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      userId: user?.id,
      customer: {
        name: formData.name,
        phone: formData.phone,
        city: formData.city,
        deliveryMethod: formData.deliveryMethod,
        warehouse: formData.warehouse,
        address: `${formData.city}, ${formData.warehouse}`
      },
      items: cart,
      total: totalPrice,
      bonusUsed: useBonuses ? appliedBonuses : 0,
      finalTotal: finalTotal,
      paymentMethod: formData.paymentMethod
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      if (res.ok) {
        setIsSuccess(true);
        clearCart();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleBonuses = () => {
    if (!useBonuses) {
      applyBonuses(Math.min(userBonuses, totalPrice * 0.5));
    }
    setUseBonuses(!useBonuses);
  };

  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-32 text-center">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100"
        >
          <div className="w-20 h-20 bg-tiffany/10 text-tiffany rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 size={48} />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Дякуємо за замовлення!</h1>
          <p className="text-slate-500 text-lg mb-4">
            Ми вже почали готувати ваші "Хатні Штучки" до відправки.
          </p>
          <div className="bg-tiffany/5 p-4 rounded-2xl mb-10">
            <p className="text-tiffany font-bold">Ви отримали +{Math.floor(finalTotal * 0.05)} бонусів за цю покупку!</p>
            <p className="text-xs text-slate-400">Бонуси стануть доступні після отримання замовлення.</p>
          </div>
          <Link to="/" className="inline-block bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-tiffany transition-all">
            На головну
          </Link>
        </motion.div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-32 text-center">
        <div className="mb-8 text-slate-200 flex justify-center">
          <CreditCard size={120} strokeWidth={1} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Ваш кошик порожній</h1>
        <p className="text-slate-500 mb-10">Здається, ви ще не обрали нічого для свого затишку.</p>
        <Link to="/catalog" className="bg-tiffany text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-900 transition-all">
          Перейти до покупок
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-4 mb-12">
        <h1 className="text-4xl font-serif font-bold text-slate-900">Оформлення замовлення</h1>
        <div className="h-px bg-slate-200 flex-grow hidden md:block" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Side: Cart + Form */}
        <div className="lg:col-span-8 space-y-12">
          {/* Cart Items */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm">1</span>
              Ваш кошик
            </h2>
            <div className="space-y-4">
              {cart.map(item => (
                <motion.div 
                  key={item.id}
                  layout
                  className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-6 shadow-sm"
                >
                  <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg mb-1">{item.name}</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-2 hover:bg-slate-50 text-slate-500"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-2 hover:bg-slate-50 text-slate-500"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-900">{item.price * item.quantity} грн</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Checkout Form */}
          <form id="checkout-form" onSubmit={handleCheckout} className="space-y-12">
            {/* Customer Details */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm">2</span>
                Контактні дані
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Ваше ім'я</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Іван Іванов"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-tiffany transition-all"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Телефон</label>
                  <input 
                    required
                    type="tel" 
                    placeholder="+380"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-tiffany transition-all"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>
            </section>

            {/* Delivery */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm">3</span>
                Доставка
              </h2>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'nova-poshta', name: 'Нова Пошта', icon: <Truck size={20} /> },
                    { id: 'ukr-poshta', name: 'Укрпошта', icon: <Truck size={20} /> }
                  ].map(method => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setFormData({...formData, deliveryMethod: method.id as any})}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${formData.deliveryMethod === method.id ? 'border-tiffany bg-tiffany/5 text-tiffany' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                    >
                      {method.icon}
                      <span className="font-bold text-sm">{method.name}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Місто</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Київ"
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-tiffany transition-all"
                      value={formData.city}
                      onChange={e => setFormData({...formData, city: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Відділення / Поштомат</label>
                    <input 
                      required
                      type="text" 
                      placeholder="№1 або вул. Лесі Українки, 1"
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-tiffany transition-all"
                      value={formData.warehouse}
                      onChange={e => setFormData({...formData, warehouse: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Payment */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm">4</span>
                Оплата
              </h2>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'mono', name: 'Mono Pay', icon: <CreditCard size={20} /> },
                  { id: 'liqpay', name: 'LiqPay', icon: <CreditCard size={20} /> },
                  { id: 'cash', name: 'Накладений платіж', icon: <Truck size={20} /> }
                ].map(method => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setFormData({...formData, paymentMethod: method.id as any})}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${formData.paymentMethod === method.id ? 'border-tiffany bg-tiffany/5 text-tiffany' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                  >
                    {method.icon}
                    <span className="font-bold text-sm">{method.name}</span>
                  </button>
                ))}
              </div>
            </section>
          </form>
        </div>

        {/* Right Side: Summary */}
        <div className="lg:col-span-4">
          <div className="sticky top-32 space-y-6">
            {/* Bonus Widget */}
            {user && (
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gold/10 text-gold rounded-full flex items-center justify-center">
                      <Star size={20} fill="currentColor" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Ваші бонуси</h3>
                      <p className="text-xs text-slate-500">{userBonuses} доступно</p>
                    </div>
                  </div>
                  <button 
                    onClick={toggleBonuses}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${useBonuses ? 'bg-gold text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {useBonuses ? 'Застосовано' : 'Застосувати'}
                  </button>
                </div>
                {useBonuses && (
                  <div className="text-[10px] text-gold font-bold uppercase tracking-widest">
                    Знижка: -{appliedBonuses} грн
                  </div>
                )}
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-900/20">
              <h2 className="text-2xl font-bold mb-8">Підсумок</h2>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-white/60 text-sm">
                  <span>Товари ({cart.length})</span>
                  <span>{totalPrice} грн</span>
                </div>
                {useBonuses && (
                  <div className="flex justify-between text-gold text-sm">
                    <span>Бонуси</span>
                    <span>-{appliedBonuses} грн</span>
                  </div>
                )}
                <div className="flex justify-between text-white/60 text-sm">
                  <span>Доставка</span>
                  <span className="text-tiffany">Безкоштовно</span>
                </div>
                <div className="h-px bg-white/10 my-4" />
                <div className="flex justify-between text-2xl font-bold">
                  <span>Разом</span>
                  <span className="text-tiffany">{finalTotal} грн</span>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl text-center">
                  <div className="text-tiffany font-bold text-sm">+{Math.floor(finalTotal * 0.05)} бонусів</div>
                  <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Отримаєте за покупку</div>
                </div>
              </div>

              <button 
                form="checkout-form"
                type="submit"
                className="w-full bg-tiffany text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-white hover:text-tiffany transition-all shadow-xl shadow-tiffany/20"
              >
                Підтвердити замовлення
              </button>
              
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3 text-[10px] text-white/40 uppercase tracking-widest font-bold">
                  <ShieldCheck size={16} className="text-tiffany" />
                  <span>Безпечна оплата</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/40 uppercase tracking-widest font-bold">
                  <RotateCcw size={16} className="text-tiffany" />
                  <span>14 днів на повернення</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
