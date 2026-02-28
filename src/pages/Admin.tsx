import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, ShoppingCart, TrendingUp, Plus, Edit2, Trash2, CheckCircle, Clock, Star, Truck } from 'lucide-react';
import { MOCK_PRODUCTS } from '../constants';
import { Order } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useAuth } from '../store/AuthContext';
import { useNavigate } from 'react-router-dom';

const salesData = [
  { name: 'Пн', sales: 4000 },
  { name: 'Вт', sales: 3000 },
  { name: 'Ср', sales: 2000 },
  { name: 'Чт', sales: 2780 },
  { name: 'Пт', sales: 1890 },
  { name: 'Сб', sales: 2390 },
  { name: 'Нд', sales: 3490 },
];

const categoryData = [
  { name: 'Посуд', value: 400 },
  { name: 'Текстиль', value: 300 },
  { name: 'Кухня', value: 300 },
  { name: 'Декор', value: 200 },
];

export const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'analytics'>('analytics');
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tiffany"></div>
      </div>
    );
  }

  useEffect(() => {
    setOrders([
      {
        id: 'ord-123',
        customer: { 
          name: 'Олена Коваленко', 
          phone: '+380971234567', 
          address: 'Київ, Відділення №1',
          city: 'Київ',
          deliveryMethod: 'nova-poshta',
          warehouse: '№1'
        },
        items: [],
        total: 1200,
        discount: 0,
        bonusUsed: 50,
        finalTotal: 1150,
        paymentMethod: 'mono',
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    ]);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Sidebar */}
        <aside className="w-full md:w-64 space-y-2">
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'analytics' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <TrendingUp size={20} /> Аналітика
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'orders' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <ShoppingCart size={20} /> Замовлення
          </button>
          <button 
            onClick={() => setActiveTab('products')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'products' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Package size={20} /> Товари
          </button>
          <div className="h-px bg-slate-100 my-4" />
          <div className="p-6 bg-tiffany/5 rounded-3xl border border-tiffany/10">
            <div className="text-xs text-slate-400 uppercase font-bold mb-1">Баланс бонусів</div>
            <div className="text-2xl font-bold text-slate-900">45,200</div>
            <div className="text-[10px] text-slate-400">Нараховано клієнтам</div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-8">
          {activeTab === 'analytics' ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Продажі', value: '45,200 грн', change: '+12%', color: 'text-tiffany' },
                  { label: 'Замовлення', value: '124', change: '+5%', color: 'text-slate-900' },
                  { label: 'Середній чек', value: '840 грн', change: '+8%', color: 'text-gold' }
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{stat.label}</div>
                    <div className={`text-3xl font-bold ${stat.color} mb-2`}>{stat.value}</div>
                    <div className="text-xs text-emerald-500 font-bold">{stat.change} за останній тиждень</div>
                  </div>
                ))}
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-xl font-bold mb-8">Динаміка продажів</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesData}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#81D8D0" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#81D8D0" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                      <Tooltip 
                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                      />
                      <Area type="monotone" dataKey="sales" stroke="#81D8D0" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h3 className="text-xl font-bold mb-8">Продажі за категоріями</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryData}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#81D8D0', '#D4AF37', '#0f172a', '#94a3b8'][index % 4]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h3 className="text-xl font-bold mb-8">Останні дії</h3>
                  <div className="space-y-6">
                    {[
                      { action: 'Нове замовлення', user: 'Марія К.', time: '2 хв тому', icon: <ShoppingCart size={14} /> },
                      { action: 'Товар закінчується', user: 'Чашка "Ранкова"', time: '15 хв тому', icon: <Package size={14} /> },
                      { action: 'Відгук отримано', user: 'Олена В.', time: '1 год тому', icon: <Star size={14} /> }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                          {item.icon}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-slate-900">{item.action}</div>
                          <div className="text-xs text-slate-400">{item.user}</div>
                        </div>
                        <div className="text-[10px] text-slate-300 font-bold uppercase">{item.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">
                  {activeTab === 'orders' ? 'Керування замовленнями' : 'Каталог товарів'}
                </h2>
                {activeTab === 'products' && (
                  <button className="bg-tiffany text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 transition-all">
                    <Plus size={20} /> Додати товар
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                {activeTab === 'orders' ? (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                      <tr>
                        <th className="px-8 py-4">ID / Дата</th>
                        <th className="px-8 py-4">Клієнт / Доставка</th>
                        <th className="px-8 py-4">Сума (Бонуси)</th>
                        <th className="px-8 py-4">Статус</th>
                        <th className="px-8 py-4">Дії</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {orders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <div className="font-bold text-slate-900">{order.id}</div>
                            <div className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="font-medium text-slate-900">{order.customer.name}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-1">
                              <Truck size={10} /> {order.customer.deliveryMethod === 'nova-poshta' ? 'НП' : 'УП'}, {order.customer.city}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="font-bold text-slate-900">{order.finalTotal} грн</div>
                            {order.bonusUsed > 0 && <div className="text-[10px] text-gold font-bold">-{order.bonusUsed} бонуси</div>}
                          </td>
                          <td className="px-8 py-6">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-600">
                              <Clock size={12} /> Очікує
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <button className="text-tiffany hover:text-slate-900 font-bold text-sm">Деталі</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                      <tr>
                        <th className="px-8 py-4">Товар</th>
                        <th className="px-8 py-4">Категорія</th>
                        <th className="px-8 py-4">Ціна</th>
                        <th className="px-8 py-4">Дії</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {MOCK_PRODUCTS.map(product => (
                        <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6 flex items-center gap-4">
                            <img src={product.image} className="w-12 h-12 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="font-bold text-slate-900">{product.name}</div>
                          </td>
                          <td className="px-8 py-6 text-slate-500">{product.category}</td>
                          <td className="px-8 py-6 font-bold text-slate-900">{product.price} грн</td>
                          <td className="px-8 py-6">
                            <div className="flex gap-3">
                              <button className="p-2 text-slate-400 hover:text-tiffany transition-colors"><Edit2 size={18} /></button>
                              <button className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
