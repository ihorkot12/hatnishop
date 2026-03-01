import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ShoppingCart, TrendingUp, Plus, Edit2, Trash2, CheckCircle, Clock, Star, Truck, Users, Shield, UserPlus, Filter } from 'lucide-react';
import { MOCK_PRODUCTS } from '../constants';
import { Order, User } from '../types';
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
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'analytics' | 'users' | 'categories'>('analytics');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [isProductLoading, setIsProductLoading] = useState(false);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'categories') fetchCategories();
  }, [activeTab]);

  const fetchCategories = async () => {
    setIsCategoryLoading(true);
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCategoryLoading(false);
    }
  };

  const fetchUsers = async () => {
    setIsUserLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUserLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цю категорію?')) return;
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      if (res.ok) fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const categoryData = Object.fromEntries(formData.entries());
    
    const url = editingCategory ? `/api/admin/categories/${editingCategory.id}` : '/api/admin/categories';
    const method = editingCategory ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      });
      if (res.ok) {
        setShowCategoryModal(false);
        setEditingCategory(null);
        fetchCategories();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    setIsProductLoading(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProductLoading(false);
    }
  };

  const fetchOrders = async () => {
    setIsOrderLoading(true);
    try {
      const res = await fetch('/api/admin/orders');
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsOrderLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цей товар?')) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      if (res.ok) fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleProductSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const productData = Object.fromEntries(formData.entries());
    
    const url = editingProduct ? `/api/admin/products/${editingProduct.id}` : '/api/admin/products';
    const method = editingProduct ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      if (res.ok) {
        setShowProductModal(false);
        setEditingProduct(null);
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

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
          <button 
            onClick={() => setActiveTab('categories')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'categories' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Filter size={20} /> Категорії
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Users size={20} /> Користувачі
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
                  {activeTab === 'orders' ? 'Керування замовленнями' : 
                   activeTab === 'users' ? 'Керування користувачами' : 
                   activeTab === 'categories' ? 'Керування категоріями' : 'Каталог товарів'}
                </h2>
                {activeTab === 'products' && (
                  <button 
                    onClick={() => { setEditingProduct(null); setShowProductModal(true); }}
                    className="bg-tiffany text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 transition-all"
                  >
                    <Plus size={20} /> Додати товар
                  </button>
                )}
                {activeTab === 'categories' && (
                  <button 
                    onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                    className="bg-tiffany text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 transition-all"
                  >
                    <Plus size={20} /> Додати категорію
                  </button>
                )}
                {activeTab === 'users' && (
                  <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-tiffany transition-all">
                    <UserPlus size={20} /> Новий користувач
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
                            <select 
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              className="text-[10px] font-bold uppercase bg-slate-50 border-none rounded-full px-3 py-1 focus:ring-2 focus:ring-tiffany"
                            >
                              <option value="pending">Очікує</option>
                              <option value="paid">Оплачено</option>
                              <option value="shipped">Відправлено</option>
                              <option value="completed">Виконано</option>
                              <option value="cancelled">Скасовано</option>
                            </select>
                          </td>
                          <td className="px-8 py-6">
                            <button className="text-tiffany hover:text-slate-900 font-bold text-sm">Деталі</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : activeTab === 'users' ? (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                      <tr>
                        <th className="px-8 py-4">Користувач</th>
                        <th className="px-8 py-4">Email</th>
                        <th className="px-8 py-4">Роль</th>
                        <th className="px-8 py-4">Бонуси / Витрачено</th>
                        <th className="px-8 py-4">Дії</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <div className="font-bold text-slate-900">{u.name}</div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest">ID: {u.id}</div>
                          </td>
                          <td className="px-8 py-6 text-slate-500">{u.email}</td>
                          <td className="px-8 py-6">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-tiffany/10 text-tiffany' : 'bg-slate-100 text-slate-500'}`}>
                              {u.role === 'admin' ? <Shield size={12} /> : null}
                              {u.role === 'admin' ? 'Адмін' : 'Клієнт'}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="font-bold text-slate-900">{u.bonuses} бонуси</div>
                            <div className="text-xs text-slate-400">{u.total_spent || 0} грн витрачено</div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex gap-3">
                              <button 
                                onClick={() => updateUserRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                                className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-tiffany transition-colors"
                              >
                                {u.role === 'admin' ? 'Зняти права' : 'Зробити адміном'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : activeTab === 'categories' ? (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                      <tr>
                        <th className="px-8 py-4">Категорія</th>
                        <th className="px-8 py-4">Slug</th>
                        <th className="px-8 py-4">Дії</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {categories.map(cat => (
                        <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6 flex items-center gap-4">
                            <img src={cat.image} className="w-12 h-12 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="font-bold text-slate-900">{cat.name}</div>
                          </td>
                          <td className="px-8 py-6 text-slate-500">{cat.slug}</td>
                          <td className="px-8 py-6">
                            <div className="flex gap-3">
                              <button 
                                onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }}
                                className="p-2 text-slate-400 hover:text-tiffany transition-colors"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => deleteCategory(cat.id)}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
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
                      {products.map(product => (
                        <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6 flex items-center gap-4">
                            <img src={product.image} className="w-12 h-12 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="font-bold text-slate-900">{product.name}</div>
                          </td>
                          <td className="px-8 py-6 text-slate-500">{product.category}</td>
                          <td className="px-8 py-6 font-bold text-slate-900">{product.price} грн</td>
                          <td className="px-8 py-6">
                            <div className="flex gap-3">
                              <button 
                                onClick={() => { setEditingProduct(product); setShowProductModal(true); }}
                                className="p-2 text-slate-400 hover:text-tiffany transition-colors"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => deleteProduct(product.id)}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
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
      {/* Product Modal */}
      <AnimatePresence>
        {showProductModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProductModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-2xl font-bold mb-8">{editingProduct ? 'Редагувати товар' : 'Додати новий товар'}</h2>
              <form onSubmit={handleProductSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Назва</label>
                    <input name="name" defaultValue={editingProduct?.name} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Категорія</label>
                    <select name="category" defaultValue={editingProduct?.category || categories[0]?.slug} className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany">
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.slug}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Ціна (грн)</label>
                    <input name="price" type="number" defaultValue={editingProduct?.price} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Залишок</label>
                    <input name="stock" type="number" defaultValue={editingProduct?.stock || 10} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">URL зображення</label>
                  <input name="image" defaultValue={editingProduct?.image} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Опис</label>
                  <textarea name="description" defaultValue={editingProduct?.description} rows={4} className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Скасувати</button>
                  <button type="submit" className="flex-1 bg-slate-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-tiffany transition-all">Зберегти</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCategoryModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8"
            >
              <h2 className="text-2xl font-bold mb-8">{editingCategory ? 'Редагувати категорію' : 'Додати нову категорію'}</h2>
              <form onSubmit={handleCategorySubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Назва</label>
                  <input name="name" defaultValue={editingCategory?.name} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Slug (URL)</label>
                  <input name="slug" defaultValue={editingCategory?.slug} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">URL зображення</label>
                  <input name="image" defaultValue={editingCategory?.image} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowCategoryModal(false)} className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Скасувати</button>
                  <button type="submit" className="flex-1 bg-slate-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-tiffany transition-all">Зберегти</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
