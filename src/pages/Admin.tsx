import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateAndSaveProductGallery, generateAndSaveProductImage, generateDescription, generateProductGallery, generateProductImage, generateStylingTip, saveWebImageForProduct, searchProductWebImages, suggestBundleItems } from '../services/aiService';
import { generateDirectorReport } from '../services/aiDirectorService';
import { compressDataUrl, fileToBase64 } from '../utils/imageUtils';
import Markdown from 'react-markdown';
import { Package, ShoppingCart, TrendingUp, Plus, Edit2, Trash2, CheckCircle, Clock, Star, Truck, Users, Shield, UserPlus, Filter, Settings, MessageSquare, Tag, Upload, Loader2, Sparkles, Share2, Database, RefreshCw, AlertTriangle, Camera, Globe2, Images } from 'lucide-react';
import { ProductImporter } from '../components/ProductImporter';
import { MOCK_PRODUCTS } from '../constants';
import { Order, User } from '../types';
import { calculateBundlePrice, suggestBundleItemIdsLocally, suggestBundleItemsLocally } from '../utils/bundleRecommendations';
import { isBundleProduct } from '../utils/productFlags';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { useAuth } from '../store/AuthContext';
import { useNavigate } from 'react-router-dom';

const salesData = [
  { name: 'РџРЅ', sales: 4000 },
  { name: 'Р’С‚', sales: 3000 },
  { name: 'РЎСЂ', sales: 2000 },
  { name: 'Р§С‚', sales: 2780 },
  { name: 'РџС‚', sales: 1890 },
  { name: 'РЎР±', sales: 2390 },
  { name: 'РќРґ', sales: 3490 },
];

const categoryData = [
  { name: 'РџРѕСЃСѓРґ', value: 400 },
  { name: 'РўРµРєСЃС‚РёР»СЊ', value: 300 },
  { name: 'РљСѓС…РЅСЏ', value: 300 },
  { name: 'Р”РµРєРѕСЂ', value: 200 },
];

const PAYMENT_LABELS: Record<string, string> = {
  mono: 'Mono Pay',
  liqpay: 'LiqPay',
  cash: 'РќР°РєР»Р°РґРµРЅРёР№ РїР»Р°С‚С–Р¶',
  card: 'РљР°СЂС‚Р°',
  bank: 'РџРµСЂРµРєР°Р· РЅР° СЂР°С…СѓРЅРѕРє'
};

const DELIVERY_LABELS: Record<string, string> = {
  'nova-poshta': 'РќРѕРІР° РџРѕС€С‚Р°',
  'ukr-poshta': 'РЈРєСЂРїРѕС€С‚Р°',
  'quick-order': 'РЁРІРёРґРєРµ Р·Р°РјРѕРІР»РµРЅРЅСЏ'
};

const getPaymentLabel = (method?: string) => PAYMENT_LABELS[method || ''] || 'РќР°РєР»Р°РґРµРЅРёР№ РїР»Р°С‚С–Р¶';
const getDeliveryLabel = (method?: string) => DELIVERY_LABELS[method || ''] || 'РќРѕРІР° РџРѕС€С‚Р°';
const getDeliveryShortLabel = (method?: string) => {
  if (method === 'nova-poshta') return 'РќРџ';
  if (method === 'ukr-poshta') return 'РЈРџ';
  if (method === 'quick-order') return 'РЁРІРёРґРєРµ';
  return getDeliveryLabel(method);
};
const getOrderCustomer = (order: any) => ({
  name: order?.customer?.name ?? order?.customer_name ?? '',
  email: order?.customer?.email ?? order?.customer_email ?? '',
  phone: order?.customer?.phone ?? order?.customer_phone ?? '',
  city: order?.customer?.city ?? order?.customer_city ?? '',
});
const firstFilled = (...values: any[]) =>
  values.map((value) => String(value || '').trim()).find(Boolean) || '';
const stripCityPrefix = (value: string, city: string) => {
  if (!value || !city) return value;
  const cityPrefix = `${city.trim()},`;
  return value.toLowerCase().startsWith(cityPrefix.toLowerCase())
    ? value.slice(cityPrefix.length).trim()
    : value;
};
const getOrderDeliveryDestination = (order: any) => {
  const customer = order?.customer || {};
  const city = firstFilled(customer.city, order?.customer_city);
  const warehouse = firstFilled(customer.warehouse, order?.warehouse, order?.customer_warehouse);
  const address = firstFilled(customer.address, order?.customer_address, order?.address);
  const destination = stripCityPrefix(warehouse || address, city);
  return destination || 'РќРµ РІРєР°Р·Р°РЅРѕ';
};
const getOrderPaymentMethod = (order: any) => order?.paymentMethod ?? order?.payment_method ?? 'cash';
const getOrderDeliveryMethod = (order: any) => order?.customer?.deliveryMethod ?? order?.delivery_method;
const getOrderBonusUsed = (order: any) => Number(order?.bonusUsed ?? order?.bonuses_used ?? order?.bonus_used ?? 0);
const getOrderFinalTotal = (order: any) => Number(order?.finalTotal ?? order?.total_amount ?? order?.final_total ?? order?.total ?? 0);
const getOrderCreatedAt = (order: any) => order?.createdAt ?? order?.created_at ?? new Date().toISOString();
type ProductImageFilter = 'needs-ai' | 'generated' | 'missing' | 'all';
type ProductQualityFilter = 'all' | 'missing-photo' | 'missing-description' | 'missing-cost' | 'low-stock' | 'bad-margin';

