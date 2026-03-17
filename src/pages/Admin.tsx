import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateDescription, generateProductImage, generateStylingTip } from '../services/aiService';
import { Package, ShoppingCart, TrendingUp, Plus, Edit2, Trash2, CheckCircle, Clock, Star, Truck, Users, Shield, UserPlus, Filter, Settings, MessageSquare, Tag, Upload, Loader2, Sparkles, Share2 } from 'lucide-react';
import { ProductImporter } from '../components/ProductImporter';
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
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'analytics' | 'users' | 'categories' | 'bonus-codes' | 'reviews' | 'settings' | 'import'>('analytics');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [isBonusCodesLoading, setIsBonusCodesLoading] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [bonusCodes, setBonusCodes] = useState<any[]>([]);
  const [siteSettings, setSiteSettings] = useState({
    free_delivery_min: 1500,
    return_days: 14,
    cashback_percent: 5
  });
  const [newBonusCode, setNewBonusCode] = useState({
    code: '',
    discount_amount: 0,
    discount_type: 'fixed',
    min_order_amount: 0,
    is_active: true,
    show_in_site: true,
    title: '',
    description: '',
    type: 'promo'
  });
  const [isProductLoading, setIsProductLoading] = useState(false);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryImage, setCategoryImage] = useState<string>('');
  const [editingBonusCode, setEditingBonusCode] = useState<any>(null);
  const [showBonusCodeModal, setShowBonusCodeModal] = useState(false);
  const [editingReview, setEditingReview] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [manualOrderItems, setManualOrderItems] = useState<any[]>([]);
  const [mainImage, setMainImage] = useState<string>('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [productDescription, setProductDescription] = useState<string>('');
  const [productAiDescription, setProductAiDescription] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  useEffect(() => {
    if (editingProduct) {
      setMainImage(editingProduct.image || '');
      setGalleryImages(editingProduct.images || []);
      setProductDescription(editingProduct.description || '');
      setProductAiDescription(editingProduct.aiDescription || '');
    } else {
      setMainImage('');
      setGalleryImages([]);
      setProductDescription('');
      setProductAiDescription('');
    }
  }, [editingProduct, showProductModal]);

  useEffect(() => {
    if (editingCategory) {
      setCategoryImage(editingCategory.image || '');
    } else {
      setCategoryImage('');
    }
  }, [editingCategory, showCategoryModal]);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'categories' || activeTab === 'import') fetchCategories();
    if (activeTab === 'analytics') fetchStats();
    if (activeTab === 'bonus-codes') fetchBonusCodes();
    if (activeTab === 'reviews') fetchReviews();
    if (activeTab === 'settings') fetchSiteSettings();
  }, [activeTab]);

  const fetchSiteSettings = async () => {
    setIsSettingsLoading(true);
    try {
      const res = await fetch('/api/site-settings');
      if (res.ok) {
        const data = await res.json();
        setSiteSettings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSettingsLoading(false);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteSettings)
      });
      if (res.ok) {
        alert('Налаштування збережено');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBonusCodes = async () => {
    setIsBonusCodesLoading(true);
    try {
      const res = await fetch('/api/admin/bonus-codes');
      if (res.ok) {
        const data = await res.json();
        setBonusCodes(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBonusCodesLoading(false);
    }
  };

  const fetchReviews = async () => {
    setIsReviewsLoading(true);
    try {
      const res = await fetch('/api/admin/reviews');
      if (res.ok) {
        const data = await res.json();
        setReviews(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsReviewsLoading(false);
    }
  };

  const createBonusCode = async () => {
    if (!newBonusCode.title || !newBonusCode.code) {
      alert('Будь ласка, заповніть заголовок та код');
      return;
    }
    try {
      const res = await fetch('/api/admin/bonus-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBonusCode)
      });
      if (res.ok) {
        fetchBonusCodes();
        setNewBonusCode({
          code: '',
          discount_amount: 0,
          discount_type: 'fixed',
          min_order_amount: 0,
          is_active: true,
          show_in_site: true,
          title: '',
          description: '',
          type: 'promo'
        });
        alert('Акцію додано успішно');
      } else {
        const error = await res.json();
        alert(`Помилка: ${error.error || 'Не вдалося додати акцію'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Помилка при з\'єднанні з сервером');
    }
  };

  const handleBonusCodeUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/bonus-codes/${editingBonusCode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBonusCode)
      });
      if (res.ok) {
        setShowBonusCodeModal(false);
        setEditingBonusCode(null);
        fetchBonusCodes();
        alert('Акцію оновлено');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteBonusCode = async (id: string) => {
    if (!confirm('Ви впевнені, що хочете видалити цей промокод?')) return;
    try {
      const res = await fetch(`/api/admin/bonus-codes/${id}`, { method: 'DELETE' });
      if (res.ok) fetchBonusCodes();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleBonusCodeStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/bonus-codes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (res.ok) fetchBonusCodes();
    } catch (err) {
      console.error(err);
    }
  };

  const updateReviewApproval = async (id: string, isApproved: number) => {
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved: isApproved })
      });
      if (res.ok) {
        fetchReviews();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm('Ви впевнені, що хочете видалити цей відгук?')) return;
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchReviews();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;
    try {
      const res = await fetch(`/api/admin/reviews/${editingReview.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingReview)
      });
      if (res.ok) {
        setShowReviewModal(false);
        setEditingReview(null);
        fetchReviews();
        alert('Відгук оновлено');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    setIsStatsLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const resetStats = async () => {
    if (!window.confirm('Ви впевнені, що хочете скинути всю статистику? Це видалить усі замовлення з бази даних!')) return;
    try {
      const res = await fetch('/api/admin/stats/reset', { method: 'POST' });
      if (res.ok) fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    setIsCategoryLoading(true);
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data);
      } else {
        console.error('Categories data is not an array:', data);
        setCategories([]);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setCategories([]);
    } finally {
      setIsCategoryLoading(false);
    }
  };

  const fetchUsers = async () => {
    setIsUserLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        console.error('Users data is not an array:', data);
        setUsers([]);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
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

  const updateUserBonuses = async (userId: string, currentBonuses: number) => {
    const amount = window.prompt('Введіть нову кількість бонусів:', currentBonuses.toString());
    if (amount === null) return;
    
    try {
      const res = await fetch(`/api/admin/users/${userId}/bonuses`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bonuses: Number(amount) })
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
    categoryData.image = categoryImage;
    
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
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Помилка збереження: ${errorData.error || res.statusText}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Помилка: ${err.message}`);
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customer = {
      name: formData.get('customerName'),
      email: formData.get('customerEmail'),
      phone: formData.get('customerPhone'),
      city: formData.get('customerCity'),
      deliveryMethod: formData.get('deliveryMethod'),
    };

    const total = manualOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const orderData = {
      id: `ORD-${Date.now()}`,
      customer,
      items: manualOrderItems,
      total,
      paymentMethod: formData.get('paymentMethod'),
      bonusUsed: 0,
      finalTotal: total,
      userId: null
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      if (res.ok) {
        setShowOrderModal(false);
        setManualOrderItems([]);
        fetchOrders();
        fetchStats();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Помилка збереження: ${errorData.error || res.statusText}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Помилка: ${err.message}`);
    }
  };

  const addManualItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    setManualOrderItems(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing) {
        return prev.map(item => item.id === productId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1, image: product.image }];
    });
  };

  const fetchProducts = async () => {
    setIsProductLoading(true);
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        console.error('Products data is not an array:', data);
        setProducts([]);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setProducts([]);
    } finally {
      setIsProductLoading(false);
    }
  };

  const fetchOrders = async () => {
    setIsOrderLoading(true);
    try {
      const res = await fetch('/api/admin/orders');
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        console.error('Orders data is not an array:', data);
        setOrders([]);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrders([]);
    } finally {
      setIsOrderLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    let trackingNumber = '';
    if (newStatus === 'shipped') {
      const input = window.prompt('Введіть номер ТТН:');
      if (input === null) return; // Cancelled
      trackingNumber = input;
    }

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, trackingNumber })
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

  const handleAIGenerateDescription = async (name: string, category: string) => {
    if (productDescription && productDescription.trim().length > 0) {
      if (!confirm('Опис вже існує. Ви впевнені, що хочете перегенерувати його?')) {
        return;
      }
    }

    setIsGeneratingAI(true);
    try {
      const text = await generateDescription(name, category);
      if (text) {
        setProductDescription(text);
      }
    } catch (err) {
      console.error(err);
      alert('Помилка при генерації опису');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAIGenerateImage = async (name: string, category: string) => {
    setIsGeneratingAI(true);
    try {
      const image = await generateProductImage(name, category, mainImage);
      if (image) {
        setMainImage(image);
      }
    } catch (err) {
      console.error(err);
      alert('Помилка при генерації зображення');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAIGenerateAdvice = async (name: string, category: string) => {
    if (productAiDescription && productAiDescription.trim().length > 0) {
      if (!confirm('Порада вже існує. Ви впевнені, що хочете перегенерувати її?')) {
        return;
      }
    }

    setIsGeneratingAdvice(true);
    try {
      const advice = await generateStylingTip(name, category);
      if (advice) {
        setProductAiDescription(advice);
      }
    } catch (err) {
      console.error(err);
      alert('Помилка при генерації поради');
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  const handleProductSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const productData = {
      ...Object.fromEntries(formData.entries()),
      image: mainImage,
      images: galleryImages,
      isPopular: formData.get('isPopular') === 'on',
      isBundle: formData.get('isBundle') === 'on',
      price: Number(formData.get('price')),
      stock: Number(formData.get('stock')),
      bonusPoints: Number(formData.get('bonusPoints')),
      reviewCount: editingProduct?.reviewCount || 0,
      rating: editingProduct?.rating || 5,
    };
    
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
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Помилка збереження: ${errorData.error || res.statusText}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Помилка: ${err.message}`);
    }
  };

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tiffany"></div>
      </div>
    );
  }

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
            onClick={() => setActiveTab('import')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'import' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Upload size={20} /> Імпорт
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
          <button 
            onClick={() => setActiveTab('bonus-codes')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'bonus-codes' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Tag size={20} /> Акції
          </button>
          <button 
            onClick={() => setActiveTab('reviews')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'reviews' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <MessageSquare size={20} /> Відгуки
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'settings' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Settings size={20} /> Налаштування
          </button>
          <div className="h-px bg-slate-100 my-4" />
          <div className="p-6 bg-tiffany/5 rounded-3xl border border-tiffany/10">
            <div className="text-xs text-slate-400 uppercase font-bold mb-1">Баланс бонусів</div>
            <div className="text-2xl font-bold text-slate-900">{stats?.totalBonuses?.toLocaleString() || '0'}</div>
            <div className="text-[10px] text-slate-400">Нараховано клієнтам</div>
          </div>
        </aside>

        {/* Main Content */}
          <main className="flex-1 space-y-8">
            {activeTab === 'import' ? (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Імпорт товарів</h2>
                </div>
                <ProductImporter 
                  categories={categories} 
                  onComplete={() => {
                    setActiveTab('products');
                    fetchProducts();
                  }} 
                />
              </div>
            ) : activeTab === 'analytics' ? (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Аналітика</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={fetchStats}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold transition-all"
                  >
                    <Clock size={16} /> Оновити
                  </button>
                  <button 
                    onClick={resetStats}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl text-sm font-bold transition-all"
                  >
                    <Trash2 size={16} /> Скинути
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Продажі', value: `${stats?.totalSales?.toLocaleString() || '0'} грн`, change: '+12%', color: 'text-tiffany' },
                  { label: 'Замовлення', value: stats?.orderCount?.toString() || '0', change: '+5%', color: 'text-slate-900' },
                  { label: 'Середній чек', value: `${Math.round(stats?.avgOrderValue || 0).toLocaleString()} грн`, change: '+8%', color: 'text-gold' }
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{stat.label}</div>
                    <div className={`text-3xl font-bold ${stat.color} mb-2`}>{stat.value}</div>
                    <div className="text-xs text-emerald-500 font-bold">{stat.change} за останній тиждень</div>
                  </div>
                ))}
              </div>

              {stats?.orderCount > 0 ? (
                <>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h3 className="text-xl font-bold mb-8">Динаміка продажів</h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats?.salesByDay || []}>
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
                          <BarChart data={stats?.salesByCategory || []}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                              {(stats?.salesByCategory || []).map((entry: any, index: number) => (
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
                </>
              ) : (
                <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                    <TrendingUp size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Немає даних для аналітики</h3>
                  <p className="text-slate-500 max-w-md mx-auto">Статистика та графіки з'являться тут після того, як клієнти зроблять перші замовлення.</p>
                </div>
              )}
            </div>

          ) : activeTab === 'bonus-codes' ? (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Промокоди</h2>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold mb-6">Створити нову акцію / промокод</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Тип</label>
                    <select 
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.type}
                      onChange={e => setNewBonusCode({...newBonusCode, type: e.target.value})}
                    >
                      <option value="promo">Промокод (для кошика)</option>
                      <option value="offer">Спец. пропозиція (інфо)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Заголовок</label>
                    <input 
                      type="text" 
                      placeholder="200 бонусів на перше замовлення"
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.title}
                      onChange={e => setNewBonusCode({...newBonusCode, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Опис</label>
                    <input 
                      type="text" 
                      placeholder="Використовуйте при оформленні"
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.description}
                      onChange={e => setNewBonusCode({...newBonusCode, description: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-6 mb-6 px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={newBonusCode.show_in_site}
                        onChange={e => setNewBonusCode({...newBonusCode, show_in_site: e.target.checked})}
                      />
                      <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-tiffany transition-all"></div>
                      <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all"></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Відображати у вікні "Акції та набори"</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Код</label>
                    <input 
                      type="text" 
                      placeholder="SALE20"
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.code}
                      onChange={e => setNewBonusCode({...newBonusCode, code: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Знижка</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.discount_amount}
                      onChange={e => setNewBonusCode({...newBonusCode, discount_amount: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Тип</label>
                    <select 
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.discount_type}
                      onChange={e => setNewBonusCode({...newBonusCode, discount_type: e.target.value})}
                    >
                      <option value="fixed">Грн</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Мін. сума</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.min_order_amount}
                      onChange={e => setNewBonusCode({...newBonusCode, min_order_amount: Number(e.target.value)})}
                    />
                  </div>
                  <div className="flex items-end">
                    <button 
                      onClick={createBonusCode}
                      className="w-full bg-slate-900 text-white h-[46px] rounded-xl font-bold text-sm hover:bg-tiffany transition-all"
                    >
                      Додати
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                    <tr>
                      <th className="px-8 py-4">Тип</th>
                      <th className="px-8 py-4">Код</th>
                      <th className="px-8 py-4">Знижка</th>
                      <th className="px-8 py-4">Мін. сума</th>
                      <th className="px-8 py-4">Статус</th>
                      <th className="px-8 py-4">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bonusCodes.map(bc => (
                      <tr key={bc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${bc.type === 'offer' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                            {bc.type === 'offer' ? 'Спец' : 'Промо'}
                          </span>
                        </td>
                        <td className="px-8 py-6 font-bold text-slate-900">{bc.code}</td>
                        <td className="px-8 py-6 text-slate-500">
                          {bc.discount_amount} {bc.discount_type === 'percent' ? '%' : 'грн'}
                        </td>
                        <td className="px-8 py-6 text-slate-500">{bc.min_order_amount} грн</td>
                        <td className="px-8 py-6">
                          <button 
                            onClick={() => toggleBonusCodeStatus(bc.id, bc.is_active)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${bc.is_active ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                          >
                            {bc.is_active ? 'Активний' : 'Неактивний'}
                          </button>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex gap-3">
                            <button 
                              onClick={() => { setEditingBonusCode(bc); setShowBonusCodeModal(true); }}
                              className="p-2 text-slate-400 hover:text-tiffany transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => deleteBonusCode(bc.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'reviews' ? (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Модерація відгуків</h2>
              </div>
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                    <tr>
                      <th className="px-8 py-4">Користувач / Товар</th>
                      <th className="px-8 py-4">Відгук</th>
                      <th className="px-8 py-4">Рейтинг</th>
                      <th className="px-8 py-4">Статус</th>
                      <th className="px-8 py-4">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {reviews.map(review => (
                      <tr key={review.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="font-bold text-slate-900">{review.user_name}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-widest">Товар ID: {review.product_id}</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-sm text-slate-600 max-w-xs truncate">{review.comment}</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-1 text-gold">
                            <Star size={12} fill="currentColor" />
                            <span className="font-bold text-slate-900">{review.rating}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${review.is_approved ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            {review.is_approved ? 'Схвалено' : 'Очікує'}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex gap-3">
                            {!review.is_approved && (
                              <button 
                                onClick={() => updateReviewApproval(review.id, 1)}
                                className="text-xs font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                              >
                                Схвалити
                              </button>
                            )}
                            {review.is_approved && (
                              <button 
                                onClick={() => updateReviewApproval(review.id, 0)}
                                className="text-xs font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors"
                              >
                                Приховати
                              </button>
                            )}
                            <button 
                              onClick={() => { setEditingReview(review); setShowReviewModal(true); }}
                              className="p-2 text-slate-400 hover:text-tiffany transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => deleteReview(review.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {reviews.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-12 text-center text-slate-400">
                          Відгуків поки немає
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'settings' ? (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Налаштування сайту</h2>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm max-w-2xl">
                <form onSubmit={handleSettingsSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Безкоштовна доставка від (грн)</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                      value={siteSettings.free_delivery_min}
                      onChange={e => setSiteSettings({...siteSettings, free_delivery_min: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Днів на повернення</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                      value={siteSettings.return_days}
                      onChange={e => setSiteSettings({...siteSettings, return_days: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Кешбек (%)</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                      value={siteSettings.cashback_percent}
                      onChange={e => setSiteSettings({...siteSettings, cashback_percent: Number(e.target.value)})}
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-tiffany transition-all"
                  >
                    Зберегти зміни
                  </button>
                </form>
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
                {activeTab === 'orders' && (
                  <button 
                    onClick={() => { setEditingOrder(null); setShowOrderModal(true); }}
                    className="bg-tiffany text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 transition-all"
                  >
                    <Plus size={20} /> Створити замовлення
                  </button>
                )}
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
                            {order.comment && (
                              <div className="mt-1 text-[10px] text-amber-600 italic">
                                Коментар: {order.comment}
                              </div>
                            )}
                            {order.trackingNumber && (
                              <div className="mt-1 text-[10px] text-tiffany font-bold">
                                ТТН: {order.trackingNumber}
                              </div>
                            )}
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
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-slate-900">{u.bonuses || 0}</div>
                              <button 
                                onClick={() => updateUserBonuses(u.id, u.bonuses || 0)}
                                className="p-1 text-tiffany hover:bg-tiffany/10 rounded-lg transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
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
                            <div>
                              <div className="font-bold text-slate-900">{cat.name}</div>
                              {cat.parent_id && (
                                <div className="text-[10px] text-slate-400 uppercase font-bold">
                                  Підкатегорія: {categories.find(c => c.id === cat.parent_id)?.name}
                                </div>
                              )}
                            </div>
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
                                onClick={() => {
                                  const url = `${window.location.origin}/product/${product.id}`;
                                  navigator.clipboard.writeText(url);
                                  alert('Посилання скопійовано!');
                                }}
                                className="p-2 text-slate-400 hover:text-gold transition-colors"
                                title="Поділитись"
                              >
                                <Share2 size={18} />
                              </button>
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
              onPaste={async (e) => {
                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                      const base64 = await fileToBase64(blob);
                      if (!mainImage) {
                        setMainImage(base64);
                      } else {
                        setGalleryImages(prev => [...prev, base64]);
                      }
                    }
                  }
                }
              }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-2xl font-bold mb-8">{editingProduct ? 'Редагувати товар' : 'Додати новий товар'}</h2>
              <form onSubmit={handleProductSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Назва</label>
                    <input name="name" defaultValue={editingProduct?.name} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Категорія</label>
                    <select name="category" defaultValue={editingProduct?.category || categories[0]?.slug} className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany">
                      {categories.filter(c => !c.parent_id).map(parent => (
                        <React.Fragment key={parent.id}>
                          <option value={parent.slug}>{parent.name}</option>
                          {categories.filter(c => c.parent_id === parent.id).map(child => (
                            <option key={child.id} value={child.slug}>&nbsp;&nbsp;— {child.name}</option>
                          ))}
                        </React.Fragment>
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
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Матеріал</label>
                    <input name="material" defaultValue={editingProduct?.material} className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Бренд</label>
                    <input name="brand" defaultValue={editingProduct?.brand} className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase">Головне зображення</label>
                      <button 
                        type="button"
                        onClick={() => {
                          const form = document.querySelector('form');
                          const name = (form?.querySelector('input[name="name"]') as HTMLInputElement)?.value;
                          const category = (form?.querySelector('select[name="category"]') as HTMLSelectElement)?.value;
                          if (name) handleAIGenerateImage(name, category);
                          else alert('Введіть назву товару');
                        }}
                        disabled={isGeneratingAI}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-all disabled:opacity-50 border border-indigo-100 shadow-sm"
                      >
                        {isGeneratingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-indigo-500" />}
                        <span>Згенерувати AI Фото</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      {mainImage ? (
                        <div className="relative group">
                          <img src={mainImage} className="w-24 h-24 rounded-xl object-cover" alt="" />
                          <button 
                            type="button"
                            onClick={() => setMainImage('')}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300">
                          <Package size={32} />
                        </div>
                      )}
                      <div className="flex-1">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const base64 = await fileToBase64(file);
                              setMainImage(base64);
                            }
                          }}
                          className="hidden"
                          id="main-image-upload"
                        />
                        <label 
                          htmlFor="main-image-upload"
                          className="inline-block bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          Завантажити фото
                        </label>
                        <div className="mt-2">
                          <input 
                            placeholder="Або вставте URL / Вставте фото (Ctrl+V)"
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                            value={mainImage}
                            onChange={(e) => setMainImage(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-400 uppercase">Галерея зображень</label>
                    <div className="grid grid-cols-4 gap-2">
                      {galleryImages.map((img, idx) => (
                        <div key={idx} className="relative group aspect-square">
                          <img src={img} className="w-full h-full rounded-lg object-cover" alt="" />
                          <button 
                            type="button"
                            onClick={() => setGalleryImages(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                      <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                        <input 
                          type="file" 
                          accept="image/*"
                          multiple
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            const base64s = await Promise.all(files.map(fileToBase64));
                            setGalleryImages(prev => [...prev, ...base64s]);
                          }}
                          className="hidden"
                        />
                        <Plus size={20} className="text-slate-300" />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        id="gallery-url-input"
                        placeholder="Додати URL / Вставити фото (Ctrl+V)"
                        className="flex-1 bg-slate-50 border-none rounded-lg p-2 text-xs focus:ring-2 focus:ring-tiffany"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.target as HTMLInputElement).value;
                            if (val) {
                              setGalleryImages(prev => [...prev, val]);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase">Опис</label>
                      <button 
                        type="button"
                        onClick={() => {
                          const form = document.querySelector('form');
                          const name = (form?.querySelector('input[name="name"]') as HTMLInputElement)?.value;
                          const category = (form?.querySelector('select[name="category"]') as HTMLSelectElement)?.value;
                          if (name) handleAIGenerateDescription(name, category);
                          else alert('Введіть назву товару');
                        }}
                        disabled={isGeneratingAI}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-all disabled:opacity-50 border border-emerald-100 shadow-sm"
                      >
                        {isGeneratingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-emerald-500" />}
                        <span>Згенерувати опис ШІ</span>
                      </button>
                    </div>
                    <textarea 
                      name="description" 
                      value={productDescription} 
                      onChange={e => setProductDescription(e.target.value)}
                      rows={4} 
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase">Порада від ШІ (AI Advice)</label>
                      <button 
                        type="button"
                        onClick={() => {
                          const form = document.querySelector('form');
                          const name = (form?.querySelector('input[name="name"]') as HTMLInputElement)?.value;
                          const category = (form?.querySelector('select[name="category"]') as HTMLSelectElement)?.value;
                          if (name) handleAIGenerateAdvice(name, category);
                          else alert('Введіть назву товару');
                        }}
                        disabled={isGeneratingAdvice}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-all disabled:opacity-50 border border-emerald-100 shadow-sm"
                      >
                        {isGeneratingAdvice ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-emerald-500" />}
                        <span>Згенерувати пораду ШІ</span>
                      </button>
                    </div>
                    <textarea 
                      name="aiDescription" 
                      value={productAiDescription} 
                      onChange={e => setProductAiDescription(e.target.value)}
                      rows={4} 
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-3xl">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" name="isPopular" defaultChecked={editingProduct?.isPopular} className="w-5 h-5 rounded border-slate-300 text-tiffany focus:ring-tiffany" />
                    <label className="text-xs font-bold text-slate-700">Популярний</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" name="isBundle" defaultChecked={editingProduct?.isBundle} className="w-5 h-5 rounded border-slate-300 text-tiffany focus:ring-tiffany" />
                    <label className="text-xs font-bold text-slate-700">Набір (Bundle)</label>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Бонусні бали</label>
                    <input name="bonusPoints" type="number" defaultValue={editingProduct?.bonusPoints || 0} className="w-full bg-white border-none rounded-lg p-2 text-xs focus:ring-2 focus:ring-tiffany" />
                  </div>
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
                  <label className="text-xs font-bold text-slate-400 uppercase">Зображення</label>
                  <div className="flex gap-4 items-center">
                    {categoryImage && (
                      <img src={categoryImage} alt="Preview" className="w-16 h-16 rounded-xl object-cover" />
                    )}
                    <div className="flex-1 space-y-2">
                      <input 
                        type="text"
                        value={categoryImage}
                        onChange={e => setCategoryImage(e.target.value)}
                        placeholder="URL зображення" 
                        className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                      />
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const base64 = await fileToBase64(file);
                              setCategoryImage(base64);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button type="button" className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all">
                          <Upload size={18} /> Завантажити з ПК
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Батьківська категорія</label>
                  <select 
                    name="parent_id" 
                    defaultValue={editingCategory?.parent_id || ""} 
                    className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                  >
                    <option value="">Немає (головна)</option>
                    {categories.filter(c => c.id !== editingCategory?.id && !c.parent_id).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
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
      {/* Order Modal */}
      <AnimatePresence>
        {showOrderModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOrderModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-2xl font-bold mb-8">Створити замовлення вручну</h2>
              <form onSubmit={handleOrderSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Ім'я клієнта</label>
                    <input name="customerName" required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                    <input name="customerEmail" type="email" className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Телефон</label>
                    <input name="customerPhone" required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Місто</label>
                    <input name="customerCity" required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Спосіб доставки</label>
                    <select name="deliveryMethod" className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany">
                      <option value="nova-poshta">Нова Пошта</option>
                      <option value="ukr-poshta">Укрпошта</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Спосіб оплати</label>
                    <select name="paymentMethod" className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany">
                      <option value="card">Карта</option>
                      <option value="cash">Накладений платіж</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold">Товари у замовленні</h3>
                    <select 
                      onChange={(e) => {
                        if (e.target.value) {
                          addManualItem(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="bg-slate-100 border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-tiffany"
                    >
                      <option value="">Додати товар...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} - {p.price} грн</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    {manualOrderItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl">
                        <div className="flex items-center gap-4">
                          <img src={item.image} className="w-10 h-10 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                          <div>
                            <div className="font-bold text-sm">{item.name}</div>
                            <div className="text-xs text-slate-400">{item.price} грн</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <button 
                              type="button"
                              onClick={() => setManualOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))}
                              className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm"
                            >-</button>
                            <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                            <button 
                              type="button"
                              onClick={() => setManualOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                              className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm"
                            >+</button>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setManualOrderItems(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {manualOrderItems.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-2xl">
                        Додайте товари до замовлення
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center p-6 bg-slate-900 text-white rounded-2xl">
                  <div className="text-sm font-medium opacity-70">Загальна сума:</div>
                  <div className="text-2xl font-bold">
                    {manualOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)} грн
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Скасувати</button>
                  <button type="submit" disabled={manualOrderItems.length === 0} className="flex-1 bg-tiffany text-white px-6 py-4 rounded-xl font-bold hover:bg-slate-900 transition-all disabled:opacity-50">Створити замовлення</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showBonusCodeModal && editingBonusCode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBonusCodeModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-2xl font-bold mb-8">Редагувати акцію / промокод</h2>
              <form onSubmit={handleBonusCodeUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Заголовок</label>
                    <input 
                      value={editingBonusCode.title}
                      onChange={e => setEditingBonusCode({...editingBonusCode, title: e.target.value})}
                      required 
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Опис</label>
                    <input 
                      value={editingBonusCode.description}
                      onChange={e => setEditingBonusCode({...editingBonusCode, description: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Код</label>
                    <input 
                      value={editingBonusCode.code}
                      onChange={e => setEditingBonusCode({...editingBonusCode, code: e.target.value.toUpperCase()})}
                      required 
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Тип акції</label>
                    <select 
                      value={editingBonusCode.type}
                      onChange={e => setEditingBonusCode({...editingBonusCode, type: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                    >
                      <option value="promo">Промокод (для кошика)</option>
                      <option value="offer">Спец. пропозиція (інфо)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={editingBonusCode.show_in_site}
                      onChange={e => setEditingBonusCode({...editingBonusCode, show_in_site: e.target.checked})}
                    />
                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-tiffany transition-all"></div>
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all"></div>
                  </div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Відображати у вікні "Акції та набори"</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Знижка</label>
                    <input 
                      type="number"
                      value={editingBonusCode.discount_amount}
                      onChange={e => setEditingBonusCode({...editingBonusCode, discount_amount: Number(e.target.value)})}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Тип знижки</label>
                    <select 
                      value={editingBonusCode.discount_type}
                      onChange={e => setEditingBonusCode({...editingBonusCode, discount_type: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                    >
                      <option value="fixed">Грн</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Мін. сума</label>
                    <input 
                      type="number"
                      value={editingBonusCode.min_order_amount}
                      onChange={e => setEditingBonusCode({...editingBonusCode, min_order_amount: Number(e.target.value)})}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowBonusCodeModal(false)} className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Скасувати</button>
                  <button type="submit" className="flex-1 bg-tiffany text-white px-6 py-4 rounded-xl font-bold hover:bg-slate-900 transition-all">Зберегти зміни</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Review Modal */}
      {showReviewModal && editingReview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl"
          >
            <h3 className="text-2xl font-bold mb-6">Редагувати відгук</h3>
            <form onSubmit={handleReviewUpdate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Коментар</label>
                <textarea 
                  value={editingReview.comment}
                  onChange={e => setEditingReview({...editingReview, comment: e.target.value})}
                  className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany min-h-[150px]"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Рейтинг</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button 
                      key={i} 
                      type="button"
                      onClick={() => setEditingReview({ ...editingReview, rating: i })}
                      className={`p-1 transition-colors ${i <= editingReview.rating ? 'text-gold' : 'text-slate-200'}`}
                    >
                      <Star size={24} fill="currentColor" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowReviewModal(false)} className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Скасувати</button>
                <button type="submit" className="flex-1 bg-tiffany text-white px-6 py-4 rounded-xl font-bold hover:bg-slate-900 transition-all">Зберегти</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
