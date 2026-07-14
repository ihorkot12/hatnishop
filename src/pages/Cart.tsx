import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, Minus, ArrowRight, CreditCard, Truck, CheckCircle2, Star, ShieldCheck, RotateCcw } from 'lucide-react';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { Link } from 'react-router-dom';
import { calculateBonusSpendLimit, formatCashbackRate, getCashbackRate, getLoyaltyProgress } from '../utils/loyalty';
import { fetchJsonCachedOr } from '../utils/apiCache';

type NovaPoshtaCity = {
  ref: string;
  name: string;
  area?: string;
  settlementType?: string;
};

type NovaPoshtaWarehouse = {
  ref: string;
  name: string;
  number?: string;
  type?: string;
};

export const Cart = () => {
  const { cart, updateQuantity, removeFromCart, totalPrice, clearCart, userBonuses, appliedBonuses, applyBonuses, activeBundleOffer, bundleDiscount, clearBundleOffer } = useCart();
  const { user } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{ cashbackPending: number } | null>(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: '',
    email: user?.email || '',
    city: '',
    deliveryMethod: 'nova-poshta' as 'nova-poshta' | 'ukr-poshta',
    warehouse: '',
    paymentMethod: 'cash' as 'mono' | 'liqpay' | 'cash' | 'card' | 'bank',
    comment: ''
  });

  const [useBonuses, setUseBonuses] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [isQuickOrder, setIsQuickOrder] = useState(false);
  const [bonusCode, setBonusCode] = useState('');
  const [appliedBonusCode, setAppliedBonusCode] = useState<any>(null);
  const [bonusCodeError, setBonusCodeError] = useState('');
  const [novaPoshtaCityRef, setNovaPoshtaCityRef] = useState('');
  const [novaPoshtaWarehouseRef, setNovaPoshtaWarehouseRef] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<NovaPoshtaCity[]>([]);
  const [warehouseSuggestions, setWarehouseSuggestions] = useState<NovaPoshtaWarehouse[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [freeDeliveryMin, setFreeDeliveryMin] = useState(1500);

  useEffect(() => {
    document.title = 'Кошик та оформлення замовлення — Хатні Штучки';
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchJsonCachedOr<any>('/api/site-settings', null)
      .then(settings => {
        if (cancelled || !settings) return;
        const threshold = Number(settings.free_delivery_min);
        if (Number.isFinite(threshold) && threshold >= 0) setFreeDeliveryMin(threshold);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (formData.deliveryMethod === 'nova-poshta') return;
    setNovaPoshtaCityRef('');
    setNovaPoshtaWarehouseRef('');
    setCitySuggestions([]);
    setWarehouseSuggestions([]);
    setIsLoadingCities(false);
    setIsLoadingWarehouses(false);
  }, [formData.deliveryMethod]);

  useEffect(() => {
    if (formData.deliveryMethod !== 'nova-poshta' || formData.city.trim().length < 2 || novaPoshtaCityRef) {
      setCitySuggestions([]);
      setIsLoadingCities(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoadingCities(true);
      try {
        const res = await fetch(`/api/delivery/nova-poshta/cities?q=${encodeURIComponent(formData.city.trim())}`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setCitySuggestions(res.ok ? await res.json() : []);
      } catch {
        if (!controller.signal.aborted) setCitySuggestions([]);
      } finally {
        if (!controller.signal.aborted) setIsLoadingCities(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [formData.city, formData.deliveryMethod, novaPoshtaCityRef]);

  useEffect(() => {
    if (formData.deliveryMethod !== 'nova-poshta' || !novaPoshtaCityRef || novaPoshtaWarehouseRef) {
      setWarehouseSuggestions([]);
      setIsLoadingWarehouses(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoadingWarehouses(true);
      try {
        const res = await fetch(`/api/delivery/nova-poshta/warehouses?cityRef=${encodeURIComponent(novaPoshtaCityRef)}&q=${encodeURIComponent(formData.warehouse.trim())}`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setWarehouseSuggestions(res.ok ? await res.json() : []);
      } catch {
        if (!controller.signal.aborted) setWarehouseSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setIsLoadingWarehouses(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [formData.deliveryMethod, formData.warehouse, novaPoshtaCityRef, novaPoshtaWarehouseRef]);

  const calculateDiscount = () => {
    if (!appliedBonusCode) return 0;
    if (appliedBonusCode.discount_type === 'percent') {
      return Math.floor((totalPrice * Number(appliedBonusCode.discount_amount || 0)) / 100);
    }
    return Math.floor(Number(appliedBonusCode.discount_amount || 0));
  };

  const promoDiscount = Math.min(Math.max(calculateDiscount(), 0), totalPrice);
  const bundleDiscountAmount = Math.min(Math.max(bundleDiscount, 0), Math.max(0, totalPrice - promoDiscount));
  const discount = promoDiscount + bundleDiscountAmount;
  const bonusBase = Math.max(0, totalPrice - discount);
  const bonusSpendLimit = calculateBonusSpendLimit(bonusBase);
  const availableBonuses = Math.max(0, Math.floor(userBonuses || 0));
  const usableBonusAmount = user ? Math.min(availableBonuses, bonusSpendLimit) : 0;
  const appliedBonusAmount = useBonuses ? Math.min(appliedBonuses, usableBonusAmount) : 0;
  const finalTotal = Math.max(0, bonusBase - appliedBonusAmount);
  // Оффер: перше замовлення зареєстрованого користувача — доставка безкоштовна без порогу.
  const isFirstOrder = !!user && Number(user.total_spent || 0) === 0;
  const isDeliveryFree = freeDeliveryMin <= 0 || totalPrice >= freeDeliveryMin || isFirstOrder;
  const deliveryRemaining = Math.max(0, freeDeliveryMin - totalPrice);
  const cashbackRate = getCashbackRate(user?.total_spent || 0);
  const cashbackPercent = formatCashbackRate(cashbackRate);
  const estimatedBonuses = user ? Math.floor(finalTotal * cashbackRate) : Math.floor(finalTotal * 0.05);
  const loyaltyProgress = getLoyaltyProgress(user?.total_spent || 0);

  const handleApplyBonusCode = async () => {
    if (!bonusCode.trim()) return;
    setBonusCodeError('');
    try {
      const res = await fetch(`/api/bonus-codes/validate/${bonusCode}`);
      if (res.ok) {
        const data = await res.json();
        if (totalPrice < data.min_order_amount) {
          setBonusCodeError(`Мінімальна сума замовлення для цього коду: ${data.min_order_amount} грн`);
          return;
        }
        setAppliedBonusCode(data);
      } else {
        const data = await res.json();
        setBonusCodeError(data.error || 'Невірний промокод');
      }
    } catch (err) {
      setBonusCodeError('Помилка при перевірці промокоду');
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setCheckoutError('');
    setIsSubmitting(true);
    const order = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      userId: user?.id,
      customer: {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        city: formData.city,
        deliveryMethod: formData.deliveryMethod,
        warehouse: formData.warehouse,
        address: `${formData.city}, ${formData.warehouse}`
      },
      items: cart,
      total: totalPrice,
      bonusUsed: appliedBonusAmount,
      promoCode: appliedBonusCode?.code,
      bundleOffer: activeBundleOffer && bundleDiscountAmount > 0 ? activeBundleOffer : undefined,
      finalTotal: finalTotal,
      deliverySummary: isDeliveryFree ? 'free' : 'carrier-tariff',
      isQuickOrder,
      paymentMethod: formData.paymentMethod,
      comment: formData.comment
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(order)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCompletedOrder({
          cashbackPending: Number(data.cashbackPending ?? estimatedBonuses)
        });
        setIsSuccess(true);
        clearCart();
      } else {
        setCheckoutError(data.error || 'Не вдалося оформити замовлення. Перевірте дані та спробуйте ще раз.');
      }
    } catch (err) {
      console.error(err);
      setCheckoutError('Не вдалося звʼязатися з магазином. Спробуйте ще раз за хвилину.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleBonuses = () => {
    if (!useBonuses) {
      if (usableBonusAmount <= 0) return;
      applyBonuses(usableBonusAmount);
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
          <p className="text-slate-500 text-lg mb-6 leading-relaxed">
            Ми вже почали готувати ваші "Хатні Штучки" до відправки. 
            <br />
            <span className="text-slate-900 font-bold">Наш менеджер зв'яжеться з вами у Viber або Telegram</span> для підтвердження та надання реквізитів для оплати.
          </p>
          <div className="bg-tiffany/5 p-6 rounded-3xl mb-10 border border-tiffany/10">
            <p className="text-tiffany font-bold text-lg mb-1">Очікується +{completedOrder?.cashbackPending ?? estimatedBonuses} бонусів</p>
            <p className="text-xs text-slate-400">Бонуси зарахуються після підтвердження оплати або виконання замовлення.</p>
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
          {!user && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-tiffany/20 text-tiffany rounded-full flex items-center justify-center shrink-0">
                  <Star size={24} fill="currentColor" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Отримайте до {estimatedBonuses} бонусів!</h3>
                  <p className="text-white/50 text-sm">Зареєструйтесь зараз, щоб отримати кешбек та доступ до системи бонусів.</p>
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <Link to="/login" className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold text-sm hover:bg-tiffany hover:text-white transition-all">
                  Увійти / Реєстрація
                </Link>
                <button 
                  type="button"
                  onClick={() => setIsQuickOrder(true)}
                  className="bg-white/10 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-white/20 transition-all border border-white/10"
                >
                  Швидке замовлення
                </button>
              </div>
            </motion.div>
          )}

          {/* Cart Items */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm">1</span>
              Ваш кошик
            </h2>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {cart.map(item => (
                  <motion.div 
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-6 shadow-sm"
                  >
                    <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0">
                      <img src={item.image || undefined} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-lg mb-1">{item.name}</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            aria-label={`Зменшити кількість «${item.name}»`}
                            className="p-2 hover:bg-slate-50 text-slate-500"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label={`Збільшити кількість «${item.name}»`}
                            className="p-2 hover:bg-slate-50 text-slate-500"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          aria-label={`Прибрати «${item.name}» з кошика`}
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
              </AnimatePresence>
            </div>
          </section>

          {/* Checkout Form */}
          <form id="checkout-form" onSubmit={handleCheckout} className="space-y-12">
            {/* Customer Details */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm">2</span>
                {isQuickOrder ? 'Швидке замовлення (тільки контакти)' : 'Контактні дані'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="space-y-2">
                  <label htmlFor="checkout-name" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Ваше ім'я</label>
                  <input
                    id="checkout-name"
                    name="name"
                    autoComplete="name"
                    required
                    type="text"
                    placeholder="Іван Іванов"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-tiffany transition-all"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="checkout-phone" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Телефон</label>
                  <input
                    id="checkout-phone"
                    name="phone"
                    autoComplete="tel"
                    required
                    type="tel"
                    placeholder="+380"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-tiffany transition-all"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="checkout-email" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email (обов'язково)</label>
                  <input
                    id="checkout-email"
                    name="email"
                    autoComplete="email"
                    required
                    type="email"
                    placeholder="example@mail.com"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-tiffany transition-all"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="checkout-comment" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Коментар до замовлення</label>
                  <textarea
                    id="checkout-comment"
                    name="comment"
                    placeholder="Наприклад: Передзвоніть мені після 18:00"
                    rows={3}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-tiffany transition-all resize-none"
                    value={formData.comment}
                    onChange={e => setFormData({...formData, comment: e.target.value})}
                  />
                </div>
              </div>
            </section>

            {/* Delivery */}
            <AnimatePresence>
              {!isQuickOrder && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <section className="pt-12">
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
                            onClick={() => {
                              setFormData({...formData, deliveryMethod: method.id as any, city: '', warehouse: ''});
                              setNovaPoshtaCityRef('');
                              setNovaPoshtaWarehouseRef('');
                              setCitySuggestions([]);
                              setWarehouseSuggestions([]);
                            }}
                            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${formData.deliveryMethod === method.id ? 'border-tiffany bg-tiffany/5 text-tiffany' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                          >
                            {method.icon}
                            <span className="font-bold text-sm">{method.name}</span>
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="relative space-y-2">
                          <label htmlFor="checkout-city" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Місто</label>
                          <input
                            id="checkout-city"
                            name="city"
                            required={!isQuickOrder}
                            type="text"
                            placeholder="Київ"
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-tiffany transition-all"
                            value={formData.city}
                            autoComplete="off"
                            onChange={e => {
                              setFormData({...formData, city: e.target.value, warehouse: ''});
                              setNovaPoshtaCityRef('');
                              setNovaPoshtaWarehouseRef('');
                              setWarehouseSuggestions([]);
                            }}
                          />
                          <div className="text-[11px] text-slate-400">
                            {formData.deliveryMethod === 'nova-poshta'
                              ? isLoadingCities ? 'Шукаємо міста Нової пошти...' : novaPoshtaCityRef ? 'Місто вибрано з довідника Нової пошти' : 'Почніть вводити назву і виберіть місто зі списку'
                              : 'Вкажіть місто доставки для Укрпошти вручну'}
                          </div>
                          {formData.deliveryMethod === 'nova-poshta' && citySuggestions.length > 0 && (
                            <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl shadow-slate-900/10">
                              {citySuggestions.map(city => (
                                <button
                                  key={city.ref}
                                  type="button"
                                  onClick={() => {
                                    setFormData({...formData, city: city.name, warehouse: ''});
                                    setNovaPoshtaCityRef(city.ref);
                                    setNovaPoshtaWarehouseRef('');
                                    setCitySuggestions([]);
                                    setWarehouseSuggestions([]);
                                  }}
                                  className="w-full rounded-xl px-4 py-3 text-left transition-colors hover:bg-tiffany/5"
                                >
                                  <div className="text-sm font-bold text-slate-900">{city.name}</div>
                                  <div className="text-[11px] text-slate-400">{[city.settlementType, city.area].filter(Boolean).join(', ')}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="relative space-y-2">
                          <label htmlFor="checkout-warehouse" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                            {formData.deliveryMethod === 'nova-poshta' ? 'Відділення / Поштомат' : 'Індекс / відділення Укрпошти'}
                          </label>
                          <input
                            id="checkout-warehouse"
                            name="warehouse"
                            required={!isQuickOrder}
                            type="text"
                            placeholder={formData.deliveryMethod === 'nova-poshta' ? '№1 або вул. Лесі Українки, 1' : 'Наприклад: 01001 або відділення на Хрещатику'}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-tiffany transition-all"
                            value={formData.warehouse}
                            autoComplete="off"
                            disabled={formData.deliveryMethod === 'nova-poshta' && !novaPoshtaCityRef}
                            onChange={e => {
                              setFormData({...formData, warehouse: e.target.value});
                              setNovaPoshtaWarehouseRef('');
                            }}
                          />
                          <div className="text-[11px] text-slate-400">
                            {formData.deliveryMethod === 'nova-poshta'
                              ? isLoadingWarehouses ? 'Оновлюємо відділення...' : novaPoshtaCityRef ? 'Виберіть відділення або поштомат зі списку Нової пошти' : 'Спочатку виберіть місто Нової пошти'
                              : 'Для Укрпошти введіть індекс, номер або адресу відділення вручну'}
                          </div>
                          {formData.deliveryMethod === 'nova-poshta' && warehouseSuggestions.length > 0 && (
                            <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl shadow-slate-900/10">
                              {warehouseSuggestions.map(warehouse => (
                                <button
                                  key={warehouse.ref}
                                  type="button"
                                  onClick={() => {
                                    setFormData({...formData, warehouse: warehouse.name});
                                    setNovaPoshtaWarehouseRef(warehouse.ref);
                                    setWarehouseSuggestions([]);
                                  }}
                                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-tiffany/5 hover:text-slate-950"
                                >
                                  {warehouse.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Payment */}
                  <section className="pt-12">
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
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>

        {/* Right Side: Summary */}
        <div className="lg:col-span-4">
          <div className="sticky top-32 space-y-6">
            {/* Bonus Widget */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
              {user && (
                <div className="pb-6 border-b border-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gold/10 text-gold rounded-full flex items-center justify-center">
                        <Star size={20} fill="currentColor" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Ваші бонуси</h3>
                        <p className="text-xs text-slate-500">{availableBonuses} доступно · {cashbackPercent} кешбек · {loyaltyProgress.current.name}</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={toggleBonuses}
                      disabled={!useBonuses && usableBonusAmount <= 0}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        useBonuses
                          ? 'bg-gold text-white'
                          : usableBonusAmount > 0
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      {useBonuses ? 'Застосовано' : usableBonusAmount > 0 ? 'Застосувати' : 'Недоступно'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Можна списати</div>
                      <div className="text-lg font-bold text-slate-900">{usableBonusAmount} грн</div>
                    </div>
                    <div className="rounded-2xl bg-tiffany/5 p-4">
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Ліміт</div>
                      <div className="text-lg font-bold text-tiffany">30%</div>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                    Списання працює після промокоду: 1 бонус = 1 грн, максимум 30% суми.
                  </p>
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-slate-400">Рівень {loyaltyProgress.current.name}</span>
                      {loyaltyProgress.next ? (
                        <span className="text-tiffany">ще {Math.ceil(loyaltyProgress.remaining).toLocaleString('uk-UA')} грн до {loyaltyProgress.next.name}</span>
                      ) : (
                        <span className="text-tiffany">максимальний рівень</span>
                      )}
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-tiffany" style={{ width: `${loyaltyProgress.progress}%` }} />
                    </div>
                  </div>
                  {useBonuses && (
                    <div className="mt-3 text-[10px] text-gold font-bold uppercase tracking-widest">
                      Знижка: -{appliedBonusAmount} грн
                    </div>
                  )}
                </div>
              )}

              {/* Promo Code */}
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-3">Промокод</h3>
                <div className="flex gap-2">
                  <input
                    id="checkout-promo-code"
                    name="promoCode"
                    aria-label="Промокод"
                    type="text"
                    placeholder="Введіть код"
                    value={bonusCode}
                    onChange={e => setBonusCode(e.target.value)}
                    className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-tiffany transition-all"
                  />
                  <button 
                    type="button"
                    onClick={handleApplyBonusCode}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-tiffany transition-all"
                  >
                    Застосувати
                  </button>
                </div>
                {bonusCodeError && <p className="text-red-500 text-[10px] mt-2 font-bold">{bonusCodeError}</p>}
                {appliedBonusCode && (
                  <div className="mt-2 flex items-center justify-between bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Код застосовано: {appliedBonusCode.code}</span>
                    <span className="text-[10px] text-emerald-600 font-bold">-{promoDiscount} грн</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-900/20">
              <h2 className="text-2xl font-bold mb-8">Підсумок</h2>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-white/60 text-sm">
                  <span>Товари ({cart.length})</span>
                  <span>{totalPrice} грн</span>
                </div>
                {useBonuses && appliedBonusAmount > 0 && (
                  <div className="flex justify-between text-gold text-sm">
                    <span>Бонуси</span>
                    <span>-{appliedBonusAmount} грн</span>
                  </div>
                )}
                {appliedBonusCode && (
                  <div className="flex justify-between text-emerald-400 text-sm">
                    <span>Промокод ({appliedBonusCode.code})</span>
                    <span>-{promoDiscount} грн</span>
                  </div>
                )}
                {activeBundleOffer && bundleDiscountAmount > 0 && (
                  <div className="rounded-2xl bg-tiffany/10 p-4 text-sm text-white">
                    <div className="flex justify-between gap-4">
                      <span className="font-bold text-tiffany">{activeBundleOffer.title}</span>
                      <span className="font-bold text-tiffany">-{bundleDiscountAmount} грн</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-4 text-[11px] text-white/45">
                      <span>Знижка конструктора наборів</span>
                      <button
                        type="button"
                        onClick={clearBundleOffer}
                        className="font-bold text-white/55 underline-offset-4 hover:text-white hover:underline"
                      >
                        прибрати
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-white/60 text-sm">
                  <span>Доставка</span>
                  <span className={isDeliveryFree ? 'text-tiffany' : 'text-white/80'}>
                    {isDeliveryFree ? 'Безкоштовно' : 'За тарифами перевізника'}
                  </span>
                </div>
                {!isDeliveryFree && (
                  <div className="rounded-2xl bg-white/5 p-3">
                    <div className="mb-2 text-[11px] leading-relaxed text-white/60">
                      Додайте ще <span className="font-bold text-tiffany">{deliveryRemaining.toLocaleString('uk-UA')} грн</span> — і доставка стане <span className="font-bold text-white">безкоштовною</span>.
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={freeDeliveryMin} aria-valuenow={Math.min(totalPrice, freeDeliveryMin)}>
                      <div
                        className="h-full rounded-full bg-tiffany transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round((totalPrice / Math.max(1, freeDeliveryMin)) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
                {isDeliveryFree && totalPrice > 0 && (
                  <div className="rounded-2xl bg-tiffany/10 p-3 text-[11px] font-bold text-tiffany">
                    {isFirstOrder && totalPrice < freeDeliveryMin
                      ? 'Безкоштовна доставка на ваше перше замовлення 🎉'
                      : 'Ви отримали безкоштовну доставку 🎉'}
                  </div>
                )}
                {!user && !isDeliveryFree && (
                  <Link
                    to="/login"
                    className="block rounded-2xl bg-white/5 p-3 text-[11px] font-bold text-tiffany transition-colors hover:bg-white/10 hover:text-white hover:no-underline"
                  >
                    Зареєструйтесь — і доставка на перше замовлення безкоштовна, без порогу →
                  </Link>
                )}
                <div className="h-px bg-white/10 my-4" />
                <div className="flex justify-between text-2xl font-bold">
                  <span>Разом</span>
                  <span className="text-tiffany">{finalTotal} грн</span>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl text-center">
                  <div className="text-tiffany font-bold text-sm">+{estimatedBonuses} бонусів</div>
                  <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Після оплати · {cashbackPercent} кешбек</div>
                </div>
              </div>
              {checkoutError && (
                <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                  {checkoutError}
                </div>
              )}

              <button 
                form="checkout-form"
                type="submit"
                disabled={isSubmitting}
                className={`w-full bg-tiffany text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-xl shadow-tiffany/20 ${
                  isSubmitting ? 'opacity-70 cursor-wait' : 'hover:bg-white hover:text-tiffany'
                }`}
              >
                {isSubmitting ? 'Створюємо замовлення...' : 'Підтвердити замовлення'}
                {!isSubmitting && <ArrowRight size={18} />}
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