export const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const productFormRef = useRef<HTMLFormElement>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'analytics' | 'users' | 'categories' | 'bonus-codes' | 'reviews' | 'settings' | 'import' | 'ai-director'>('analytics');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [chartWidth, setChartWidth] = useState(320);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [isBonusCodesLoading, setIsBonusCodesLoading] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [bonusCodes, setBonusCodes] = useState<any[]>([]);
  const [siteSettings, setSiteSettings] = useState({
    free_delivery_min: 1500,
    return_days: 14,
    cashback_percent: 5,
    hero_title: '',
    hero_subtitle: '',
    hero_featured_product_id: '',
    hero_badge: '',
    bestsellers_badge: '',
    bestsellers_title: '',
    bestsellers_subtitle: ''
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
  const [newProductMode, setNewProductMode] = useState<'product' | 'bundle'>('product');
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
  const [isGeneratingGallery, setIsGeneratingGallery] = useState(false);
  const [isSearchingWebImage, setIsSearchingWebImage] = useState(false);
  const [bulkImageJob, setBulkImageJob] = useState<{ type: 'ai' | 'web'; done: number; total: number } | null>(null);
  const [productImageFilter, setProductImageFilter] = useState<ProductImageFilter>('all');
  const [productQualityFilter, setProductQualityFilter] = useState<ProductQualityFilter>('all');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkTargetMargin, setBulkTargetMargin] = useState(45);
  const [bulkPopularMode, setBulkPopularMode] = useState<'popular' | 'regular'>('popular');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isCreatingSmartBundle, setIsCreatingSmartBundle] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [isGeneratingBundle, setIsGeneratingBundle] = useState(false);
  const [bundleItems, setBundleItems] = useState<string[]>([]);
  const [isBundle, setIsBundle] = useState(false);
  const [aiReport, setAiReport] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [isDbStatusLoading, setIsDbStatusLoading] = useState(false);
  const [isResettingDb, setIsResettingDb] = useState(false);

  const staleProductImagePatterns = [
    /images\.unsplash\.com/i,
    /placeholder|placehold\.co|picsum\.photos/i,
    /data:image\/svg/i,
  ];

  const isStaleAdminProductImage = (value: unknown) => {
    const image = String(value || '').trim();
    return !image || staleProductImagePatterns.some(pattern => pattern.test(image));
  };

  const normalizeAdminGalleryImages = (images: unknown, main = '') => {
    const mainImage = String(main || '').trim();
    const seen = new Set<string>(mainImage ? [mainImage] : []);
    const values = Array.isArray(images) ? images : [];

    return values
      .map(image => String(image || '').trim())
      .filter(image => {
        if (!image || isStaleAdminProductImage(image) || seen.has(image)) return false;
        seen.add(image);
        return true;
      })
      .slice(0, 8);
  };

  const productHasUsablePhoto = (product: any) => {
    const image = String(product?.image || '').trim();
    if (!image) return false;
    if (product?.imageIsPlaceholder === true || product?.hasImage === false) return false;
    return !isStaleAdminProductImage(image);
  };

  const productHasDescription = (product: any) => String(product?.description || '').trim().length >= 30;
  const productHasCostPrice = (product: any) => Number(product?.cost_price || product?.costPrice || 0) > 0;
  const productMarginPercent = (product: any) => {
    const price = Number(product?.price || 0);
    const cost = Number(product?.cost_price || product?.costPrice || 0);
    if (price <= 0 || cost <= 0) return null;
    return Math.round(((price - cost) / price) * 100);
  };
  const productHasWeakMargin = (product: any) => {
    const margin = productMarginPercent(product);
    return margin !== null && margin < 25;
  };

  const parseAdminArrayField = (value: unknown) => {
    if (Array.isArray(value)) return value.filter(Boolean).map(item => String(item));
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(item => String(item)) : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const getProductCostPrice = (product: any) => Number(product?.cost_price ?? product?.costPrice ?? 0);
  const getProductBonusPoints = (product: any) => Number(product?.bonusPoints ?? product?.bonus_points ?? 0);

  const buildAdminProductPayload = (product: any, overrides: Record<string, any> = {}) => ({
    name: product.name || '',
    category: product.category || 'tableware',
    price: Number(product.price || 0),
    image: product.image || '',
    description: product.description || '',
    material: product.material || '',
    brand: product.brand || '',
    isPopular: product.isPopular === true || product.ispopular === true || product.is_popular === true || product.isPopular === 1 || product.ispopular === 1 || product.is_popular === 1 || product.isPopular === '1' || product.ispopular === '1' || product.is_popular === '1',
    isBundle: isBundleProduct(product),
    stock: Number(product.stock || 0),
    images: parseAdminArrayField(product.images),
    bonusPoints: getProductBonusPoints(product),
    bundle_items: parseAdminArrayField(product.bundle_items ?? product.bundleItems),
    cost_price: product.cost_price ?? product.costPrice,
    rating: Number(product.rating || 5),
    reviewCount: Number(product.reviewCount ?? product.review_count ?? 0),
    ...overrides
  });

  const normalizeAdminProductText = (value: unknown) =>
    String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const inferBundleTheme = (items: any[]) => {
    const text = normalizeAdminProductText(items.map(item => `${item.name} ${item.category} ${item.material || ''}`).join(' '));
    if (/РєР°РІР°|Р»Р°С‚Рµ|С‡Р°С€|РєСѓС…РѕР»СЊ|РіР»РµС‡|СЃРєР»СЏРЅ|РєРµР»РёС…/.test(text)) return 'Р Р°РЅРєРѕРІР° РєР°РІР°';
    if (/С‚Р°СЂС–Р»|Р±Р»СЋРґРѕ|СЃР°Р»Р°С‚|СЃРµСЂРІ|РІРёРґРµР»|Р»РѕР¶/.test(text)) return 'РЎРµСЂРІС–СЂСѓРІР°РЅРЅСЏ СЃС‚РѕР»Сѓ';
    if (/Р±Р°РЅРє|С”РјРЅ|РєРѕРЅС‚РµР№РЅ|СЃРёРїСѓС‡|РѕСЂРіР°РЅ|РєРѕС€РёРє/.test(text)) return 'РџРѕСЂСЏРґРѕРє РЅР° РєСѓС…РЅС–';
    if (/С„РѕСЂРјР°|РґРµРєРѕ|РІРёРїС–С‡|Р»РѕРїР°С‚|РїРµРЅР·Р»/.test(text)) return 'РљСѓС…РѕРЅРЅРёР№ СЃС‚Р°СЂС‚';
    return 'РџРѕРґР°СЂСѓРЅРѕРє РґР»СЏ РґРѕРјСѓ';
  };

  const buildBundleDescription = (items: any[], regularTotal: number, bundlePrice: number) => {
    const savings = Math.max(0, regularTotal - bundlePrice);
    const itemLines = items.map((item, index) => `${index + 1}. ${item.name} вЂ” ${Number(item.price || 0)} РіСЂРЅ`).join('\n');
    return [
      `Р“РѕС‚РѕРІРёР№ РЅР°Р±С–СЂ Hatni Shop Р· ${items.length} СЃСѓРјС–СЃРЅРёС… С‚РѕРІР°СЂС–РІ.`,
      '',
      'РЈ РЅР°Р±РѕСЂС–:',
      itemLines,
      '',
      `РћРєСЂРµРјРѕ: ${regularTotal} РіСЂРЅ.`,
      `Р¦С–РЅР° РЅР°Р±РѕСЂСѓ: ${bundlePrice} РіСЂРЅ.`,
      `Р•РєРѕРЅРѕРјС–СЏ: ${savings} РіСЂРЅ.`,
      '',
      'РќР°Р±С–СЂ СЃС„РѕСЂРјРѕРІР°РЅРёР№ С‚Р°Рє, С‰РѕР± С‚РѕРІР°СЂРё РїР°СЃСѓРІР°Р»Рё Р·Р° СЃС†РµРЅР°СЂС–С”Рј РІРёРєРѕСЂРёСЃС‚Р°РЅРЅСЏ, С†С–РЅРѕСЋ С‚Р° РЅР°СЏРІРЅС–СЃС‚СЋ.'
    ].join('\n');
  };

  const getSmartBundleItems = () => {
    const selectedStandalone = selectedProducts.filter(product => !isBundleProduct(product) && Number(product.stock || 0) > 0);
    if (selectedStandalone.length >= 2) return selectedStandalone.slice(0, 6);

    const getCandidates = (source: any[]) =>
      source.filter(product => !isBundleProduct(product) && Number(product.stock || 0) > 0 && Number(product.price || 0) > 0);
    const visibleCandidates = getCandidates(visibleProducts);
    const allCandidates = getCandidates(products);
    const visiblePhotoCount = visibleCandidates.filter(productHasUsablePhoto).length;
    const candidates = visibleCandidates.length >= 2 && visiblePhotoCount >= 2 ? visibleCandidates : allCandidates;
    const seed = selectedStandalone[0] || candidates.find(product => productHasUsablePhoto(product)) || candidates[0];
    if (!seed) return [];

    const suggested = suggestBundleItemsLocally(seed as any, candidates as any, { limit: 5 }) as any[];
    return Array.from(new Map([seed, ...suggested].filter(Boolean).map(product => [product.id, product])).values())
      .sort((a, b) => Number(productHasUsablePhoto(b)) - Number(productHasUsablePhoto(a)))
      .slice(0, 6);
  };

  const productImageCounts = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        const isGenerated = product.imageIsGenerated === true;
        const isMissing = !productHasUsablePhoto(product);
        acc.all += 1;
        if (!isGenerated) acc.needsAi += 1;
        if (isGenerated) acc.generated += 1;
        if (isMissing) acc.missing += 1;
        return acc;
      },
      { all: 0, needsAi: 0, generated: 0, missing: 0 }
    );
  }, [products]);

  const productQualityCounts = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        const stock = Number(product?.stock || 0);
        acc.total += 1;
        if (!productHasUsablePhoto(product)) acc.missingPhoto += 1;
        if (!productHasDescription(product)) acc.missingDescription += 1;
        if (!productHasCostPrice(product)) acc.missingCost += 1;
        if (stock > 0 && stock < 5) acc.lowStock += 1;
        if (productHasWeakMargin(product)) acc.badMargin += 1;
        return acc;
      },
      { total: 0, missingPhoto: 0, missingDescription: 0, missingCost: 0, lowStock: 0, badMargin: 0 }
    );
  }, [products]);

  const imageFilteredProducts = useMemo(() => {
    if (productImageFilter === 'all') return products;
    if (productImageFilter === 'generated') {
      return products.filter(product => product.imageIsGenerated === true);
    }
    if (productImageFilter === 'missing') {
      return products.filter(product => !productHasUsablePhoto(product));
    }
    return products.filter(product => product.imageIsGenerated !== true);
  }, [products, productImageFilter]);

  const visibleProducts = useMemo(() => {
    if (productQualityFilter === 'all') return imageFilteredProducts;
    if (productQualityFilter === 'missing-photo') {
      return imageFilteredProducts.filter(product => !productHasUsablePhoto(product));
    }
    if (productQualityFilter === 'missing-description') {
      return imageFilteredProducts.filter(product => !productHasDescription(product));
    }
    if (productQualityFilter === 'missing-cost') {
      return imageFilteredProducts.filter(product => !productHasCostPrice(product));
    }
    if (productQualityFilter === 'low-stock') {
      return imageFilteredProducts.filter(product => Number(product?.stock || 0) > 0 && Number(product?.stock || 0) < 5);
    }
    return imageFilteredProducts.filter(product => productHasWeakMargin(product));
  }, [imageFilteredProducts, productQualityFilter]);

  const selectedProducts = useMemo(
    () => products.filter(product => selectedProductIds.includes(product.id)),
    [products, selectedProductIds]
  );
  const visibleProductIds = useMemo(() => visibleProducts.map(product => product.id), [visibleProducts]);
  const allVisibleProductsSelected = visibleProductIds.length > 0 && visibleProductIds.every(id => selectedProductIds.includes(id));

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev => prev.includes(productId)
      ? prev.filter(id => id !== productId)
      : [...prev, productId]
    );
  };

  const toggleVisibleProductsSelection = () => {
    setSelectedProductIds(prev => {
      if (allVisibleProductsSelected) {
        return prev.filter(id => !visibleProductIds.includes(id));
      }
      return Array.from(new Set([...prev, ...visibleProductIds]));
    });
  };

  useEffect(() => {
    setSelectedProductIds(prev => prev.filter(id => products.some(product => product.id === id)));
  }, [products]);

  useEffect(() => {
    document.title = 'РђРґРјС–РЅ-РїР°РЅРµР»СЊ вЂ” РҐР°С‚РЅС– РЁС‚СѓС‡РєРё';
  }, []);

  useEffect(() => {
    const updateChartWidth = () => {
      const availableWidth = window.innerWidth - 64;
      setChartWidth(Math.max(280, Math.min(900, availableWidth)));
    };

    updateChartWidth();
    window.addEventListener('resize', updateChartWidth);
    return () => window.removeEventListener('resize', updateChartWidth);
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchDbStatus();
    }
  }, [activeTab]);

  const fetchDbStatus = async () => {
    setIsDbStatusLoading(true);
    try {
      const res = await fetch('/api/admin/db/status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (error) {
      console.error('Error fetching DB status:', error);
    } finally {
      setIsDbStatusLoading(false);
    }
  };

  const resetDbDegradedMode = async () => {
    if (!window.confirm('Р’Рё РІРїРµРІРЅРµРЅС–, С‰Рѕ С…РѕС‡РµС‚Рµ СЃРєРёРЅСѓС‚Рё РѕР±РјРµР¶РµРЅРЅСЏ Р±Р°Р·Рё РґР°РЅРёС…? Р¦Рµ РїСЂРёР·РІРµРґРµ РґРѕ СЃРїСЂРѕР±Рё РїС–РґРєР»СЋС‡РµРЅРЅСЏ РїСЂРё РЅР°СЃС‚СѓРїРЅРѕРјСѓ Р·Р°РїРёС‚С–.')) return;
    
    setIsResettingDb(true);
    try {
      const res = await fetch('/api/admin/db/reset-degraded', { method: 'POST' });
      if (res.ok) {
        alert('РћР±РјРµР¶РµРЅРЅСЏ СЃРєРёРЅСѓС‚Рѕ. Р‘Р°Р·Р° РґР°РЅРёС… СЃРїСЂРѕР±СѓС” РїС–РґРєР»СЋС‡РёС‚РёСЃСЏ Р·РЅРѕРІСѓ.');
        fetchDbStatus();
      }
    } catch (error) {
      console.error('Error resetting DB status:', error);
    } finally {
      setIsResettingDb(false);
    }
  };

  useEffect(() => {
    if (editingProduct) {
      setMainImage(editingProduct.image || '');
      setGalleryImages(normalizeAdminGalleryImages(editingProduct.images || [], editingProduct.image || ''));
      setProductDescription(editingProduct.description || '');
      setProductAiDescription(editingProduct.aiDescription || '');
      setBundleItems(editingProduct.bundle_items || []);
      setIsBundle(isBundleProduct(editingProduct));
    } else {
      setMainImage('');
      setGalleryImages([]);
      setProductDescription('');
      setProductAiDescription('');
      setBundleItems([]);
      setIsBundle(newProductMode === 'bundle');
    }
  }, [editingProduct, showProductModal, newProductMode]);

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
    if (loading || user?.role !== 'admin') return;

    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'products' || activeTab === 'categories' || activeTab === 'import') fetchCategories();
    if (activeTab === 'analytics' || activeTab === 'ai-director') fetchStats();
    if (activeTab === 'ai-director') {
      fetchProducts();
      fetchOrders();
      fetchSiteSettings();
      fetchReviews();
    }
    if (activeTab === 'bonus-codes') fetchBonusCodes();
    if (activeTab === 'reviews') fetchReviews();
    if (activeTab === 'settings') fetchSiteSettings();
  }, [activeTab, loading, user?.role]);

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
        alert('РќР°Р»Р°С€С‚СѓРІР°РЅРЅСЏ Р·Р±РµСЂРµР¶РµРЅРѕ');
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
      alert('Р‘СѓРґСЊ Р»Р°СЃРєР°, Р·Р°РїРѕРІРЅС–С‚СЊ Р·Р°РіРѕР»РѕРІРѕРє С‚Р° РєРѕРґ');
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
        alert('РђРєС†С–СЋ РґРѕРґР°РЅРѕ СѓСЃРїС–С€РЅРѕ');
      } else {
        const error = await res.json();
        alert(`РџРѕРјРёР»РєР°: ${error.error || 'РќРµ РІРґР°Р»РѕСЃСЏ РґРѕРґР°С‚Рё Р°РєС†С–СЋ'}`);
      }
    } catch (err) {
      console.error(err);
      alert('РџРѕРјРёР»РєР° РїСЂРё Р·\'С”РґРЅР°РЅРЅС– Р· СЃРµСЂРІРµСЂРѕРј');
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
        alert('РђРєС†С–СЋ РѕРЅРѕРІР»РµРЅРѕ');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteBonusCode = async (id: string) => {
    if (!confirm('Р’Рё РІРїРµРІРЅРµРЅС–, С‰Рѕ С…РѕС‡РµС‚Рµ РІРёРґР°Р»РёС‚Рё С†РµР№ РїСЂРѕРјРѕРєРѕРґ?')) return;
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
    if (!confirm('Р’Рё РІРїРµРІРЅРµРЅС–, С‰Рѕ С…РѕС‡РµС‚Рµ РІРёРґР°Р»РёС‚Рё С†РµР№ РІС–РґРіСѓРє?')) return;
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
        alert('Р’С–РґРіСѓРє РѕРЅРѕРІР»РµРЅРѕ');
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
    if (!window.confirm('Р’Рё РІРїРµРІРЅРµРЅС–, С‰Рѕ С…РѕС‡РµС‚Рµ СЃРєРёРЅСѓС‚Рё РІСЃСЋ СЃС‚Р°С‚РёСЃС‚РёРєСѓ? Р¦Рµ РІРёРґР°Р»РёС‚СЊ СѓСЃС– Р·Р°РјРѕРІР»РµРЅРЅСЏ Р· Р±Р°Р·Рё РґР°РЅРёС…!')) return;
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
      const res = await fetch('/api/categories', { cache: 'no-store' });
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
    const amount = window.prompt('Р’РІРµРґС–С‚СЊ РЅРѕРІСѓ РєС–Р»СЊРєС–СЃС‚СЊ Р±РѕРЅСѓСЃС–РІ:', currentBonuses.toString());
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
    if (!window.confirm('Р’Рё РІРїРµРІРЅРµРЅС–, С‰Рѕ С…РѕС‡РµС‚Рµ РІРёРґР°Р»РёС‚Рё С†СЋ РєР°С‚РµРіРѕСЂС–СЋ?')) return;
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
        alert(`РџРѕРјРёР»РєР° Р·Р±РµСЂРµР¶РµРЅРЅСЏ: ${errorData.error || res.statusText}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`РџРѕРјРёР»РєР°: ${err.message}`);
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
        alert(`РџРѕРјРёР»РєР° Р·Р±РµСЂРµР¶РµРЅРЅСЏ: ${errorData.error || res.statusText}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`РџРѕРјРёР»РєР°: ${err.message}`);
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
      const res = await fetch('/api/admin/products', { cache: 'no-store' });
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

  const openProductEditor = async (product: any) => {
    setNewProductMode('product');
    setEditingProduct(product);
    setShowProductModal(true);

    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch product details');
      const fullProduct = await res.json();
      setEditingProduct(fullProduct);
    } catch (err) {
      console.error('Error fetching product details:', err);
    }
  };

  const fetchOrders = async () => {
    setIsOrderLoading(true);
    try {
      const res = await fetch('/api/admin/orders', { cache: 'no-store' });
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
      const input = window.prompt('Р’РІРµРґС–С‚СЊ РЅРѕРјРµСЂ РўРўРќ:');
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
    if (!window.confirm('Р’Рё РІРїРµРІРЅРµРЅС–, С‰Рѕ С…РѕС‡РµС‚Рµ РІРёРґР°Р»РёС‚Рё С†РµР№ С‚РѕРІР°СЂ?')) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      if (res.ok) fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  const getProductFormBasics = () => {
    const form = productFormRef.current;
    return {
      name: (form?.querySelector('input[name="name"]') as HTMLInputElement)?.value?.trim() || '',
      category: (form?.querySelector('select[name="category"]') as HTMLSelectElement)?.value || ''
    };
  };

  const appendGalleryImages = (images: string[]) => {
    setGalleryImages(prev => {
      const seen = new Set([mainImage, ...prev].filter(Boolean));
      const next = [...prev];
      for (const image of images) {
        const cleanImage = String(image || '').trim();
        if (cleanImage && !isStaleAdminProductImage(cleanImage) && !seen.has(cleanImage)) {
          seen.add(cleanImage);
          next.push(cleanImage);
        }
      }
      return normalizeAdminGalleryImages(next, mainImage);
    });
  };

  const optimizeMainImage = (image: string) =>
    compressDataUrl(image, { maxWidth: 1050, maxHeight: 1050, quality: 0.74, targetBytes: 560 * 1024 });

  const optimizeGalleryImage = (image: string) =>
    compressDataUrl(image, { maxWidth: 850, maxHeight: 850, quality: 0.7, targetBytes: 300 * 1024 });

  const handleFindWebImage = async () => {
    const { name, category } = getProductFormBasics();
    if (!name) {
      alert('Р’РІРµРґС–С‚СЊ РЅР°Р·РІСѓ С‚РѕРІР°СЂСѓ');
      return;
    }

    setIsSearchingWebImage(true);
    try {
      const result = await searchProductWebImages(name, category);
      if (!result.configured) {
        window.open(result.openSearchUrl, '_blank', 'noopener,noreferrer');
        alert('РђРІС‚РѕРјР°С‚РёС‡РЅРёР№ РїРѕС€СѓРє СЂРµР°Р»СЊРЅРёС… С„РѕС‚Рѕ РїРѕС‚СЂРµР±СѓС” GOOGLE_SEARCH_API_KEY С‚Р° GOOGLE_SEARCH_ENGINE_ID Сѓ Vercel. РЇ РІС–РґРєСЂРёРІ РіРѕС‚РѕРІРёР№ РїРѕС€СѓРє, РјРѕР¶РЅР° СЃРєРѕРїС–СЋРІР°С‚Рё С„РѕС‚Рѕ Р°Р±Рѕ URL РІСЂСѓС‡РЅСѓ.');
        return;
      }

      const candidate = result.candidates[0];
      if (!candidate) {
        window.open(result.openSearchUrl, '_blank', 'noopener,noreferrer');
        alert('РђРІС‚РѕРјР°С‚РёС‡РЅРѕ РЅРµ Р·РЅР°Р№С€РѕРІ СЏРєС–СЃРЅРµ С„РѕС‚Рѕ. Р’С–РґРєСЂРёРІ СЂСѓС‡РЅРёР№ РїРѕС€СѓРє РїРѕ РЅР°Р·РІС–.');
        return;
      }

      if (editingProduct?.id) {
        const saved = await saveWebImageForProduct(editingProduct.id);
        const image = saved.product?.image || saved.candidate?.url || candidate.url;
        setMainImage(image);
        setGalleryImages(normalizeAdminGalleryImages(saved.product?.images || [], image));
        fetchProducts();
      } else {
        setMainImage(candidate.url);
        setGalleryImages(prev => normalizeAdminGalleryImages(prev, candidate.url));
      }
    } catch (err: any) {
      console.error(err);
      alert(`РќРµ РІРґР°Р»РѕСЃСЏ РїС–РґС–Р±СЂР°С‚Рё С„РѕС‚Рѕ РѕРЅР»Р°Р№РЅ: ${err.message || 'РїРѕРјРёР»РєР° СЃРµСЂРІРµСЂР°'}`);
    } finally {
      setIsSearchingWebImage(false);
    }
  };

  const handleAIGenerateDescription = async (name: string, category: string) => {
    if (productDescription && productDescription.trim().length > 0) {
      if (!confirm('РћРїРёСЃ РІР¶Рµ С–СЃРЅСѓС”. Р’Рё РІРїРµРІРЅРµРЅС–, С‰Рѕ С…РѕС‡РµС‚Рµ РїРµСЂРµРіРµРЅРµСЂСѓРІР°С‚Рё Р№РѕРіРѕ?')) {
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
      alert('РџРѕРјРёР»РєР° РїСЂРё РіРµРЅРµСЂР°С†С–С— РѕРїРёСЃСѓ');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAIGenerateImage = async (name: string, category: string) => {
    setIsGeneratingAI(true);
    try {
      const image = await generateProductImage(name, category, mainImage);
      if (image) {
        const optimizedImage = await optimizeMainImage(image);
        setMainImage(optimizedImage);
        setGalleryImages(prev => normalizeAdminGalleryImages(prev, optimizedImage));
      }
    } catch (err) {
      console.error(err);
      alert('РџРѕРјРёР»РєР° РїСЂРё РіРµРЅРµСЂР°С†С–С— Р·РѕР±СЂР°Р¶РµРЅРЅСЏ');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAIGenerateGallery = async (name: string, category: string) => {
    setIsGeneratingGallery(true);
    try {
      if (editingProduct?.id) {
        const result = await generateAndSaveProductGallery(editingProduct.id, 3);
        const nextMainImage = result.product?.image ? await optimizeMainImage(result.product.image) : mainImage;
        if (nextMainImage) setMainImage(nextMainImage);
        if (Array.isArray(result.product?.images)) {
          const optimizedImages = await Promise.all(result.product.images.map(optimizeGalleryImage));
          setGalleryImages(normalizeAdminGalleryImages(optimizedImages, nextMainImage));
        } else {
          const optimizedImages = await Promise.all((result.images || []).map(optimizeGalleryImage));
          setGalleryImages(normalizeAdminGalleryImages(optimizedImages, nextMainImage));
        }
        fetchProducts();
      } else {
        const images = await generateProductGallery(name, category, mainImage, 3);
        if (images.length > 0) {
          const optimizedImages = await Promise.all(images.map(optimizeGalleryImage));
          if (!mainImage) setMainImage(await optimizeMainImage(images[0]));
          appendGalleryImages(optimizedImages);
        }
      }
    } catch (err) {
      console.error(err);
      alert('РџРѕРјРёР»РєР° РїСЂРё РіРµРЅРµСЂР°С†С–С— AI РіР°Р»РµСЂРµС—');
    } finally {
      setIsGeneratingGallery(false);
    }
  };

  const getBlockingBulkImageError = (type: 'ai' | 'web', error: any) => {
    const message = String(error?.message || '').trim();
    if (type === 'ai' && /Gemini.*quota|Gemini.*rate limit/i.test(message)) {
      return 'AI-С„РѕС‚Рѕ Р·СѓРїРёРЅРµРЅРѕ: Gemini С‚Р°РєРѕР¶ СѓРїРµСЂСЃСЏ РІ РєРІРѕС‚Сѓ. Р—Р±С–Р»СЊС€С–С‚СЊ Р»С–РјС–С‚ Gemini API Р°Р±Рѕ РїРѕРїРѕРІРЅС–С‚СЊ OpenAI Billing.';
    }
    if (type === 'ai' && /billing hard limit|OpenAI.*quota|OpenAI.*rate limit/i.test(message)) {
      return 'AI-С„РѕС‚Рѕ Р·СѓРїРёРЅРµРЅРѕ: РЅР° OpenAI Р·Р°РєС–РЅС‡РёРІСЃСЏ Р»С–РјС–С‚/РєСЂРµРґРёС‚Рё. РџРѕРїРѕРІРЅС–С‚СЊ Billing Р°Р±Рѕ РґРѕРґР°Р№С‚Рµ GEMINI_API_KEY Сѓ Vercel СЏРє Р·Р°РїР°СЃРЅРёР№ РіРµРЅРµСЂР°С‚РѕСЂ.';
    }
    if (type === 'ai' && /OPENAI_API_KEY|GEMINI_API_KEY|not configured/i.test(message)) {
      return 'AI-С„РѕС‚Рѕ Р·СѓРїРёРЅРµРЅРѕ: РЅРµ РЅР°Р»Р°С€С‚РѕРІР°РЅРёР№ РєР»СЋС‡ РіРµРЅРµСЂР°С†С–С— Р·РѕР±СЂР°Р¶РµРЅСЊ Сѓ Vercel.';
    }
    if (type === 'web' && /Google image search is not configured|GOOGLE_SEARCH/i.test(message)) {
      return 'Р РµР°Р»СЊРЅС– С„РѕС‚Рѕ Р·СѓРїРёРЅРµРЅРѕ: РЅРµ РЅР°Р»Р°С€С‚РѕРІР°РЅС– GOOGLE_SEARCH_API_KEY С‚Р° GOOGLE_SEARCH_ENGINE_ID Сѓ Vercel.';
    }
    return '';
  };

  const updateSelectedProducts = async (
    targets: any[],
    makeOverrides: (product: any) => Record<string, any> | null,
    successLabel: string
  ) => {
    if (targets.length === 0) {
      alert('Р’РёР±РµСЂС–С‚СЊ С‚РѕРІР°СЂРё РґР»СЏ РјР°СЃРѕРІРѕС— РґС–С—.');
      return;
    }

    setIsBulkUpdating(true);
    let success = 0;
    let failed = 0;
    let skipped = 0;

    try {
      for (const product of targets) {
        const overrides = makeOverrides(product);
        if (!overrides) {
          skipped += 1;
          continue;
        }

        const res = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildAdminProductPayload(product, overrides))
        });

        if (res.ok) {
          success += 1;
        } else {
          failed += 1;
        }
      }

      await fetchProducts();
      if (failed === 0) setSelectedProductIds([]);
      alert(`${successLabel}. РћРЅРѕРІР»РµРЅРѕ: ${success}. РџСЂРѕРїСѓС‰РµРЅРѕ: ${skipped}. РџРѕРјРёР»РѕРє: ${failed}.`);
    } catch (err: any) {
      console.error(err);
      alert(`РџРѕРјРёР»РєР° РјР°СЃРѕРІРѕРіРѕ РѕРЅРѕРІР»РµРЅРЅСЏ: ${err?.message || err}`);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const applyBulkCategory = () => {
    if (!bulkCategory) {
      alert('РћР±РµСЂС–С‚СЊ РєР°С‚РµРіРѕСЂС–СЋ РґР»СЏ РІРёР±СЂР°РЅРёС… С‚РѕРІР°СЂС–РІ.');
      return;
    }
    updateSelectedProducts(selectedProducts, () => ({ category: bulkCategory }), 'РљР°С‚РµРіРѕСЂС–СЋ Р·Р°СЃС‚РѕСЃРѕРІР°РЅРѕ');
  };

  const applyBulkMargin = () => {
    const margin = Math.min(85, Math.max(5, Number(bulkTargetMargin || 0)));
    updateSelectedProducts(
      selectedProducts,
      (product) => {
        const cost = getProductCostPrice(product);
        if (cost <= 0) return null;
        const price = Math.max(1, Math.ceil(cost / (1 - margin / 100)));
        return {
          price,
          bonusPoints: Math.max(0, Math.round(price * 0.05))
        };
      },
      `Р¦С–РЅРё РїРµСЂРµСЂР°С…РѕРІР°РЅРѕ РїС–Рґ РјР°СЂР¶Сѓ ${margin}%`
    );
  };

  const applyBulkPopular = () => {
    updateSelectedProducts(
      selectedProducts,
      () => ({ isPopular: bulkPopularMode === 'popular' }),
      'РЎС‚Р°С‚СѓСЃ РїРѕРїСѓР»СЏСЂРЅРѕСЃС‚С– РѕРЅРѕРІР»РµРЅРѕ'
    );
  };

  const createSmartBundle = async () => {
    const items = getSmartBundleItems();
    if (items.length < 2) {
      alert('РџРѕС‚СЂС–Р±РЅРѕ РјС–РЅС–РјСѓРј 2 РґРѕСЃС‚СѓРїРЅС– С‚РѕРІР°СЂРё, С‰РѕР± СЃС‚РІРѕСЂРёС‚Рё РЅР°Р±С–СЂ.');
      return;
    }

    const regularTotal = items.reduce((sum, product) => sum + Number(product.price || 0), 0);
    const bundlePrice = calculateBundlePrice(items as any[], 0.12);
    const savings = Math.max(0, regularTotal - bundlePrice);
    const theme = inferBundleTheme(items);
    const normalizedTheme = normalizeAdminProductText(theme);
    const similarBundles = products.filter(product =>
      isBundleProduct(product) && normalizeAdminProductText(product.name).includes(normalizedTheme)
    ).length;
    const name = similarBundles > 0 ? `РќР°Р±С–СЂ "${theme}" #${similarBundles + 1}` : `РќР°Р±С–СЂ "${theme}"`;
    const images = items
      .filter(productHasUsablePhoto)
      .map(product => String(product.image || '').trim())
      .filter(Boolean);
    const costs = items.map(getProductCostPrice).filter(cost => cost > 0);
    const stock = Math.max(0, Math.min(...items.map(product => Number(product.stock || 0))));

    const payload = {
      name,
      category: 'bundles',
      price: bundlePrice,
      image: images[0] || '',
      images: images.slice(1, 5),
      description: buildBundleDescription(items, regularTotal, bundlePrice),
      material: 'РєРѕРјРїР»РµРєС‚',
      brand: 'Hatni Shop',
      isPopular: true,
      isBundle: true,
      stock,
      bonusPoints: Math.round(bundlePrice * 0.05),
      bundle_items: items.map(product => product.id),
      cost_price: costs.length === items.length ? Math.round(costs.reduce((sum, cost) => sum + cost, 0) * 0.96) : undefined,
      rating: 5,
      reviewCount: 0
    };

    setIsCreatingSmartBundle(true);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        alert(`РќРµ РІРґР°Р»РѕСЃСЏ СЃС‚РІРѕСЂРёС‚Рё РЅР°Р±С–СЂ: ${errorData.error || res.statusText}`);
        return;
      }

      await fetchProducts();
      setSelectedProductIds([]);
      alert(`РЎС‚РІРѕСЂРµРЅРѕ ${name}. Р•РєРѕРЅРѕРјС–СЏ РґР»СЏ РєР»С–С”РЅС‚Р°: ${savings} РіСЂРЅ.`);
    } catch (err: any) {
      console.error(err);
      alert(`РџРѕРјРёР»РєР° СЃС‚РІРѕСЂРµРЅРЅСЏ РЅР°Р±РѕСЂСѓ: ${err?.message || err}`);
    } finally {
      setIsCreatingSmartBundle(false);
    }
  };

  const runBulkImageJob = async (type: 'ai' | 'web', customProducts?: any[]) => {
    const targetProducts = customProducts && customProducts.length > 0 ? customProducts : visibleProducts;
    if (targetProducts.length === 0) {
      alert('РЈ С†СЊРѕРјСѓ С„С–Р»СЊС‚СЂС– РЅРµРјР°С” С‚РѕРІР°СЂС–РІ РґР»СЏ РѕР±СЂРѕР±РєРё.');
      return;
    }

    if (type === 'web') {
      let probe;
      try {
        probe = await searchProductWebImages(targetProducts[0].name, targetProducts[0].category, 1);
      } catch (error: any) {
        alert(getBlockingBulkImageError(type, error) || `РќРµ РІРґР°Р»РѕСЃСЏ РїРµСЂРµРІС–СЂРёС‚Рё РїРѕС€СѓРє С„РѕС‚Рѕ: ${error?.message || error}`);
        return;
      }
      if (!probe.configured) {
        window.open(probe.openSearchUrl, '_blank', 'noopener,noreferrer');
        alert('Р”Р»СЏ Р°РІС‚РѕРјР°С‚РёС‡РЅРѕРіРѕ РјР°СЃРѕРІРѕРіРѕ РїС–РґР±РѕСЂСѓ СЂРµР°Р»СЊРЅРёС… С„РѕС‚Рѕ С‚СЂРµР±Р° РґРѕРґР°С‚Рё GOOGLE_SEARCH_API_KEY С‚Р° GOOGLE_SEARCH_ENGINE_ID Сѓ Vercel. Р‘РµР· РЅРёС… РІС–РґРєСЂРёРІР°СЋ СЂСѓС‡РЅРёР№ РїРѕС€СѓРє.');
        return;
      }
    }

    const label = type === 'ai' ? 'AI-С„РѕС‚Рѕ' : 'СЂРµР°Р»СЊРЅС– С„РѕС‚Рѕ Р· РїРѕС€СѓРєСѓ';
    const scopeLabel = customProducts && customProducts.length > 0 ? 'РІРёР±СЂР°РЅРёС… С‚РѕРІР°СЂС–РІ' : 'С‚РѕРІР°СЂС–РІ Сѓ РїРѕС‚РѕС‡РЅРѕРјСѓ С„С–Р»СЊС‚СЂС–';
    if (!window.confirm(`Р—Р°РїСѓСЃС‚РёС‚Рё РјР°СЃРѕРІРµ РѕРЅРѕРІР»РµРЅРЅСЏ: ${label} РґР»СЏ ${targetProducts.length} ${scopeLabel}? Р¦Рµ РјРѕР¶Рµ С‚СЂРёРІР°С‚Рё РєС–Р»СЊРєР° С…РІРёР»РёРЅ.`)) return;

    setBulkImageJob({ type, done: 0, total: targetProducts.length });
    let success = 0;
    let failed = 0;
    let stoppedMessage = '';

    for (const product of targetProducts) {
      try {
        const result = type === 'ai'
          ? await generateAndSaveProductImage(product.id)
          : await saveWebImageForProduct(product.id);
        if (result.product) {
          setProducts(prev => prev.map(item => item.id === product.id ? {
            ...item,
            hasImage: true,
            imageIsGenerated: type === 'ai',
            imageIsPlaceholder: false,
            needsAiImage: type !== 'ai',
            imageStatus: type === 'ai' ? 'generated' : 'external',
            image: `/api/product-images/${encodeURIComponent(product.id)}/main?refresh=${Date.now()}`
          } : item));
        }
        success += 1;
      } catch (err) {
        console.error(`Bulk ${type} image failed for ${product.id}:`, err);
        failed += 1;
        const blockingMessage = getBlockingBulkImageError(type, err);
        if (blockingMessage) {
          stoppedMessage = blockingMessage;
          break;
        }
      } finally {
        setBulkImageJob({ type, done: success + failed, total: targetProducts.length });
      }
    }

    setBulkImageJob(null);
    fetchProducts();
    const skipped = Math.max(0, targetProducts.length - success - failed);
    if (stoppedMessage) {
      alert(`${stoppedMessage}\nРћРЅРѕРІР»РµРЅРѕ: ${success}. РџРѕРјРёР»РѕРє: ${failed}. РќРµ РѕР±СЂРѕР±Р»РµРЅРѕ: ${skipped}.`);
      return;
    }
    alert(`Р“РѕС‚РѕРІРѕ. РћРЅРѕРІР»РµРЅРѕ: ${success}. РџРѕРјРёР»РѕРє: ${failed}.`);
  };

  const handleAIGenerateAdvice = async (name: string, category: string) => {
    if (productAiDescription && productAiDescription.trim().length > 0) {
      if (!confirm('РџРѕСЂР°РґР° РІР¶Рµ С–СЃРЅСѓС”. Р’Рё РІРїРµРІРЅРµРЅС–, С‰Рѕ С…РѕС‡РµС‚Рµ РїРµСЂРµРіРµРЅРµСЂСѓРІР°С‚Рё С—С—?')) {
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
      alert('РџРѕРјРёР»РєР° РїСЂРё РіРµРЅРµСЂР°С†С–С— РїРѕСЂР°РґРё');
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  const handleAIGenerateBundle = async (name: string, category: string) => {
    setIsGeneratingBundle(true);
    try {
      const suggestedIds = await suggestBundleItems(name, category, products);
      if (suggestedIds && suggestedIds.length > 0) {
        setBundleItems(suggestedIds);
      } else {
        const fallbackIds = suggestBundleItemIdsLocally({ id: editingProduct?.id || 'draft-bundle', name, category, price: Number(productFormRef.current?.querySelector<HTMLInputElement>('input[name="price"]')?.value || 0), image: '', description: '', stock: 1, rating: 5 }, products as any, { limit: 4 });
        if (fallbackIds.length > 0) setBundleItems(fallbackIds);
        else alert('РќРµ РІРґР°Р»РѕСЃСЏ РїС–РґС–Р±СЂР°С‚Рё С‚РѕРІР°СЂРё РґР»СЏ РЅР°Р±РѕСЂСѓ');
      }
    } catch (err) {
      console.error(err);
      const fallbackIds = suggestBundleItemIdsLocally({ id: editingProduct?.id || 'draft-bundle', name, category, price: Number(productFormRef.current?.querySelector<HTMLInputElement>('input[name="price"]')?.value || 0), image: '', description: '', stock: 1, rating: 5 }, products as any, { limit: 4 });
      if (fallbackIds.length > 0) setBundleItems(fallbackIds);
      else alert('РџРѕРјРёР»РєР° РїСЂРё РіРµРЅРµСЂР°С†С–С— РЅР°Р±РѕСЂСѓ');
    } finally {
      setIsGeneratingBundle(false);
    }
  };

  const handleAutoGenerateBundle = (name: string, category: string) => {
    const price = Number(productFormRef.current?.querySelector<HTMLInputElement>('input[name="price"]')?.value || 0);
    const suggestedIds = suggestBundleItemIdsLocally({ id: editingProduct?.id || 'draft-bundle', name, category, price, image: '', description: '', stock: 1, rating: 5 }, products as any, { limit: 4 });
    if (suggestedIds.length > 0) {
      setBundleItems(suggestedIds);
    } else {
      alert('РќРµ Р·РЅР°Р№С€РѕРІ РґРѕСЃС‚Р°С‚РЅСЊРѕ СЃСѓРјС–СЃРЅРёС… С‚РѕРІР°СЂС–РІ');
    }
  };

  const handleProductSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const optimizedMainImage = await optimizeMainImage(mainImage);
    const cleanGalleryImages = normalizeAdminGalleryImages(galleryImages, optimizedMainImage);
    const optimizedGalleryImages = normalizeAdminGalleryImages(
      await Promise.all(cleanGalleryImages.map(optimizeGalleryImage)),
      optimizedMainImage
    );
    setMainImage(optimizedMainImage);
    setGalleryImages(optimizedGalleryImages);

    const productData = {
      ...Object.fromEntries(formData.entries()),
      image: optimizedMainImage,
      images: optimizedGalleryImages,
      isPopular: formData.get('isPopular') === 'on',
      isBundle: isBundle,
      bundle_items: bundleItems,
      price: Number(formData.get('price')),
      cost_price: formData.get('cost_price') ? Number(formData.get('cost_price')) : undefined,
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
        const statusText = res.status === 413 ? 'Р¤Р°Р№Р» Р·Р°РЅР°РґС‚Рѕ РІРµР»РёРєРёР№ (Payload Too Large)' : res.statusText;
        alert(`РџРѕРјРёР»РєР° Р·Р±РµСЂРµР¶РµРЅРЅСЏ: ${errorData.error || statusText || `РЎС‚Р°С‚СѓСЃ ${res.status}`}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`РџРѕРјРёР»РєР°: ${err.message}`);
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
            <TrendingUp size={20} /> РђРЅР°Р»С–С‚РёРєР°
          </button>
          <button 
            onClick={() => setActiveTab('ai-director')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'ai-director' ? 'bg-gradient-to-r from-tiffany to-slate-900 text-white shadow-lg' : 'text-tiffany hover:bg-tiffany/5'}`}
          >
            <Sparkles size={20} /> AI Р”РёСЂРµРєС‚РѕСЂ
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'orders' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <ShoppingCart size={20} /> Р—Р°РјРѕРІР»РµРЅРЅСЏ
          </button>
          <button 
            onClick={() => setActiveTab('products')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'products' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Package size={20} /> РўРѕРІР°СЂРё
          </button>
          <button 
            onClick={() => setActiveTab('import')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'import' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Upload size={20} /> Р†РјРїРѕСЂС‚
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'categories' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Filter size={20} /> РљР°С‚РµРіРѕСЂС–С—
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Users size={20} /> РљРѕСЂРёСЃС‚СѓРІР°С‡С–
          </button>
          <button 
            onClick={() => setActiveTab('bonus-codes')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'bonus-codes' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Tag size={20} /> РђРєС†С–С—
          </button>
          <button 
            onClick={() => setActiveTab('reviews')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'reviews' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <MessageSquare size={20} /> Р’С–РґРіСѓРєРё
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'settings' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Settings size={20} /> РќР°Р»Р°С€С‚СѓРІР°РЅРЅСЏ
          </button>
          <div className="h-px bg-slate-100 my-4" />
          <div className="p-6 bg-tiffany/5 rounded-3xl border border-tiffany/10">
            <div className="text-xs text-slate-400 uppercase font-bold mb-1">Р‘Р°Р»Р°РЅСЃ Р±РѕРЅСѓСЃС–РІ</div>
            <div className="text-2xl font-bold text-slate-900">{stats?.totalBonuses?.toLocaleString() || '0'}</div>
            <div className="text-[10px] text-slate-400">РќР°СЂР°С…РѕРІР°РЅРѕ РєР»С–С”РЅС‚Р°Рј</div>
          </div>
        </aside>

        {/* Main Content */}
          <main className="flex-1 space-y-8">
            {activeTab === 'import' ? (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Р†РјРїРѕСЂС‚ С‚РѕРІР°СЂС–РІ</h2>
                </div>
                <ProductImporter 
                  categories={categories} 
                  onComplete={() => {
                    setActiveTab('products');
                    fetchProducts();
                  }} 
                />
              </div>
            ) : activeTab === 'ai-director' ? (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">AI Р”РёСЂРµРєС‚РѕСЂ Р· Р°РЅР°Р»С–С‚РёРєРё С‚Р° СЂРѕСЃС‚Сѓ</h2>
                    <p className="text-slate-500">РЎС‚СЂР°С‚РµРіС–С‡РЅС– СЂРµРєРѕРјРµРЅРґР°С†С–С— РЅР° РѕСЃРЅРѕРІС– РґР°РЅРёС… РІР°С€РѕРіРѕ РјР°РіР°Р·РёРЅСѓ</p>
                  </div>
                  <button 
                    onClick={async () => {
                      setIsGeneratingReport(true);
                      try {
                        const report = await generateDirectorReport({
                          products,
                          orders,
                          stats,
                          siteSettings,
                          reviews
                        });
                        if (report) {
                          setAiReport(report);
                        } else {
                          throw new Error('РћС‚СЂРёРјР°РЅРѕ РїРѕСЂРѕР¶РЅС–Р№ Р·РІС–С‚');
                        }
                      } catch (err: any) {
                        console.error('AI Director Error:', err);
                        alert(`РџРѕРјРёР»РєР° РїСЂРё РіРµРЅРµСЂР°С†С–С— Р·РІС–С‚Сѓ: ${err.message || 'РќРµРІС–РґРѕРјР° РїРѕРјРёР»РєР°'}`);
                      } finally {
                        setIsGeneratingReport(false);
                      }
                    }}
                    disabled={isGeneratingReport}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-tiffany transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50"
                  >
                    {isGeneratingReport ? (
                      <><Loader2 size={20} className="animate-spin" /> РђРЅР°Р»С–Р·СѓСЋ...</>
                    ) : (
                      <><Sparkles size={20} /> РЎС„РѕСЂРјСѓРІР°С‚Рё Р·РІС–С‚</>
                    )}
                  </button>
                </div>

                {aiReport ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm prose prose-slate max-w-none"
                  >
                    <div className="flex items-center gap-4 mb-8 p-4 bg-tiffany/5 rounded-2xl border border-tiffany/10">
                      <div className="w-12 h-12 bg-tiffany text-white rounded-xl flex items-center justify-center">
                        <Sparkles size={24} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">Р—РІС–С‚ СЃС„РѕСЂРјРѕРІР°РЅРѕ AI Р”РёСЂРµРєС‚РѕСЂРѕРј</div>
                        <div className="text-xs text-slate-400">РќР° РѕСЃРЅРѕРІС– Р°РЅР°Р»С–Р·Сѓ {products.length} С‚РѕРІР°СЂС–РІ С‚Р° {orders.length} Р·Р°РјРѕРІР»РµРЅСЊ</div>
                      </div>
                    </div>
                    
                    <div className="markdown-body">
                      <Markdown>
                        {aiReport}
                      </Markdown>
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-white p-20 rounded-[3rem] border border-dashed border-slate-200 text-center">
                    <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                      <TrendingUp size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Р—РІС–С‚ С‰Рµ РЅРµ СЃС„РѕСЂРјРѕРІР°РЅРѕ</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-8">
                      РќР°С‚РёСЃРЅС–С‚СЊ РєРЅРѕРїРєСѓ РІРёС‰Рµ, С‰РѕР± AI Р”РёСЂРµРєС‚РѕСЂ РїСЂРѕР°РЅР°Р»С–Р·СѓРІР°РІ РІР°С€С– РїСЂРѕРґР°Р¶С–, Р·Р°Р»РёС€РєРё С‚Р° РїРѕРІРµРґС–РЅРєСѓ РєР»С–С”РЅС‚С–РІ РґР»СЏ РЅР°РґР°РЅРЅСЏ СЃС‚СЂР°С‚РµРіС–С‡РЅРёС… РїРѕСЂР°Рґ.
                    </p>
                  </div>
                )}
              </div>
            ) : activeTab === 'analytics' ? (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">РђРЅР°Р»С–С‚РёРєР°</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={fetchStats}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold transition-all"
                  >
                    <Clock size={16} /> РћРЅРѕРІРёС‚Рё
                  </button>
                  <button 
                    onClick={resetStats}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl text-sm font-bold transition-all"
                  >
                    <Trash2 size={16} /> РЎРєРёРЅСѓС‚Рё
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'РџСЂРѕРґР°Р¶С–', value: `${stats?.totalSales?.toLocaleString() || '0'} РіСЂРЅ`, change: '+12%', color: 'text-tiffany' },
                  { label: 'Р—Р°РјРѕРІР»РµРЅРЅСЏ', value: stats?.orderCount?.toString() || '0', change: '+5%', color: 'text-slate-900' },
                  { label: 'РЎРµСЂРµРґРЅС–Р№ С‡РµРє', value: `${Math.round(stats?.avgOrderValue || 0).toLocaleString()} РіСЂРЅ`, change: '+8%', color: 'text-gold' }
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{stat.label}</div>
                    <div className={`text-3xl font-bold ${stat.color} mb-2`}>{stat.value}</div>
                    <div className="text-xs text-emerald-500 font-bold">{stat.change} Р·Р° РѕСЃС‚Р°РЅРЅС–Р№ С‚РёР¶РґРµРЅСЊ</div>
                  </div>
                ))}
              </div>

              {stats?.orderCount > 0 ? (
                <>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h3 className="text-xl font-bold mb-8">Р”РёРЅР°РјС–РєР° РїСЂРѕРґР°Р¶С–РІ</h3>
                    <div className="w-full min-w-0 overflow-x-auto">
                      <AreaChart width={chartWidth} height={300} data={stats?.salesByDay || []}>
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
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <h3 className="text-xl font-bold mb-8">РџСЂРѕРґР°Р¶С– Р·Р° РєР°С‚РµРіРѕСЂС–СЏРјРё</h3>
                      <div className="w-full min-w-0 overflow-x-auto">
                          <BarChart width={Math.min(chartWidth, 520)} height={250} data={stats?.salesByCategory || []}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                              {(stats?.salesByCategory || []).map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={['#81D8D0', '#D4AF37', '#0f172a', '#94a3b8'][index % 4]} />
                              ))}
                            </Bar>
                          </BarChart>
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <h3 className="text-xl font-bold mb-8">РћСЃС‚Р°РЅРЅС– РґС–С—</h3>
                      <div className="space-y-6">
                        {[
                          { action: 'РќРѕРІРµ Р·Р°РјРѕРІР»РµРЅРЅСЏ', user: 'РњР°СЂС–СЏ Рљ.', time: '2 С…РІ С‚РѕРјСѓ', icon: <ShoppingCart size={14} /> },
                          { action: 'РўРѕРІР°СЂ Р·Р°РєС–РЅС‡СѓС”С‚СЊСЃСЏ', user: 'Р§Р°С€РєР° "Р Р°РЅРєРѕРІР°"', time: '15 С…РІ С‚РѕРјСѓ', icon: <Package size={14} /> },
                          { action: 'Р’С–РґРіСѓРє РѕС‚СЂРёРјР°РЅРѕ', user: 'РћР»РµРЅР° Р’.', time: '1 РіРѕРґ С‚РѕРјСѓ', icon: <Star size={14} /> }
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
                  <h3 className="text-xl font-bold text-slate-900 mb-2">РќРµРјР°С” РґР°РЅРёС… РґР»СЏ Р°РЅР°Р»С–С‚РёРєРё</h3>
                  <p className="text-slate-500 max-w-md mx-auto">РЎС‚Р°С‚РёСЃС‚РёРєР° С‚Р° РіСЂР°С„С–РєРё Р·'СЏРІР»СЏС‚СЊСЃСЏ С‚СѓС‚ РїС–СЃР»СЏ С‚РѕРіРѕ, СЏРє РєР»С–С”РЅС‚Рё Р·СЂРѕР±Р»СЏС‚СЊ РїРµСЂС€С– Р·Р°РјРѕРІР»РµРЅРЅСЏ.</p>
                </div>
              )}
            </div>

          ) : activeTab === 'bonus-codes' ? (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">РџСЂРѕРјРѕРєРѕРґРё</h2>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold mb-6">РЎС‚РІРѕСЂРёС‚Рё РЅРѕРІСѓ Р°РєС†С–СЋ / РїСЂРѕРјРѕРєРѕРґ</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">РўРёРї</label>
                    <select 
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.type}
                      onChange={e => setNewBonusCode({...newBonusCode, type: e.target.value})}
                    >
                      <option value="promo">РџСЂРѕРјРѕРєРѕРґ (РґР»СЏ РєРѕС€РёРєР°)</option>
                      <option value="offer">РЎРїРµС†. РїСЂРѕРїРѕР·РёС†С–СЏ (С–РЅС„Рѕ)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Р—Р°РіРѕР»РѕРІРѕРє</label>
                    <input 
                      type="text" 
                      placeholder="200 Р±РѕРЅСѓСЃС–РІ РЅР° РїРµСЂС€Рµ Р·Р°РјРѕРІР»РµРЅРЅСЏ"
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.title}
                      onChange={e => setNewBonusCode({...newBonusCode, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">РћРїРёСЃ</label>
                    <input 
                      type="text" 
                      placeholder="Р’РёРєРѕСЂРёСЃС‚РѕРІСѓР№С‚Рµ РїСЂРё РѕС„РѕСЂРјР»РµРЅРЅС–"
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
                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Р’С–РґРѕР±СЂР°Р¶Р°С‚Рё Сѓ РІС–РєРЅС– "РђРєС†С–С— С‚Р° РЅР°Р±РѕСЂРё"</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">РљРѕРґ</label>
                    <input 
                      type="text" 
                      placeholder="SALE20"
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.code}
                      onChange={e => setNewBonusCode({...newBonusCode, code: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Р—РЅРёР¶РєР°</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.discount_amount}
                      onChange={e => setNewBonusCode({...newBonusCode, discount_amount: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">РўРёРї</label>
                    <select 
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                      value={newBonusCode.discount_type}
                      onChange={e => setNewBonusCode({...newBonusCode, discount_type: e.target.value})}
                    >
                      <option value="fixed">Р“СЂРЅ</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">РњС–РЅ. СЃСѓРјР°</label>
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
                      Р”РѕРґР°С‚Рё
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                    <tr>
                      <th className="px-8 py-4">РўРёРї</th>
                      <th className="px-8 py-4">РљРѕРґ</th>
                      <th className="px-8 py-4">Р—РЅРёР¶РєР°</th>
                      <th className="px-8 py-4">РњС–РЅ. СЃСѓРјР°</th>
                      <th className="px-8 py-4">РЎС‚Р°С‚СѓСЃ</th>
                      <th className="px-8 py-4">Р”С–С—</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bonusCodes.map(bc => (
                      <tr key={bc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${bc.type === 'offer' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                            {bc.type === 'offer' ? 'РЎРїРµС†' : 'РџСЂРѕРјРѕ'}
                          </span>
                        </td>
                        <td className="px-8 py-6 font-bold text-slate-900">{bc.code}</td>
                        <td className="px-8 py-6 text-slate-500">
                          {bc.discount_amount} {bc.discount_type === 'percent' ? '%' : 'РіСЂРЅ'}
                        </td>
                        <td className="px-8 py-6 text-slate-500">{bc.min_order_amount} РіСЂРЅ</td>
                        <td className="px-8 py-6">
                          <button 
                            onClick={() => toggleBonusCodeStatus(bc.id, bc.is_active)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${bc.is_active ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                          >
                            {bc.is_active ? 'РђРєС‚РёРІРЅРёР№' : 'РќРµР°РєС‚РёРІРЅРёР№'}
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
                <h2 className="text-2xl font-bold">РњРѕРґРµСЂР°С†С–СЏ РІС–РґРіСѓРєС–РІ</h2>
              </div>
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                    <tr>
                      <th className="px-8 py-4">РљРѕСЂРёСЃС‚СѓРІР°С‡ / РўРѕРІР°СЂ</th>
                      <th className="px-8 py-4">Р’С–РґРіСѓРє</th>
                      <th className="px-8 py-4">Р РµР№С‚РёРЅРі</th>
                      <th className="px-8 py-4">РЎС‚Р°С‚СѓСЃ</th>
                      <th className="px-8 py-4">Р”С–С—</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {reviews.map(review => (
                      <tr key={review.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="font-bold text-slate-900">{review.user_name}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-widest">РўРѕРІР°СЂ ID: {review.product_id}</div>
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
                            {review.is_approved ? 'РЎС…РІР°Р»РµРЅРѕ' : 'РћС‡С–РєСѓС”'}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex gap-3">
                            {!review.is_approved && (
                              <button 
                                onClick={() => updateReviewApproval(review.id, 1)}
                                className="text-xs font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                              >
                                РЎС…РІР°Р»РёС‚Рё
                              </button>
                            )}
                            {review.is_approved && (
                              <button 
                                onClick={() => updateReviewApproval(review.id, 0)}
                                className="text-xs font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors"
                              >
                                РџСЂРёС…РѕРІР°С‚Рё
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
                          Р’С–РґРіСѓРєС–РІ РїРѕРєРё РЅРµРјР°С”
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
                <h2 className="text-2xl font-bold">РќР°Р»Р°С€С‚СѓРІР°РЅРЅСЏ СЃР°Р№С‚Сѓ</h2>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm max-w-4xl">
                <form onSubmit={handleSettingsSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Р‘РµР·РєРѕС€С‚РѕРІРЅР° РґРѕСЃС‚Р°РІРєР° РІС–Рґ (РіСЂРЅ)</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                        value={siteSettings.free_delivery_min}
                        onChange={e => setSiteSettings({...siteSettings, free_delivery_min: Number(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Р”РЅС–РІ РЅР° РїРѕРІРµСЂРЅРµРЅРЅСЏ</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                        value={siteSettings.return_days}
                        onChange={e => setSiteSettings({...siteSettings, return_days: Number(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">РљРµС€Р±РµРє (%)</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                        value={siteSettings.cashback_percent}
                        onChange={e => setSiteSettings({...siteSettings, cashback_percent: Number(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />
                  
                  <div className="space-y-6">
                    <h3 className="font-bold text-lg">Р“РѕР»РѕРІРЅРёР№ РµРєСЂР°РЅ (Hero Section)</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Р—Р°РіРѕР»РѕРІРѕРє (H1)</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                          value={siteSettings.hero_title}
                          onChange={e => setSiteSettings({...siteSettings, hero_title: e.target.value})}
                          placeholder="Р•СЃС‚РµС‚РёС‡РЅРёР№ РїРѕСЃСѓРґ С‚Р° РґРµРєРѕСЂ РґР»СЏ РґРѕРјСѓ"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Р‘РµР№РґР¶ (Badge)</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                          value={siteSettings.hero_badge}
                          onChange={e => setSiteSettings({...siteSettings, hero_badge: e.target.value})}
                          placeholder="Р‘РµСЃС‚СЃРµР»РµСЂ СЃРµР·РѕРЅСѓ"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">РџС–РґР·Р°РіРѕР»РѕРІРѕРє</label>
                      <textarea 
                        className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany min-h-[100px]"
                        value={siteSettings.hero_subtitle}
                        onChange={e => setSiteSettings({...siteSettings, hero_subtitle: e.target.value})}
                        placeholder="РћРїРёСЃ РјР°РіР°Р·РёРЅСѓ..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">РђРєС†РµРЅС‚РЅРёР№ С‚РѕРІР°СЂ (Featured Product)</label>
                      <select 
                        className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                        value={siteSettings.hero_featured_product_id}
                        onChange={e => setSiteSettings({...siteSettings, hero_featured_product_id: e.target.value})}
                      >
                        <option value="">РћР±РµСЂС–С‚СЊ С‚РѕРІР°СЂ...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.price} РіСЂРЅ)</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 italic">Р¦РµР№ С‚РѕРІР°СЂ Р±СѓРґРµ РІС–РґРѕР±СЂР°Р¶Р°С‚РёСЃСЏ РЅР° РіРѕР»РѕРІРЅРѕРјСѓ РµРєСЂР°РЅС– Р· РјРѕР¶Р»РёРІС–СЃС‚СЋ С€РІРёРґРєРѕРіРѕ РґРѕРґР°РІР°РЅРЅСЏ РІ РєРѕС€РёРє.</p>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />
                  
                  <div className="space-y-6">
                    <h3 className="font-bold text-lg">РЎРµРєС†С–СЏ Р±РµСЃС‚СЃРµР»РµСЂС–РІ</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Р‘РµР№РґР¶ СЃРµРєС†С–С—</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                          value={siteSettings.bestsellers_badge}
                          onChange={e => setSiteSettings({...siteSettings, bestsellers_badge: e.target.value})}
                          placeholder="РќР°С€С– Р±РµСЃС‚СЃРµР»РµСЂРё"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Р—Р°РіРѕР»РѕРІРѕРє СЃРµРєС†С–С—</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                          value={siteSettings.bestsellers_title}
                          onChange={e => setSiteSettings({...siteSettings, bestsellers_title: e.target.value})}
                          placeholder="РџРѕРїСѓР»СЏСЂРЅС– С‚РѕРІР°СЂРё РґР»СЏ РІР°С€РѕРіРѕ Р·Р°С‚РёС€РєСѓ"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">РџС–РґР·Р°РіРѕР»РѕРІРѕРє СЃРµРєС†С–С—</label>
                      <textarea 
                        className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany min-h-[100px]"
                        value={siteSettings.bestsellers_subtitle}
                        onChange={e => setSiteSettings({...siteSettings, bestsellers_subtitle: e.target.value})}
                        placeholder="РћРїРёСЃ СЃРµРєС†С–С— Р±РµСЃС‚СЃРµР»РµСЂС–РІ..."
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold hover:bg-tiffany transition-all shadow-xl shadow-slate-900/10"
                  >
                    Р—Р±РµСЂРµРіС‚Рё РІСЃС– РЅР°Р»Р°С€С‚СѓРІР°РЅРЅСЏ
                  </button>
                </form>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm max-w-4xl">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">РЎС‚Р°С‚СѓСЃ Р±Р°Р·Рё РґР°РЅРёС…</h3>
                    <p className="text-sm text-slate-500">РњРѕРЅС–С‚РѕСЂРёРЅРі РїС–РґРєР»СЋС‡РµРЅРЅСЏ С‚Р° РєРІРѕС‚ Neon</p>
                  </div>
                </div>

                {isDbStatusLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-tiffany" />
                  </div>
                ) : dbStatus ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`p-6 rounded-3xl border ${dbStatus.isDegraded ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          {dbStatus.isDegraded ? (
                            <AlertTriangle className="text-amber-500" size={20} />
                          ) : (
                            <CheckCircle className="text-emerald-500" size={20} />
                          )}
                          <span className="font-bold uppercase text-xs tracking-wider">Р РµР¶РёРј СЂРѕР±РѕС‚Рё</span>
                        </div>
                        <div className={`text-xl font-bold ${dbStatus.isDegraded ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {dbStatus.isDegraded ? 'РћР±РјРµР¶РµРЅРёР№ (РљРІРѕС‚Р° РІРёС‡РµСЂРїР°РЅР°)' : 'РќРѕСЂРјР°Р»СЊРЅРёР№'}
                        </div>
                        {dbStatus.isDegraded && (
                          <p className="text-xs text-amber-600 mt-2">
                            РЎР°Р№С‚ РїСЂР°С†СЋС” РЅР° РєРµС€РѕРІР°РЅРёС… РґР°РЅРёС…. РќР°СЃС‚СѓРїРЅР° СЃРїСЂРѕР±Р° РїС–РґРєР»СЋС‡РµРЅРЅСЏ: {new Date(dbStatus.retryAt).toLocaleTimeString()}
                          </p>
                        )}
                      </div>

                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="flex items-center gap-3 mb-2 text-slate-400">
                          <Clock size={20} />
                          <span className="font-bold uppercase text-xs tracking-wider">РћСЃС‚Р°РЅРЅСЏ РїРѕРјРёР»РєР°</span>
                        </div>
                        <div className="text-xl font-bold text-slate-700">
                          {dbStatus.lastError ? new Date(dbStatus.lastError).toLocaleTimeString() : 'Р’С–РґСЃСѓС‚РЅСЏ'}
                        </div>
                        {dbStatus.lastError && (
                          <p className="text-xs text-slate-400 mt-2">
                            {new Date(dbStatus.lastError).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                          <RefreshCw className={isResettingDb ? 'animate-spin' : ''} size={24} />
                        </div>
                        <div>
                          <div className="font-bold">РЎРєРёРЅСѓС‚Рё РѕР±РјРµР¶РµРЅРЅСЏ</div>
                          <div className="text-xs opacity-60">РџСЂРёРјСѓСЃРѕРІРѕ СЃРїСЂРѕР±СѓРІР°С‚Рё РїС–РґРєР»СЋС‡РµРЅРЅСЏ РґРѕ Р‘Р”</div>
                        </div>
                      </div>
                      <button 
                        onClick={resetDbDegradedMode}
                        disabled={isResettingDb}
                        className="w-full md:w-auto px-8 py-4 bg-tiffany text-white rounded-xl font-bold hover:bg-white hover:text-slate-900 transition-all disabled:opacity-50"
                      >
                        {isResettingDb ? 'РЎРєРёРґР°РЅРЅСЏ...' : 'РЎРєРёРЅСѓС‚Рё Р·Р°СЂР°Р·'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">РќРµ РІРґР°Р»РѕСЃСЏ РѕС‚СЂРёРјР°С‚Рё СЃС‚Р°С‚СѓСЃ</div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">
                  {activeTab === 'orders' ? 'РљРµСЂСѓРІР°РЅРЅСЏ Р·Р°РјРѕРІР»РµРЅРЅСЏРјРё' : 
                   activeTab === 'users' ? 'РљРµСЂСѓРІР°РЅРЅСЏ РєРѕСЂРёСЃС‚СѓРІР°С‡Р°РјРё' : 
                   activeTab === 'categories' ? 'РљРµСЂСѓРІР°РЅРЅСЏ РєР°С‚РµРіРѕСЂС–СЏРјРё' : 'РљР°С‚Р°Р»РѕРі С‚РѕРІР°СЂС–РІ'}
                </h2>
                {activeTab === 'orders' && (
                  <button 
                    onClick={() => { setEditingOrder(null); setShowOrderModal(true); }}
                    className="bg-tiffany text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 transition-all"
                  >
                    <Plus size={20} /> РЎС‚РІРѕСЂРёС‚Рё Р·Р°РјРѕРІР»РµРЅРЅСЏ
                  </button>
                )}
                {activeTab === 'products' && (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                      <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <Filter size={12} className="inline-block mr-1" />
                        Р¤РѕС‚Рѕ
                      </span>
                      {([
                        { value: 'needs-ai', label: 'РџРѕС‚СЂС–Р±РЅС– AI', count: productImageCounts.needsAi },
                        { value: 'generated', label: 'РЈР¶Рµ Р· AI', count: productImageCounts.generated },
                        { value: 'missing', label: 'Р‘РµР· С„РѕС‚Рѕ', count: productImageCounts.missing },
                        { value: 'all', label: 'Р’СЃС–', count: productImageCounts.all }
                      ] as const).map(filter => (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => setProductImageFilter(filter.value)}
                          disabled={!!bulkImageJob}
                          className={`rounded-lg px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
                            productImageFilter === filter.value
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'bg-white text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {filter.label} <span className="ml-1 text-current opacity-60">{filter.count}</span>
                        </button>
                      ))}
                    </div>
                    {bulkImageJob && (
                      <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                        Р¤РѕС‚Рѕ: {bulkImageJob.done}/{bulkImageJob.total}
                      </div>
                    )}
                    <button
                      onClick={() => runBulkImageJob('web')}
                      disabled={!!bulkImageJob}
                      className="bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:border-tiffany hover:text-tiffany transition-all disabled:opacity-50"
                    >
                      {bulkImageJob?.type === 'web' ? <Loader2 size={18} className="animate-spin" /> : <Globe2 size={18} />}
                      Р РµР°Р»СЊРЅС– С„РѕС‚Рѕ
                    </button>
                    <button
                      onClick={() => runBulkImageJob('ai')}
                      disabled={!!bulkImageJob}
                      className="bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 transition-all disabled:opacity-50"
                    >
                      {bulkImageJob?.type === 'ai' ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                      AI-С„РѕС‚Рѕ РІРёРґРёРјРёРј
                    </button>
                    <button
                      onClick={() => {
                        setNewProductMode('bundle');
                        setEditingProduct(null);
                        setShowProductModal(true);
                      }}
                      className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-tiffany transition-all"
                    >
                      <Sparkles size={20} /> РЎС‚РІРѕСЂРёС‚Рё РЅР°Р±С–СЂ
                    </button>
                    <button 
                      onClick={() => {
                        setNewProductMode('product');
                        setEditingProduct(null);
                        setShowProductModal(true);
                      }}
                      className="bg-tiffany text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 transition-all"
                    >
                      <Plus size={20} /> Р”РѕРґР°С‚Рё С‚РѕРІР°СЂ
                    </button>
                  </div>
                )}
                {activeTab === 'categories' && (
                  <button 
                    onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                    className="bg-tiffany text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 transition-all"
                  >
                    <Plus size={20} /> Р”РѕРґР°С‚Рё РєР°С‚РµРіРѕСЂС–СЋ
                  </button>
                )}
                {activeTab === 'users' && (
                  <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-tiffany transition-all">
                    <UserPlus size={20} /> РќРѕРІРёР№ РєРѕСЂРёСЃС‚СѓРІР°С‡
                  </button>
                )}
              </div>

              {activeTab === 'products' && (
                <div className="border-b border-slate-50 bg-slate-50/60 px-6 py-5">
                  <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">РљРѕРЅС‚СЂРѕР»СЊ СЏРєРѕСЃС‚С–</div>
                      <div className="mt-1 text-sm font-semibold text-slate-600">
                        {isProductLoading
                          ? 'Р—Р°РІР°РЅС‚Р°Р¶СѓС”РјРѕ С‚РѕРІР°СЂРё С‚Р° РїРµСЂРµРІС–СЂСЏС”РјРѕ СЏРєС–СЃС‚СЊ РєР°СЂС‚РѕРє.'
                          : `РџРѕРєР°Р·Р°РЅРѕ ${visibleProducts.length} Р· ${productQualityCounts.total}. РЁРІРёРґРєРѕ РІС–РґР»РѕРІР»СЋС”РјРѕ С‚РѕРІР°СЂРё Р±РµР· С„РѕС‚Рѕ, РѕРїРёСЃСѓ, СЃРѕР±С–РІР°СЂС‚РѕСЃС‚С– Р°Р±Рѕ Р· СЂРёР·РёРєРѕРІРѕСЋ РјР°СЂР¶РµСЋ.`}
                      </div>
                    </div>
                    {productQualityFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setProductQualityFilter('all')}
                        className="w-fit rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm transition-all hover:text-slate-900"
                      >
                        РЎРєРёРЅСѓС‚Рё РєРѕРЅС‚СЂРѕР»СЊ СЏРєРѕСЃС‚С–
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {([
                      {
                        filter: 'missing-photo' as ProductQualityFilter,
                        label: 'Р‘РµР· С„РѕС‚Рѕ',
                        count: productQualityCounts.missingPhoto,
                        icon: Camera,
                        className: 'border-amber-100 bg-amber-50 text-amber-700'
                      },
                      {
                        filter: 'missing-description' as ProductQualityFilter,
                        label: 'Р‘РµР· РѕРїРёСЃСѓ',
                        count: productQualityCounts.missingDescription,
                        icon: MessageSquare,
                        className: 'border-sky-100 bg-sky-50 text-sky-700'
                      },
                      {
                        filter: 'missing-cost' as ProductQualityFilter,
                        label: 'Р‘РµР· СЃРѕР±С–РІР°СЂС‚РѕСЃС‚С–',
                        count: productQualityCounts.missingCost,
                        icon: Tag,
                        className: 'border-violet-100 bg-violet-50 text-violet-700'
                      },
                      {
                        filter: 'low-stock' as ProductQualityFilter,
                        label: 'РњР°Р»РёР№ Р·Р°Р»РёС€РѕРє',
                        count: productQualityCounts.lowStock,
                        icon: AlertTriangle,
                        className: 'border-rose-100 bg-rose-50 text-rose-700'
                      },
                      {
                        filter: 'bad-margin' as ProductQualityFilter,
                        label: 'РЎР»Р°Р±РєР° РјР°СЂР¶Р°',
                        count: productQualityCounts.badMargin,
                        icon: TrendingUp,
                        className: 'border-orange-100 bg-orange-50 text-orange-700'
                      }
                    ]).map(metric => {
                      const Icon = metric.icon;
                      const isActive = productQualityFilter === metric.filter;
                      return (
                        <button
                          key={metric.filter}
                          type="button"
                          onClick={() => {
                            setProductQualityFilter(metric.filter);
                            setProductImageFilter('all');
                          }}
                          className={`flex min-h-[92px] items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
                            isActive
                              ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                              : metric.className
                          }`}
                        >
                          <div>
                            <div className="text-2xl font-black">{metric.count}</div>
                            <div className="mt-1 text-xs font-bold uppercase tracking-widest opacity-80">{metric.label}</div>
                          </div>
                          <Icon size={22} className={isActive ? 'text-tiffany' : 'opacity-70'} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="text-sm font-black text-slate-900">РњР°СЃРѕРІС– РґС–С—</div>
                          <div className="text-xs font-semibold text-slate-400">
                            Р’РёР±СЂР°РЅРѕ {selectedProductIds.length}. РњРѕР¶РЅР° Р·РјС–РЅРёС‚Рё РєР°С‚РµРіРѕСЂС–СЋ, С†С–РЅСѓ, РїРѕРїСѓР»СЏСЂРЅС–СЃС‚СЊ Р°Р±Рѕ РѕР±СЂРѕР±РёС‚Рё С„РѕС‚Рѕ.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={toggleVisibleProductsSelection}
                          disabled={visibleProducts.length === 0 || isBulkUpdating}
                          className="w-fit rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 transition-all hover:border-tiffany hover:text-tiffany disabled:opacity-50"
                        >
                          {allVisibleProductsSelected ? 'Р—РЅСЏС‚Рё РІРёРґРёРјС–' : 'Р’РёР±СЂР°С‚Рё РІРёРґРёРјС–'}
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <select
                          value={bulkCategory}
                          onChange={(e) => setBulkCategory(e.target.value)}
                          className="min-h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 focus:border-tiffany focus:outline-none"
                        >
                          <option value="">РљР°С‚РµРіРѕСЂС–СЏ...</option>
                          {categories.map(category => (
                            <option key={category.id || category.slug} value={category.slug}>{category.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={applyBulkCategory}
                          disabled={isBulkUpdating || selectedProductIds.length === 0 || !bulkCategory}
                          className="min-h-[46px] rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition-all hover:bg-tiffany disabled:opacity-50"
                        >
                          Р—Р°СЃС‚РѕСЃСѓРІР°С‚Рё РєР°С‚РµРіРѕСЂС–СЋ
                        </button>
                        <div className="flex min-h-[46px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <input
                            type="number"
                            min={5}
                            max={85}
                            value={bulkTargetMargin}
                            onChange={(e) => setBulkTargetMargin(Number(e.target.value))}
                            className="w-full bg-transparent px-3 text-sm font-bold text-slate-700 outline-none"
                          />
                          <span className="flex items-center border-l border-slate-200 px-3 text-xs font-black text-slate-400">%</span>
                        </div>
                        <button
                          type="button"
                          onClick={applyBulkMargin}
                          disabled={isBulkUpdating || selectedProductIds.length === 0}
                          className="min-h-[46px] rounded-xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-100 disabled:opacity-50"
                        >
                          РџРµСЂРµСЂР°С…СѓРІР°С‚Рё С†С–РЅСѓ
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <select
                          value={bulkPopularMode}
                          onChange={(e) => setBulkPopularMode(e.target.value as 'popular' | 'regular')}
                          className="min-h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 focus:border-tiffany focus:outline-none"
                        >
                          <option value="popular">РџРѕРїСѓР»СЏСЂРЅРёР№</option>
                          <option value="regular">РќРµ РїРѕРїСѓР»СЏСЂРЅРёР№</option>
                        </select>
                        <button
                          type="button"
                          onClick={applyBulkPopular}
                          disabled={isBulkUpdating || selectedProductIds.length === 0}
                          className="min-h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-all hover:border-tiffany hover:text-tiffany disabled:opacity-50"
                        >
                          РћРЅРѕРІРёС‚Рё СЃС‚Р°С‚СѓСЃ
                        </button>
                        <button
                          type="button"
                          onClick={() => runBulkImageJob('web', selectedProducts)}
                          disabled={!!bulkImageJob || selectedProductIds.length === 0}
                          className="min-h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-all hover:border-tiffany hover:text-tiffany disabled:opacity-50"
                        >
                          Р¤РѕС‚Рѕ Р· РїРѕС€СѓРєСѓ
                        </button>
                        <button
                          type="button"
                          onClick={() => runBulkImageJob('ai', selectedProducts)}
                          disabled={!!bulkImageJob || selectedProductIds.length === 0}
                          className="min-h-[46px] rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition-all hover:bg-slate-900 disabled:opacity-50"
                        >
                          AI-С„РѕС‚Рѕ РІРёР±СЂР°РЅРёРј
                        </button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-tiffany/20 bg-tiffany/5 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-slate-900">Smart-РЅР°Р±С–СЂ</div>
                          <div className="text-xs font-semibold text-slate-500">
                            Р’РёРґС–Р»С–С‚СЊ 2+ С‚РѕРІР°СЂРё Р°Р±Рѕ Р·Р°Р»РёС€С‚Рµ РІРёР±С–СЂ РїСѓСЃС‚РёРј, С– СЃРёСЃС‚РµРјР° СЃР°РјР° РїС–РґР±РµСЂРµ СЃСѓРјС–СЃРЅРёР№ РєРѕРјРїР»РµРєС‚.
                          </div>
                        </div>
                        <Sparkles size={22} className="text-tiffany" />
                      </div>
                      <div className="rounded-xl bg-white/70 p-3 text-xs font-bold text-slate-500">
                        {selectedProducts.length >= 2
                          ? `Р‘СѓРґРµ СЃС‚РІРѕСЂРµРЅРѕ Р· ${selectedProducts.length} РІРёР±СЂР°РЅРёС… С‚РѕРІР°СЂС–РІ.`
                          : 'РђРІС‚РѕРїС–РґР±С–СЂ Р±РµСЂРµ С‚РѕРІР°СЂРё Р· РїРѕС‚РѕС‡РЅРѕРіРѕ С„С–Р»СЊС‚СЂР°, Р° СЏРєС‰Рѕ С‚Р°Рј РЅРµРјР°С” С„РѕС‚Рѕ вЂ” Р· СѓСЃСЊРѕРіРѕ РєР°С‚Р°Р»РѕРіСѓ.'}
                      </div>
                      <button
                        type="button"
                        onClick={createSmartBundle}
                        disabled={isCreatingSmartBundle || isBulkUpdating || products.length < 2}
                        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition-all hover:bg-tiffany disabled:opacity-50"
                      >
                        {isCreatingSmartBundle ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        РЎС‚РІРѕСЂРёС‚Рё smart-РЅР°Р±С–СЂ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                {activeTab === 'orders' ? (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                      <tr>
                        <th className="px-8 py-4">ID / Р”Р°С‚Р°</th>
                        <th className="px-8 py-4">РљР»С–С”РЅС‚ / Р”РѕСЃС‚Р°РІРєР°</th>
                        <th className="px-8 py-4">РЎСѓРјР° (Р‘РѕРЅСѓСЃРё)</th>
                        <th className="px-8 py-4">РЎС‚Р°С‚СѓСЃ</th>
                        <th className="px-8 py-4">Р”С–С—</th>
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
                              <Truck size={10} /> {getDeliveryShortLabel(getOrderDeliveryMethod(order))}, {order.customer.city}
                            </div>
                            {order.comment && (
                              <div className="mt-1 text-[10px] text-amber-600 italic">
                                РљРѕРјРµРЅС‚Р°СЂ: {order.comment}
                              </div>
                            )}
                            {order.trackingNumber && (
                              <div className="mt-1 text-[10px] text-tiffany font-bold">
                                РўРўРќ: {order.trackingNumber}
                              </div>
                            )}
                          </td>
                          <td className="px-8 py-6">
                            <div className="font-bold text-slate-900">{order.finalTotal} РіСЂРЅ</div>
                            {order.bonusUsed > 0 && <div className="text-[10px] text-gold font-bold">-{order.bonusUsed} Р±РѕРЅСѓСЃРё</div>}
                          </td>
                          <td className="px-8 py-6">
                            <select 
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              className="text-[10px] font-bold uppercase bg-slate-50 border-none rounded-full px-3 py-1 focus:ring-2 focus:ring-tiffany"
                            >
                              <option value="pending">РћС‡С–РєСѓС”</option>
                              <option value="paid">РћРїР»Р°С‡РµРЅРѕ</option>
                              <option value="shipped">Р’С–РґРїСЂР°РІР»РµРЅРѕ</option>
                              <option value="completed">Р’РёРєРѕРЅР°РЅРѕ</option>
                              <option value="cancelled">РЎРєР°СЃРѕРІР°РЅРѕ</option>
                            </select>
                          </td>
                          <td className="px-8 py-6">
                            <button 
                              onClick={() => {
                                setEditingOrder(order);
                                setShowOrderModal(true);
                              }}
                              className="text-tiffany hover:text-slate-900 font-bold text-sm"
                            >
                              Р”РµС‚Р°Р»С–
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : activeTab === 'users' ? (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                      <tr>
                        <th className="px-8 py-4">РљРѕСЂРёСЃС‚СѓРІР°С‡</th>
                        <th className="px-8 py-4">Email</th>
                        <th className="px-8 py-4">Р РѕР»СЊ</th>
                        <th className="px-8 py-4">Р‘РѕРЅСѓСЃРё / Р’РёС‚СЂР°С‡РµРЅРѕ</th>
                        <th className="px-8 py-4">Р”С–С—</th>
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
                              {u.role === 'admin' ? 'РђРґРјС–РЅ' : 'РљР»С–С”РЅС‚'}
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
                            <div className="text-xs text-slate-400">{u.total_spent || 0} РіСЂРЅ РІРёС‚СЂР°С‡РµРЅРѕ</div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex gap-3">
                              <button 
                                onClick={() => updateUserRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                                className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-tiffany transition-colors"
                              >
                                {u.role === 'admin' ? 'Р—РЅСЏС‚Рё РїСЂР°РІР°' : 'Р—СЂРѕР±РёС‚Рё Р°РґРјС–РЅРѕРј'}
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
                        <th className="px-8 py-4">РљР°С‚РµРіРѕСЂС–СЏ</th>
                        <th className="px-8 py-4">Slug</th>
                        <th className="px-8 py-4">Р”С–С—</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {categories.map(cat => (
                        <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6 flex items-center gap-4">
                          <img src={cat.image || undefined} className="w-12 h-12 rounded-lg object-cover" alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                            <div>
                              <div className="font-bold text-slate-900">{cat.name}</div>
                              {cat.parent_id && (
                                <div className="text-[10px] text-slate-400 uppercase font-bold">
                                  РџС–РґРєР°С‚РµРіРѕСЂС–СЏ: {categories.find(c => c.id === cat.parent_id)?.name}
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
                        <th className="w-14 px-8 py-4">
                          <input
                            type="checkbox"
                            checked={allVisibleProductsSelected}
                            onChange={toggleVisibleProductsSelection}
                            disabled={visibleProducts.length === 0}
                            aria-label="Р’РёР±СЂР°С‚Рё РІСЃС– РІРёРґРёРјС– С‚РѕРІР°СЂРё"
                            className="h-4 w-4 rounded border-slate-300 text-tiffany focus:ring-tiffany"
                          />
                        </th>
                        <th className="px-8 py-4">РўРѕРІР°СЂ</th>
                        <th className="px-8 py-4">РљР°С‚РµРіРѕСЂС–СЏ</th>
                        <th className="px-8 py-4">Р¦С–РЅР°</th>
                        <th className="px-8 py-4">Р”С–С—</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {isProductLoading ? (
                        <tr>
                          <td colSpan={5} className="px-8 py-12 text-center text-sm font-bold text-slate-400">
                            Р—Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ С‚РѕРІР°СЂС–РІ...
                          </td>
                        </tr>
                      ) : visibleProducts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-8 py-12 text-center text-sm font-bold text-slate-400">
                            РЈ С†СЊРѕРјСѓ С„С–Р»СЊС‚СЂС– С‚РѕРІР°СЂС–РІ РЅРµРјР°С”
                          </td>
                        </tr>
                      ) : visibleProducts.map(product => (
                        <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6 align-top">
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(product.id)}
                              onChange={() => toggleProductSelection(product.id)}
                              aria-label={`Р’РёР±СЂР°С‚Рё ${product.name}`}
                              className="mt-3 h-4 w-4 rounded border-slate-300 text-tiffany focus:ring-tiffany"
                            />
                          </td>
                          <td className="px-8 py-6 flex items-center gap-4">
                            {productHasUsablePhoto(product) ? (
                              <img
                                src={product.image}
                                className="w-12 h-12 rounded-lg object-cover"
                                alt=""
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-300">
                                <Package size={18} />
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900">{product.name}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {isBundleProduct(product) && (
                                  <span className="rounded-full bg-tiffany/10 px-2.5 py-1 text-[10px] font-bold uppercase text-tiffany">РќР°Р±С–СЂ</span>
                                )}
                                {Number(product.stock || 0) > 0 && Number(product.stock || 0) < 5 && (
                                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase text-red-500">РњР°Р»Рѕ: {product.stock}</span>
                                )}
                                {product.isPopular && (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500">РџРѕРїСѓР»СЏСЂРЅРёР№</span>
                                )}
                                {product.imageIsGenerated ? (
                                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-600">AI С„РѕС‚Рѕ</span>
                                ) : !productHasUsablePhoto(product) ? (
                                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-600">Р‘РµР· С„РѕС‚Рѕ</span>
                                ) : (
                                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase text-indigo-600">РџРѕС‚СЂС–Р±РЅРµ AI</span>
                                )}
                                {!productHasDescription(product) && (
                                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase text-sky-600">Р‘РµР· РѕРїРёСЃСѓ</span>
                                )}
                                {!productHasCostPrice(product) && (
                                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase text-violet-600">Р‘РµР· СЃРѕР±С–РІР°СЂС‚РѕСЃС‚С–</span>
                                )}
                                {productHasWeakMargin(product) && (
                                  <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase text-orange-600">РњР°СЂР¶Р° {productMarginPercent(product)}%</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-slate-500">{product.category}</td>
                          <td className="px-8 py-6">
                            <div className="font-bold text-slate-900">{product.price} РіСЂРЅ</div>
                            {productMarginPercent(product) !== null && (
                              <div className={`mt-1 text-[10px] font-bold uppercase ${productHasWeakMargin(product) ? 'text-orange-500' : 'text-emerald-500'}`}>
                                РњР°СЂР¶Р° {productMarginPercent(product)}%
                              </div>
                            )}
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex gap-3">
                              <button 
                                onClick={() => {
                                  const url = `${window.location.origin}/product/${product.id}`;
                                  navigator.clipboard.writeText(url);
                                  alert('РџРѕСЃРёР»Р°РЅРЅСЏ СЃРєРѕРїС–Р№РѕРІР°РЅРѕ!');
                                }}
                                className="p-2 text-slate-400 hover:text-gold transition-colors"
                                title="РџРѕРґС–Р»РёС‚РёСЃСЊ"
                              >
                                <Share2 size={18} />
                              </button>
                              <button 
                                onClick={() => openProductEditor(product)}
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
                        appendGalleryImages([base64]);
                      }
                    }
                  }
                }
              }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-2xl font-bold mb-8">
                {editingProduct ? 'Р РµРґР°РіСѓРІР°С‚Рё С‚РѕРІР°СЂ' : newProductMode === 'bundle' ? 'РЎС‚РІРѕСЂРёС‚Рё РЅР°Р±С–СЂ' : 'Р”РѕРґР°С‚Рё РЅРѕРІРёР№ С‚РѕРІР°СЂ'}
              </h2>
              <form ref={productFormRef} onSubmit={handleProductSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">РќР°Р·РІР°</label>
                    <input name="name" defaultValue={editingProduct?.name} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">РљР°С‚РµРіРѕСЂС–СЏ</label>
                    <select name="category" defaultValue={editingProduct?.category || categories[0]?.slug} className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany">
                      {categories.filter(c => !c.parent_id).map(parent => (
                        <React.Fragment key={parent.id}>
                          <option value={parent.slug}>{parent.name}</option>
                          {categories.filter(c => c.parent_id === parent.id).map(child => (
                            <option key={child.id} value={child.slug}>&nbsp;&nbsp;вЂ” {child.name}</option>
                          ))}
                        </React.Fragment>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Р¦С–РЅР° (РіСЂРЅ)</label>
                    <input name="price" type="number" defaultValue={editingProduct?.price} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">РЎРѕР±С–РІР°СЂС‚С–СЃС‚СЊ (РіСЂРЅ)</label>
                    <input name="cost_price" type="number" step="0.01" defaultValue={editingProduct?.cost_price} className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Р—Р°Р»РёС€РѕРє</label>
                    <input name="stock" type="number" defaultValue={editingProduct?.stock || 10} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">РњР°С‚РµСЂС–Р°Р»</label>
                    <input name="material" defaultValue={editingProduct?.material} className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Р‘СЂРµРЅРґ</label>
                    <input name="brand" defaultValue={editingProduct?.brand} className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase">Р“РѕР»РѕРІРЅРµ Р·РѕР±СЂР°Р¶РµРЅРЅСЏ</label>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleFindWebImage}
                          disabled={isSearchingWebImage}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-600 rounded-lg text-[10px] font-bold hover:text-tiffany transition-all disabled:opacity-50 border border-slate-200 shadow-sm"
                        >
                          {isSearchingWebImage ? <Loader2 size={12} className="animate-spin" /> : <Globe2 size={12} />}
                          <span>Р—РЅР°Р№С‚Рё РѕРЅР»Р°Р№РЅ</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            const { name, category } = getProductFormBasics();
                            if (name) handleAIGenerateImage(name, category);
                            else alert('Р’РІРµРґС–С‚СЊ РЅР°Р·РІСѓ С‚РѕРІР°СЂСѓ');
                          }}
                          disabled={isGeneratingAI}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-all disabled:opacity-50 border border-indigo-100 shadow-sm"
                        >
                          {isGeneratingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-indigo-500" />}
                          <span>AI Р¤РѕС‚Рѕ</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      {mainImage ? (
                        <div className="relative group">
                          <img src={mainImage || undefined} className="w-24 h-24 rounded-xl object-cover" alt="" loading="lazy" decoding="async" />
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
                          Р—Р°РІР°РЅС‚Р°Р¶РёС‚Рё С„РѕС‚Рѕ
                        </label>
                        <div className="mt-2">
                          <input 
                            placeholder="РђР±Рѕ РІСЃС‚Р°РІС‚Рµ URL / Р’СЃС‚Р°РІС‚Рµ С„РѕС‚Рѕ (Ctrl+V)"
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                            value={mainImage}
                            onChange={(e) => setMainImage(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-bold text-slate-400 uppercase">Р“Р°Р»РµСЂРµСЏ Р·РѕР±СЂР°Р¶РµРЅСЊ</label>
                      <button
                        type="button"
                        onClick={() => {
                          const { name, category } = getProductFormBasics();
                          if (name) handleAIGenerateGallery(name, category);
                          else alert('Р’РІРµРґС–С‚СЊ РЅР°Р·РІСѓ С‚РѕРІР°СЂСѓ');
                        }}
                        disabled={isGeneratingGallery}
                        className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg text-[10px] font-bold hover:bg-cyan-100 transition-all disabled:opacity-50 border border-cyan-100 shadow-sm"
                      >
                        {isGeneratingGallery ? <Loader2 size={12} className="animate-spin" /> : <Images size={12} />}
                        <span>3 AI С„РѕС‚Рѕ</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {galleryImages.map((img, idx) => (
                        <div key={idx} className="relative group aspect-square">
                          <img src={img || undefined} className="w-full h-full rounded-lg object-cover" alt="" loading="lazy" decoding="async" />
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
                            appendGalleryImages(base64s);
                          }}
                          className="hidden"
                        />
                        <Plus size={20} className="text-slate-300" />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        id="gallery-url-input"
                        placeholder="Р”РѕРґР°С‚Рё URL / Р’СЃС‚Р°РІРёС‚Рё С„РѕС‚Рѕ (Ctrl+V)"
                        className="flex-1 bg-slate-50 border-none rounded-lg p-2 text-xs focus:ring-2 focus:ring-tiffany"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.target as HTMLInputElement).value;
                            if (val) {
                              appendGalleryImages([val]);
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
                      <label className="text-xs font-bold text-slate-400 uppercase">РћРїРёСЃ</label>
                      <button 
                        type="button"
                        onClick={() => {
                          const form = productFormRef.current;
                          const name = (form?.querySelector('input[name="name"]') as HTMLInputElement)?.value;
                          const category = (form?.querySelector('select[name="category"]') as HTMLSelectElement)?.value;
                          if (name) handleAIGenerateDescription(name, category);
                          else alert('Р’РІРµРґС–С‚СЊ РЅР°Р·РІСѓ С‚РѕРІР°СЂСѓ');
                        }}
                        disabled={isGeneratingAI}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-all disabled:opacity-50 border border-emerald-100 shadow-sm"
                      >
                        {isGeneratingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-emerald-500" />}
                        <span>Р—РіРµРЅРµСЂСѓРІР°С‚Рё РѕРїРёСЃ РЁР†</span>
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
                      <label className="text-xs font-bold text-slate-400 uppercase">РџРѕСЂР°РґР° РІС–Рґ РЁР† (AI Advice)</label>
                      <button 
                        type="button"
                        onClick={() => {
                          const form = productFormRef.current;
                          const name = (form?.querySelector('input[name="name"]') as HTMLInputElement)?.value;
                          const category = (form?.querySelector('select[name="category"]') as HTMLSelectElement)?.value;
                          if (name) handleAIGenerateAdvice(name, category);
                          else alert('Р’РІРµРґС–С‚СЊ РЅР°Р·РІСѓ С‚РѕРІР°СЂСѓ');
                        }}
                        disabled={isGeneratingAdvice}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-all disabled:opacity-50 border border-emerald-100 shadow-sm"
                      >
                        {isGeneratingAdvice ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-emerald-500" />}
                        <span>Р—РіРµРЅРµСЂСѓРІР°С‚Рё РїРѕСЂР°РґСѓ РЁР†</span>
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

                {isBundle && (
                  <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-bold text-slate-400 uppercase">РўРѕРІР°СЂРё РІ РЅР°Р±РѕСЂС–</label>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button 
                          type="button"
                          onClick={() => {
                            const form = productFormRef.current;
                            const name = (form?.querySelector('input[name="name"]') as HTMLInputElement)?.value;
                            const category = (form?.querySelector('select[name="category"]') as HTMLSelectElement)?.value;
                            if (name) handleAutoGenerateBundle(name, category);
                            else alert('Р’РІРµРґС–С‚СЊ РЅР°Р·РІСѓ С‚РѕРІР°СЂСѓ');
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-tiffany/10 text-tiffany rounded-lg text-[10px] font-bold hover:bg-tiffany/15 transition-all border border-tiffany/15 shadow-sm"
                        >
                          <Package size={12} />
                          <span>РђРІС‚Рѕ-Р±Р°РЅРґР»</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            const form = productFormRef.current;
                            const name = (form?.querySelector('input[name="name"]') as HTMLInputElement)?.value;
                            const category = (form?.querySelector('select[name="category"]') as HTMLSelectElement)?.value;
                            if (name) handleAIGenerateBundle(name, category);
                            else alert('Р’РІРµРґС–С‚СЊ РЅР°Р·РІСѓ С‚РѕРІР°СЂСѓ');
                          }}
                          disabled={isGeneratingBundle}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-all disabled:opacity-50 border border-indigo-100 shadow-sm"
                        >
                          {isGeneratingBundle ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-indigo-500" />}
                          <span>РџС–РґС–Р±СЂР°С‚Рё РЁР†</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Р’РёР±СЂР°С‚Рё С‚РѕРІР°СЂРё</label>
                        <select 
                          className="w-full bg-white border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-tiffany"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && !bundleItems.includes(val)) {
                              setBundleItems(prev => [...prev, val]);
                            }
                            e.target.value = '';
                          }}
                        >
                          <option value="">Р”РѕРґР°С‚Рё С‚РѕРІР°СЂ...</option>
                          {products
                            .filter(p => p.id !== editingProduct?.id && !bundleItems.includes(p.id))
                            .map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))
                          }
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Р’РёР±СЂР°РЅС– С‚РѕРІР°СЂРё ({bundleItems.length})</label>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                          {bundleItems.length === 0 ? (
                            <div className="text-xs text-slate-400 italic">РўРѕРІР°СЂРё РЅРµ РІРёР±СЂР°РЅРѕ</div>
                          ) : (
                            <>
                              {bundleItems.map(id => {
                                const p = products.find(prod => prod.id === id);
                                return (
                                  <div key={id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-2">
                                      <img src={p?.image || undefined} className="w-8 h-8 rounded object-cover" alt="" loading="lazy" decoding="async" />
                                      <span className="text-xs font-medium truncate max-w-[150px]">{p?.name || 'РќРµРІС–РґРѕРјРёР№ С‚РѕРІР°СЂ'}</span>
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={() => setBundleItems(prev => prev.filter(item => item !== id))}
                                      className="text-red-400 hover:text-red-500 p-1"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                );
                              })}
                              <button 
                                type="button"
                                onClick={() => {
                                  const total = bundleItems.reduce((acc, id) => {
                                    const p = products.find(prod => prod.id === id);
                                    return acc + Number(p?.price || 0);
                                  }, 0);
                                  // Apply a default 15% discount for the bundle price suggestion
                                  const selectedProducts = bundleItems.map(id => products.find(prod => prod.id === id)).filter(Boolean) as any[];
                                  const discounted = selectedProducts.length > 0 ? calculateBundlePrice(selectedProducts) : Math.round(total * 0.85);
                                  const priceInput = document.querySelector('input[name="price"]') as HTMLInputElement;
                                  if (priceInput) {
                                    priceInput.value = discounted.toString();
                                  }
                                }}
                                className="w-full mt-2 text-[10px] font-bold text-tiffany hover:underline"
                              >
                                Р РѕР·СЂР°С…СѓРІР°С‚Рё С†С–РЅСѓ Р·С– Р·РЅРёР¶РєРѕСЋ 15% ({calculateBundlePrice(bundleItems.map(id => products.find(p => p.id === id)).filter(Boolean) as any[])} РіСЂРЅ)
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-3xl">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" name="isPopular" defaultChecked={editingProduct?.isPopular} className="w-5 h-5 rounded border-slate-300 text-tiffany focus:ring-tiffany" />
                    <label className="text-xs font-bold text-slate-700">РџРѕРїСѓР»СЏСЂРЅРёР№</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      name="isBundle" 
                      checked={isBundle} 
                      onChange={e => setIsBundle(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-tiffany focus:ring-tiffany" 
                    />
                    <label className="text-xs font-bold text-slate-700">РќР°Р±С–СЂ (Bundle)</label>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Р‘РѕРЅСѓСЃРЅС– Р±Р°Р»Рё</label>
                    <input name="bonusPoints" type="number" defaultValue={editingProduct?.bonusPoints || 0} className="w-full bg-white border-none rounded-lg p-2 text-xs focus:ring-2 focus:ring-tiffany" />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">РЎРєР°СЃСѓРІР°С‚Рё</button>
                  <button type="submit" className="flex-1 bg-slate-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-tiffany transition-all">Р—Р±РµСЂРµРіС‚Рё</button>
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
              <h2 className="text-2xl font-bold mb-8">{editingCategory ? 'Р РµРґР°РіСѓРІР°С‚Рё РєР°С‚РµРіРѕСЂС–СЋ' : 'Р”РѕРґР°С‚Рё РЅРѕРІСѓ РєР°С‚РµРіРѕСЂС–СЋ'}</h2>
              <form onSubmit={handleCategorySubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">РќР°Р·РІР°</label>
                  <input name="name" defaultValue={editingCategory?.name} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Slug (URL)</label>
                  <input name="slug" defaultValue={editingCategory?.slug} required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Р—РѕР±СЂР°Р¶РµРЅРЅСЏ</label>
                  <div className="flex gap-4 items-center">
                    {categoryImage && (
                      <img src={categoryImage || undefined} alt="Preview" className="w-16 h-16 rounded-xl object-cover" loading="lazy" decoding="async" />
                    )}
                    <div className="flex-1 space-y-2">
                      <input 
                        type="text"
                        value={categoryImage}
                        onChange={e => setCategoryImage(e.target.value)}
                        placeholder="URL Р·РѕР±СЂР°Р¶РµРЅРЅСЏ" 
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
                          <Upload size={18} /> Р—Р°РІР°РЅС‚Р°Р¶РёС‚Рё Р· РџРљ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Р‘Р°С‚СЊРєС–РІСЃСЊРєР° РєР°С‚РµРіРѕСЂС–СЏ</label>
                  <select 
                    name="parent_id" 
                    defaultValue={editingCategory?.parent_id || ""} 
                    className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                  >
                    <option value="">РќРµРјР°С” (РіРѕР»РѕРІРЅР°)</option>
                    {categories.filter(c => c.id !== editingCategory?.id && !c.parent_id).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowCategoryModal(false)} className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">РЎРєР°СЃСѓРІР°С‚Рё</button>
                  <button type="submit" className="flex-1 bg-slate-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-tiffany transition-all">Р—Р±РµСЂРµРіС‚Рё</button>
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
              {editingOrder ? (
                <div className="space-y-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Р—Р°РјРѕРІР»РµРЅРЅСЏ #{editingOrder.id.slice(0, 8)}</h2>
                      <p className="text-slate-500">{new Date(getOrderCreatedAt(editingOrder)).toLocaleString('uk-UA')}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${
                      editingOrder.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                      editingOrder.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {editingOrder.status === 'pending' ? 'РћС‡С–РєСѓС”' :
                       editingOrder.status === 'paid' ? 'РћРїР»Р°С‡РµРЅРѕ' :
                       editingOrder.status === 'shipped' ? 'Р’С–РґРїСЂР°РІР»РµРЅРѕ' :
                       editingOrder.status === 'completed' ? 'Р’РёРєРѕРЅР°РЅРѕ' : 'РЎРєР°СЃРѕРІР°РЅРѕ'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">РљР»С–С”РЅС‚</h3>
                      <div className="bg-slate-50 p-6 rounded-3xl space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Р†Рј'СЏ:</span>
                          <span className="font-bold">{getOrderCustomer(editingOrder).name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Email:</span>
                          <span className="font-bold">{getOrderCustomer(editingOrder).email || 'вЂ”'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">РўРµР»РµС„РѕРЅ:</span>
                          <span className="font-bold">{getOrderCustomer(editingOrder).phone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">РњС–СЃС‚Рѕ:</span>
                          <span className="font-bold">{getOrderCustomer(editingOrder).city}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Р”РѕСЃС‚Р°РІРєР° С‚Р° РѕРїР»Р°С‚Р°</h3>
                      <div className="bg-slate-50 p-6 rounded-3xl space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Р”РѕСЃС‚Р°РІРєР°:</span>
                          <span className="font-bold">{getDeliveryLabel(getOrderDeliveryMethod(editingOrder))}</span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-slate-500 shrink-0">РљСѓРґРё:</span>
                          <span className="font-bold text-right leading-snug break-words">{getOrderDeliveryDestination(editingOrder)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">РћРїР»Р°С‚Р°:</span>
                          <span className="font-bold">{getPaymentLabel(getOrderPaymentMethod(editingOrder))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Р‘РѕРЅСѓСЃРё:</span>
                          <span className="font-bold text-emerald-600">-{getOrderBonusUsed(editingOrder)} РіСЂРЅ</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">РўРѕРІР°СЂРё</h3>
                    <div className="space-y-3">
                      {editingOrder.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 p-4 rounded-2xl">
                          <div className="flex items-center gap-4">
                            <img src={item.image || undefined} className="w-12 h-12 rounded-xl object-cover" alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                            <div>
                              <div className="font-bold">{item.name}</div>
                              <div className="text-xs text-slate-400">{item.price} РіСЂРЅ Г— {item.quantity}</div>
                            </div>
                          </div>
                          <div className="font-bold">{item.price * item.quantity} РіСЂРЅ</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-8 bg-slate-900 text-white rounded-[2rem]">
                    <div>
                      <div className="text-sm opacity-60">Р Р°Р·РѕРј РґРѕ СЃРїР»Р°С‚Рё</div>
                      <div className="text-3xl font-bold">{getOrderFinalTotal(editingOrder)} РіСЂРЅ</div>
                    </div>
                    <button 
                      onClick={() => setShowOrderModal(false)}
                      className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all"
                    >
                      Р—Р°РєСЂРёС‚Рё
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-8">РЎС‚РІРѕСЂРёС‚Рё Р·Р°РјРѕРІР»РµРЅРЅСЏ РІСЂСѓС‡РЅСѓ</h2>
                  <form onSubmit={handleOrderSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Р†Рј'СЏ РєР»С–С”РЅС‚Р°</label>
                        <input name="customerName" required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                        <input name="customerEmail" type="email" className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">РўРµР»РµС„РѕРЅ</label>
                        <input name="customerPhone" required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">РњС–СЃС‚Рѕ</label>
                        <input name="customerCity" required className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">РЎРїРѕСЃС–Р± РґРѕСЃС‚Р°РІРєРё</label>
                        <select name="deliveryMethod" className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany">
                          <option value="nova-poshta">РќРѕРІР° РџРѕС€С‚Р°</option>
                          <option value="ukr-poshta">РЈРєСЂРїРѕС€С‚Р°</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">РЎРїРѕСЃС–Р± РѕРїР»Р°С‚Рё</label>
                        <select name="paymentMethod" className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany">
                          <option value="mono">Mono Pay</option>
                          <option value="liqpay">LiqPay</option>
                          <option value="card">РљР°СЂС‚Р°</option>
                          <option value="bank">РџРµСЂРµРєР°Р· РЅР° СЂР°С…СѓРЅРѕРє</option>
                          <option value="cash">РќР°РєР»Р°РґРµРЅРёР№ РїР»Р°С‚С–Р¶</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold">РўРѕРІР°СЂРё Сѓ Р·Р°РјРѕРІР»РµРЅРЅС–</h3>
                        <select 
                          onChange={(e) => {
                            if (e.target.value) {
                              addManualItem(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="bg-slate-100 border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-tiffany"
                        >
                          <option value="">Р”РѕРґР°С‚Рё С‚РѕРІР°СЂ...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} - {p.price} РіСЂРЅ</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        {manualOrderItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl">
                            <div className="flex items-center gap-4">
                              <img src={item.image || undefined} className="w-10 h-10 rounded-lg object-cover" alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                              <div>
                                <div className="font-bold text-sm">{item.name}</div>
                                <div className="text-xs text-slate-400">{item.price} РіСЂРЅ</div>
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
                            Р”РѕРґР°Р№С‚Рµ С‚РѕРІР°СЂРё РґРѕ Р·Р°РјРѕРІР»РµРЅРЅСЏ
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-6 bg-slate-900 text-white rounded-2xl">
                      <div className="text-sm font-medium opacity-70">Р—Р°РіР°Р»СЊРЅР° СЃСѓРјР°:</div>
                      <div className="text-2xl font-bold">
                        {manualOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)} РіСЂРЅ
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">РЎРєР°СЃСѓРІР°С‚Рё</button>
                      <button type="submit" disabled={manualOrderItems.length === 0} className="flex-1 bg-tiffany text-white px-6 py-4 rounded-xl font-bold hover:bg-slate-900 transition-all disabled:opacity-50">РЎС‚РІРѕСЂРёС‚Рё Р·Р°РјРѕРІР»РµРЅРЅСЏ</button>
                    </div>
                  </form>
                </>
              )}
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
              <h2 className="text-2xl font-bold mb-8">Р РµРґР°РіСѓРІР°С‚Рё Р°РєС†С–СЋ / РїСЂРѕРјРѕРєРѕРґ</h2>
              <form onSubmit={handleBonusCodeUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Р—Р°РіРѕР»РѕРІРѕРє</label>
                    <input 
                      value={editingBonusCode.title}
                      onChange={e => setEditingBonusCode({...editingBonusCode, title: e.target.value})}
                      required 
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">РћРїРёСЃ</label>
                    <input 
                      value={editingBonusCode.description}
                      onChange={e => setEditingBonusCode({...editingBonusCode, description: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">РљРѕРґ</label>
                    <input 
                      value={editingBonusCode.code}
                      onChange={e => setEditingBonusCode({...editingBonusCode, code: e.target.value.toUpperCase()})}
                      required 
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">РўРёРї Р°РєС†С–С—</label>
                    <select 
                      value={editingBonusCode.type}
                      onChange={e => setEditingBonusCode({...editingBonusCode, type: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                    >
                      <option value="promo">РџСЂРѕРјРѕРєРѕРґ (РґР»СЏ РєРѕС€РёРєР°)</option>
                      <option value="offer">РЎРїРµС†. РїСЂРѕРїРѕР·РёС†С–СЏ (С–РЅС„Рѕ)</option>
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
                  <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Р’С–РґРѕР±СЂР°Р¶Р°С‚Рё Сѓ РІС–РєРЅС– "РђРєС†С–С— С‚Р° РЅР°Р±РѕСЂРё"</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Р—РЅРёР¶РєР°</label>
                    <input 
                      type="number"
                      value={editingBonusCode.discount_amount}
                      onChange={e => setEditingBonusCode({...editingBonusCode, discount_amount: Number(e.target.value)})}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">РўРёРї Р·РЅРёР¶РєРё</label>
                    <select 
                      value={editingBonusCode.discount_type}
                      onChange={e => setEditingBonusCode({...editingBonusCode, discount_type: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany"
                    >
                      <option value="fixed">Р“СЂРЅ</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">РњС–РЅ. СЃСѓРјР°</label>
                    <input 
                      type="number"
                      value={editingBonusCode.min_order_amount}
                      onChange={e => setEditingBonusCode({...editingBonusCode, min_order_amount: Number(e.target.value)})}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany" 
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowBonusCodeModal(false)} className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">РЎРєР°СЃСѓРІР°С‚Рё</button>
                  <button type="submit" className="flex-1 bg-tiffany text-white px-6 py-4 rounded-xl font-bold hover:bg-slate-900 transition-all">Р—Р±РµСЂРµРіС‚Рё Р·РјС–РЅРё</button>
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
            <h3 className="text-2xl font-bold mb-6">Р РµРґР°РіСѓРІР°С‚Рё РІС–РґРіСѓРє</h3>
            <form onSubmit={handleReviewUpdate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">РљРѕРјРµРЅС‚Р°СЂ</label>
                <textarea 
                  value={editingReview.comment}
                  onChange={e => setEditingReview({...editingReview, comment: e.target.value})}
                  className="w-full bg-slate-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-tiffany min-h-[150px]"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Р РµР№С‚РёРЅРі</label>
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
                <button type="button" onClick={() => setShowReviewModal(false)} className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">РЎРєР°СЃСѓРІР°С‚Рё</button>
                <button type="submit" className="flex-1 bg-tiffany text-white px-6 py-4 rounded-xl font-bold hover:bg-slate-900 transition-all">Р—Р±РµСЂРµРіС‚Рё</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
