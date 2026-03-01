import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../store/AuthContext';
import { Package, Truck, CheckCircle2, Clock, XCircle, Star, LogOut, User as UserIcon, Settings, ChevronRight, CreditCard, ShoppingBag } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

interface Order {
  id: string;
  status: string;
  total: number;
  finalTotal: number;
  bonusUsed: number;
  createdAt: string;
  items: {
    id: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  }[];
}

export const Profile = () => {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/user/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return <Navigate to="/login" />;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="text-amber-500" size={18} />;
      case 'paid': return <CreditCard className="text-emerald-500" size={18} />;
      case 'shipped': return <Truck className="text-tiffany" size={18} />;
      case 'completed': return <CheckCircle2 className="text-emerald-500" size={18} />;
      case 'cancelled': return <XCircle className="text-red-500" size={18} />;
      default: return <Package className="text-slate-400" size={18} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Очікує підтвердження';
      case 'paid': return 'Оплачено';
      case 'shipped': return 'В дорозі';
      case 'completed': return 'Виконано';
      case 'cancelled': return 'Скасовано';
      default: return status;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50">
            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-24 h-24 bg-slate-900 text-white rounded-full flex items-center justify-center mb-6 text-3xl font-bold">
                {user.name.charAt(0)}
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
              <p className="text-slate-400 text-sm">{user.email}</p>
              <div className="mt-6 flex items-center gap-2 bg-gold/10 text-gold px-4 py-2 rounded-full font-bold text-sm">
                <Star size={16} fill="currentColor" />
                {user.bonuses} бонусів
              </div>
            </div>

            <nav className="space-y-2">
              <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 text-slate-900 font-bold transition-all">
                <div className="flex items-center gap-3">
                  <ShoppingBag size={20} />
                  <span>Мої замовлення</span>
                </div>
                <ChevronRight size={18} />
              </button>
              <button className="w-full flex items-center justify-between p-4 rounded-2xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-bold transition-all">
                <div className="flex items-center gap-3">
                  <Settings size={20} />
                  <span>Налаштування</span>
                </div>
                <ChevronRight size={18} />
              </button>
              <div className="h-px bg-slate-100 my-4" />
              <button 
                onClick={logout}
                className="w-full flex items-center gap-3 p-4 rounded-2xl text-red-500 hover:bg-red-50 font-bold transition-all"
              >
                <LogOut size={20} />
                <span>Вийти</span>
              </button>
            </nav>
          </div>

          <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl shadow-slate-900/20">
            <h3 className="text-xl font-bold mb-4">Система кешбеку</h3>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              Отримуйте 5% від кожного замовлення на свій бонусний рахунок. 
              Використовуйте бонуси для оплати до 50% вартості нових покупок!
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm font-bold">
                <div className="w-8 h-8 bg-tiffany/20 text-tiffany rounded-full flex items-center justify-center">1</div>
                <span>Купуйте улюблені товари</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-bold">
                <div className="w-8 h-8 bg-tiffany/20 text-tiffany rounded-full flex items-center justify-center">2</div>
                <span>Отримуйте бонуси після доставки</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-bold">
                <div className="w-8 h-8 bg-tiffany/20 text-tiffany rounded-full flex items-center justify-center">3</div>
                <span>Економте на наступних покупках</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-serif font-bold text-slate-900">Історія замовлень</h2>
            <div className="text-sm text-slate-400 font-bold uppercase tracking-widest">
              {orders.length} замовлень
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-slate-100 rounded-[2.5rem] animate-pulse" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white p-20 rounded-[3rem] border border-slate-100 text-center">
              <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">У вас ще немає замовлень</h3>
              <p className="text-slate-500 mb-8">Час додати затишку у свій дім!</p>
              <Link to="/catalog" className="inline-block bg-tiffany text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-900 transition-all">
                Перейти до каталогу
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map(order => (
                <motion.div 
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all group"
                >
                  <div className="p-8">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-lg font-bold text-slate-900">Замовлення #{order.id}</span>
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            {getStatusIcon(order.status)}
                            {getStatusText(order.status)}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                          від {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-slate-900">{order.finalTotal} грн</div>
                        {order.bonusUsed > 0 && (
                          <div className="text-[10px] text-gold font-bold uppercase tracking-widest">
                            Використано {order.bonusUsed} бонусів
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border border-slate-50">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <Truck size={14} />
                      <span>Безкоштовна доставка</span>
                    </div>
                    <button className="text-tiffany font-bold text-sm flex items-center gap-2 hover:text-slate-900 transition-colors">
                      Деталі замовлення
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
