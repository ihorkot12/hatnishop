import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../store/AuthContext';
import { Package, Truck, CheckCircle2, Clock, XCircle, Star, LogOut, User as UserIcon, Settings, ChevronRight, CreditCard, ShoppingBag, Copy, Check } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { formatCashbackRate, getLoyaltyProgress } from '../utils/loyalty';

interface Order {
  id: string;
  status: string;
  total: number;
  finalTotal: number;
  bonusUsed: number;
  createdAt: string;
  trackingNumber?: string;
  comment?: string;
  items: {
    id: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  }[];
}

export const Profile = () => {
  const { user, loading, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-tiffany" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const loyaltyProgress = getLoyaltyProgress(user.total_spent);
  const cashbackLabel = formatCashbackRate(loyaltyProgress.current.cashbackRate);

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
      case 'pending': return 'РћС‡С–РєСѓС” РїС–РґС‚РІРµСЂРґР¶РµРЅРЅСЏ';
      case 'paid': return 'РћРїР»Р°С‡РµРЅРѕ';
      case 'shipped': return 'Р’ РґРѕСЂРѕР·С–';
      case 'completed': return 'Р’РёРєРѕРЅР°РЅРѕ';
      case 'cancelled': return 'РЎРєР°СЃРѕРІР°РЅРѕ';
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
                {user.bonuses} Р±РѕРЅСѓСЃС–РІ
              </div>
            </div>

            <nav className="space-y-2">
              <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 text-slate-900 font-bold transition-all">
                <div className="flex items-center gap-3">
                  <ShoppingBag size={20} />
                  <span>РњРѕС— Р·Р°РјРѕРІР»РµРЅРЅСЏ</span>
                </div>
                <ChevronRight size={18} />
              </button>
              <button className="w-full flex items-center justify-between p-4 rounded-2xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-bold transition-all">
                <div className="flex items-center gap-3">
                  <Settings size={20} />
                  <span>РќР°Р»Р°С€С‚СѓРІР°РЅРЅСЏ</span>
                </div>
                <ChevronRight size={18} />
              </button>
              <div className="h-px bg-slate-100 my-4" />
              <button 
                onClick={logout}
                className="w-full flex items-center gap-3 p-4 rounded-2xl text-red-500 hover:bg-red-50 font-bold transition-all"
              >
                <LogOut size={20} />
                <span>Р’РёР№С‚Рё</span>
              </button>
            </nav>
          </div>

          <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl shadow-slate-900/20">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">Р’Р°С€ СЂС–РІРµРЅСЊ</div>
                <h3 className="mt-1 text-2xl font-bold">{loyaltyProgress.current.name}</h3>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                <div className="text-2xl font-bold text-tiffany">{cashbackLabel}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">РєРµС€Р±РµРє</div>
              </div>
            </div>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              Р’Рё РІР¶Рµ РєСѓРїРёР»Рё РЅР° {Math.floor(user.total_spent || 0).toLocaleString('uk-UA')} РіСЂРЅ. Р‘РѕРЅСѓСЃРё РјРѕР¶РЅР° СЃРїРёСЃСѓРІР°С‚Рё РЅР° РѕРїР»Р°С‚Сѓ РґРѕ 30% РІР°СЂС‚РѕСЃС‚С– РЅРѕРІРёС… РїРѕРєСѓРїРѕРє.
            </p>
            <div className="mb-8 rounded-2xl bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-white/35">РџСЂРѕРіСЂРµСЃ</span>
                {loyaltyProgress.next ? (
                  <span className="text-tiffany">С‰Рµ {Math.ceil(loyaltyProgress.remaining).toLocaleString('uk-UA')} РіСЂРЅ РґРѕ {loyaltyProgress.next.name}</span>
                ) : (
                  <span className="text-tiffany">РјР°РєСЃРёРјР°Р»СЊРЅРёР№ СЂС–РІРµРЅСЊ</span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-tiffany" style={{ width: `${loyaltyProgress.progress}%` }} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm font-bold">
                <div className="w-8 h-8 bg-tiffany/20 text-tiffany rounded-full flex items-center justify-center">1</div>
                <span>РљСѓРїСѓР№С‚Рµ СѓР»СЋР±Р»РµРЅС– С‚РѕРІР°СЂРё</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-bold">
                <div className="w-8 h-8 bg-tiffany/20 text-tiffany rounded-full flex items-center justify-center">2</div>
                <span>РћС‚СЂРёРјСѓР№С‚Рµ Р±РѕРЅСѓСЃРё РїС–СЃР»СЏ РґРѕСЃС‚Р°РІРєРё</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-bold">
                <div className="w-8 h-8 bg-tiffany/20 text-tiffany rounded-full flex items-center justify-center">3</div>
                <span>Р•РєРѕРЅРѕРјС‚Рµ РЅР° РЅР°СЃС‚СѓРїРЅРёС… РїРѕРєСѓРїРєР°С…</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-serif font-bold text-slate-900">Р†СЃС‚РѕСЂС–СЏ Р·Р°РјРѕРІР»РµРЅСЊ</h2>
            <div className="text-sm text-slate-400 font-bold uppercase tracking-widest">
              {orders.length} Р·Р°РјРѕРІР»РµРЅСЊ
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
              <h3 className="text-xl font-bold text-slate-900 mb-2">РЈ РІР°СЃ С‰Рµ РЅРµРјР°С” Р·Р°РјРѕРІР»РµРЅСЊ</h3>
              <p className="text-slate-500 mb-8">Р§Р°СЃ РґРѕРґР°С‚Рё Р·Р°С‚РёС€РєСѓ Сѓ СЃРІС–Р№ РґС–Рј!</p>
              <Link to="/catalog" className="inline-block bg-tiffany text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-900 transition-all">
                РџРµСЂРµР№С‚Рё РґРѕ РєР°С‚Р°Р»РѕРіСѓ
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
                          <span className="text-lg font-bold text-slate-900">Р—Р°РјРѕРІР»РµРЅРЅСЏ #{order.id}</span>
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            {getStatusIcon(order.status)}
                            {getStatusText(order.status)}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                          РІС–Рґ {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-slate-900">{order.finalTotal} РіСЂРЅ</div>
                        {order.bonusUsed > 0 && (
                          <div className="text-[10px] text-gold font-bold uppercase tracking-widest">
                            Р’РёРєРѕСЂРёСЃС‚Р°РЅРѕ {order.bonusUsed} Р±РѕРЅСѓСЃС–РІ
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border border-slate-50">
                          <img src={item.image || undefined} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ))}
                    </div>

                    {(order.trackingNumber || order.comment) && (
                      <div className="mt-6 flex flex-col gap-3">
                        {order.trackingNumber && (
                          <div className="flex items-center justify-between bg-tiffany/5 p-4 rounded-2xl border border-tiffany/10">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-tiffany text-white rounded-full flex items-center justify-center">
                                <Truck size={16} />
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">РўСЂРµРє-РЅРѕРјРµСЂ (РўРўРќ)</p>
                                <p className="text-sm font-bold text-slate-900">{order.trackingNumber}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => copyToClipboard(order.trackingNumber!, order.id)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${copiedId === order.id ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 hover:bg-slate-50 border border-slate-100'}`}
                            >
                              {copiedId === order.id ? <Check size={14} /> : <Copy size={14} />}
                              {copiedId === order.id ? 'РЎРєРѕРїС–Р№РѕРІР°РЅРѕ' : 'РљРѕРїС–СЋРІР°С‚Рё'}
                            </button>
                          </div>
                        )}
                        {order.comment && (
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Р’Р°С€ РєРѕРјРµРЅС‚Р°СЂ</p>
                            <p className="text-sm text-slate-600 italic">"{order.comment}"</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-slate-50 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <Truck size={14} />
                      <span>Р‘РµР·РєРѕС€С‚РѕРІРЅР° РґРѕСЃС‚Р°РІРєР°</span>
                    </div>
                    <button className="text-tiffany font-bold text-sm flex items-center gap-2 hover:text-slate-900 transition-colors">
                      Р”РµС‚Р°Р»С– Р·Р°РјРѕРІР»РµРЅРЅСЏ
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
