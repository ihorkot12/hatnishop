import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Heart, Share2, ShieldCheck, Truck, RotateCcw, Star, Send, User, Bell, Sparkles, MessageSquare } from 'lucide-react';
import { MOCK_PRODUCTS } from '../constants';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useWishlist } from '../store/WishlistContext';
import { ProductCard } from '../components/ProductCard';
import { generateStylingTip } from '../services/aiService';
import { Review, Product } from '../types';

export const ProductDetail = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [bundleProducts, setBundleProducts] = useState<Product[]>([]);
  const [averageRating, setAverageRating] = useState('5.0');
  const [stylingTip, setStylingTip] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const [prodRes, allRes] = await Promise.all([
          fetch(`/api/products/${id}`),
          fetch('/api/products/catalog')
        ]);
        
        const found = await prodRes.json();
        const allProducts = await allRes.json();

        if (found && !found.error) {
          setProduct(found);
          setSelectedImage(found.image);
          
          // Set related products from same category
          const related = allProducts
            .filter((p: any) => p.category === found.category && p.id !== found.id)
            .slice(0, 4);
          setRelatedProducts(related);

          // Fetch bundle products if they exist
          if (found.bundle_items && found.bundle_items.length > 0) {
            const bundleItems = allProducts.filter((p: any) => found.bundle_items.includes(p.id));
            setBundleProducts(bundleItems);
          } else {
            setBundleProducts([]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const isWishlisted = product ? isInWishlist(product.id) : false;

  useEffect(() => {
    if (user && product) {
      // Check if user can review (has completed order)
      fetch('/api/orders')
        .then(res => res.json())
        .then(orders => {
          const hasCompletedOrder = orders.some((o: any) => o.status === 'completed' || o.status === 'shipped');
          setCanReview(hasCompletedOrder);
        })
        .catch(err => console.error(err));

      // Check subscription status
      fetch('/api/subscriptions/price-drop')
        .then(res => res.json())
        .then(data => {
          setIsSubscribed(data.some((s: any) => s.product_id === product.id));
        })
        .catch(err => console.error(err));
    }
  }, [user, product]);

  const toggleSubscription = async () => {
    if (!user || !product) return;
    setSubscribing(true);
    try {
      if (isSubscribed) {
        await fetch(`/api/subscriptions/price-drop/${product.id}`, { method: 'DELETE' });
        setIsSubscribed(false);
      } else {
        await fetch('/api/subscriptions/price-drop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, currentPrice: product.price }),
        });
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubscribing(false);
    }
  };

  const fetchStylingTip = async () => {
    if (!product) return;
    setLoadingAi(true);
    try {
      const tip = await generateStylingTip(product.name, product.category);
      if (tip) {
        setStylingTip(tip);
        // Save to DB for future use
        fetch(`/api/products/${product.id}/ai-description`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiDescription: tip })
        });
      }
    } catch (err) {
      console.error('Styling tip error:', err);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    if (product) {
      document.title = `${product.name} — Купити в Хатні Штучки | Ціна ${product.price} грн`;
      if (product.aiDescription) {
        setStylingTip(product.aiDescription);
        setLoadingAi(false);
      } else {
        fetchStylingTip();
      }
      fetchReviews();
    }
  }, [product]);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/reviews/${id}`);
      const data = await res.json();
      setReviews(data);
      if (data.length > 0) {
        setAverageRating((data.reduce((acc: number, r: any) => acc + r.rating, 0) / data.length).toFixed(1));
      } else {
        setAverageRating('5.0');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmittingReview(true);
    setReviewMessage(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id, ...newReview }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewReview({ rating: 5, comment: '' });
        setReviewMessage(data.message || "Відгук надіслано на модерацію");
        fetchReviews();
      } else {
        setReviewMessage(data.error || "Помилка при відправці відгуку");
      }
    } catch (err) {
      console.error(err);
      setReviewMessage("Помилка при з'єднанні з сервером");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tiffany"></div>
    </div>
  );
  if (!product) return <div className="text-center py-20">Товар не знайдено</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-12">
        <Link to="/" className="hover:text-tiffany transition-colors">Головна</Link>
        <span>/</span>
        <Link to={`/catalog?category=${product.category}`} className="hover:text-tiffany transition-colors">{product.category}</Link>
        <span>/</span>
        <span className="text-slate-900">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
        {/* Images */}
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="aspect-square rounded-[2.5rem] overflow-hidden shadow-lg border border-slate-100 bg-white"
          >
            <img 
              src={selectedImage || product.image} 
              alt={product.name} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
          <div className="grid grid-cols-4 gap-4">
            <div 
              onClick={() => setSelectedImage(product.image)}
              className={`aspect-square rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 ${selectedImage === product.image ? 'border-tiffany ring-2 ring-tiffany/20' : 'border-slate-200 hover:border-tiffany'}`}
            >
              <img src={product.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            {product.images && product.images.map((img: string, i: number) => (
              <div 
                key={i} 
                onClick={() => setSelectedImage(img)}
                className={`aspect-square rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 ${selectedImage === img ? 'border-tiffany ring-2 ring-tiffany/20' : 'border-slate-200 hover:border-tiffany'}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <span className="bg-tiffany/10 text-tiffany px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                {product.category}
              </span>
              <div className="flex items-center gap-1 text-gold">
                <Star size={14} fill="currentColor" />
                <span className="text-slate-900 font-bold ml-1">{averageRating}</span>
                <span className="text-slate-400 text-xs ml-2">({reviews.length} відгуків)</span>
              </div>
            </div>
            {product.isPopular && (
              <div className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={12} className="text-tiffany" />
                Бестселер
              </div>
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-6 leading-tight">
            {product.name}
          </h1>
          
          <div className="flex items-baseline gap-4 mb-8">
            <div className="text-4xl font-bold text-slate-900">
              {product.price} <span className="text-lg font-normal text-slate-500">грн</span>
            </div>
            {product.bonusPoints > 0 && (
              <div className="text-emerald-600 text-sm font-bold bg-emerald-50 px-3 py-1 rounded-lg">
                +{product.bonusPoints} бонусів
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-10 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className={`w-2.5 h-2.5 rounded-full ${product.stock > 5 ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
            <span className={`text-sm font-bold uppercase tracking-widest ${product.stock > 5 ? 'text-emerald-600' : 'text-red-600'}`}>
              {product.stock > 5 ? 'В наявності та готовий до відправки' : `Залишилось лише ${product.stock} шт — поспішайте!`}
            </span>
          </div>

          <div className="prose prose-slate mb-12">
            <p className="text-slate-600 text-lg leading-relaxed">
              {product.description}
            </p>

            {product.isBundle && bundleProducts.length > 0 && (
              <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-4">До цього набору входить:</h3>
                <div className="space-y-3">
                  {bundleProducts.map(p => (
                    <Link key={p.id} to={`/product/${p.id}`} className="flex items-center gap-4 p-2 hover:bg-white rounded-2xl transition-all group">
                      <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover" />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-slate-800 group-hover:text-tiffany transition-colors">{p.name}</div>
                        <div className="text-xs text-slate-400">{p.price} грн</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            
            {user?.role === 'admin' && (
              <AnimatePresence>
                {loadingAi ? (
                  <div className="animate-pulse flex space-x-4 mt-8 bg-tiffany/5 p-6 rounded-3xl border border-tiffany/10">
                    <div className="flex-1 space-y-4 py-1">
                      <div className="h-4 bg-tiffany/10 rounded w-3/4"></div>
                      <div className="h-4 bg-tiffany/10 rounded"></div>
                    </div>
                  </div>
                ) : stylingTip && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-8 bg-tiffany/5 rounded-[2.5rem] border border-tiffany/10 italic text-slate-700 relative group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-tiffany" />
                        <p className="text-xs font-bold text-tiffany uppercase tracking-widest">Порада від Хатніх Штучок (Лише для Адміна):</p>
                      </div>
                      <button 
                        onClick={fetchStylingTip}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-tiffany/10 rounded-xl text-tiffany"
                        title="Оновити пораду"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                    <p className="text-lg leading-relaxed">"{stylingTip}"</p>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-12">
            {product.material && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="text-[10px] uppercase text-slate-400 font-bold mb-2 tracking-widest">Матеріал</div>
                <div className="text-lg font-bold text-slate-800">{product.material}</div>
              </div>
            )}
            {product.brand && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="text-[10px] uppercase text-slate-400 font-bold mb-2 tracking-widest">Бренд</div>
                <div className="text-lg font-bold text-slate-800">{product.brand}</div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <button 
              onClick={() => addToCart(product)}
              className="flex-1 bg-slate-900 text-white h-20 rounded-[1.5rem] font-bold text-xl flex items-center justify-center gap-4 hover:bg-tiffany transition-all shadow-2xl shadow-slate-900/20 active:scale-95"
            >
              <ShoppingCart size={28} /> Додати в кошик
            </button>
            <div className="flex gap-4">
              <button 
                onClick={() => product && toggleWishlist(product)}
                className={`w-20 h-20 border rounded-[1.5rem] flex items-center justify-center transition-all active:scale-90 ${isWishlisted ? 'bg-pink-50 text-pink-500 border-pink-200' : 'border-slate-200 text-slate-400 hover:text-pink-500 hover:border-pink-200 hover:bg-pink-50/30'}`}
              >
                <Heart size={28} fill={isWishlisted ? "currentColor" : "none"} />
              </button>
              <button 
                onClick={toggleSubscription}
                disabled={subscribing}
                className={`w-20 h-20 border rounded-[1.5rem] flex items-center justify-center transition-all active:scale-90 ${isSubscribed ? 'bg-tiffany/10 text-tiffany border-tiffany/20' : 'border-slate-200 text-slate-400 hover:text-tiffany hover:border-tiffany hover:bg-tiffany/5'}`}
                title={isSubscribed ? "Скасувати сповіщення" : "Сповістити про знижку"}
              >
                <Bell size={28} fill={isSubscribed ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-slate-100 pt-12">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900">
                <Truck size={24} />
              </div>
              <div>
                <div className="font-bold text-xs uppercase tracking-widest mb-1">Доставка</div>
                <div className="text-[10px] text-slate-500">Від 1500 грн безкоштовно</div>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900">
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="font-bold text-xs uppercase tracking-widest mb-1">Якість</div>
                <div className="text-[10px] text-slate-500">Гарантія від виробника</div>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900">
                <RotateCcw size={24} />
              </div>
              <div>
                <div className="font-bold text-xs uppercase tracking-widest mb-1">Повернення</div>
                <div className="text-[10px] text-slate-500">14 днів на обмін</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buy Together / Bundles */}
      {(bundleProducts.length > 0 || relatedProducts.length > 0) && (
        <section className="mb-32 bg-slate-900 rounded-[4rem] p-12 md:p-20 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-tiffany/10 -skew-x-12 translate-x-1/4" />
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-16">
            <div className="max-w-xl">
              <div className="text-tiffany font-bold text-xs uppercase tracking-[0.3em] mb-6">Економія 15%</div>
              <h2 className="text-4xl md:text-5xl font-serif font-bold mb-8 leading-tight">Купуйте разом та економте</h2>
              <p className="text-white/60 text-lg mb-10 leading-relaxed">
                {bundleProducts.length > 0 
                  ? "Ми підібрали ідеальний набір для вас. Купуючи ці товари разом, ви отримуєте спеціальну знижку 15%."
                  : "Ми підібрали ідеальне доповнення до вашого вибору. Купуючи ці товари разом, ви отримуєте спеціальну знижку 15%."}
              </p>
              <div className="flex items-center gap-8">
                <div className="flex -space-x-6">
                  <div className="w-20 h-20 rounded-full border-4 border-slate-900 overflow-hidden shadow-2xl">
                    <img src={product.image} alt="" className="w-full h-full object-cover" />
                  </div>
                  {(bundleProducts.length > 0 ? bundleProducts : [relatedProducts[0]]).map((p, i) => (
                    <div key={p.id} className="w-20 h-20 rounded-full border-4 border-slate-900 overflow-hidden shadow-2xl" style={{ zIndex: 10 - i }}>
                      <img src={p.image} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-3xl font-bold text-tiffany">
                    {Math.round((Number(product.price) + (bundleProducts.length > 0 ? bundleProducts.reduce((acc, p) => acc + Number(p.price), 0) : Number(relatedProducts[0]?.price || 0))) * 0.85)} грн
                  </div>
                  <div className="text-sm text-white/40 line-through">
                    {Number(product.price) + (bundleProducts.length > 0 ? bundleProducts.reduce((acc, p) => acc + Number(p.price), 0) : Number(relatedProducts[0]?.price || 0))} грн
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={() => {
                addToCart(product);
                if (bundleProducts.length > 0) {
                  bundleProducts.forEach(p => addToCart(p));
                } else if (relatedProducts[0]) {
                  addToCart(relatedProducts[0]);
                }
              }}
              className="px-12 py-6 bg-tiffany text-white rounded-2xl font-bold text-lg hover:bg-white hover:text-tiffany transition-all shadow-2xl shadow-tiffany/20 active:scale-95"
            >
              Додати набір у кошик
            </button>
          </div>
        </section>
      )}

      {/* Reviews Section */}
      <section className="mb-32">
        <div className="flex flex-col lg:flex-row gap-20">
          <div className="lg:w-1/3">
            <h2 className="text-4xl font-serif font-bold text-slate-900 mb-8">Відгуки</h2>
            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
              <div className="text-center mb-10">
                <div className="text-7xl font-bold text-slate-900 mb-4">{averageRating}</div>
                <div className="flex justify-center gap-1.5 text-gold mb-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={24} fill={i <= Math.round(Number(averageRating)) ? "currentColor" : "none"} />
                  ))}
                </div>
                <div className="text-slate-400 font-bold text-xs uppercase tracking-widest">На основі {reviews.length} відгуків</div>
              </div>

              {user ? (
                canReview ? (
                  <form onSubmit={handleReviewSubmit} className="space-y-6">
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">Ваш відгук</div>
                    {reviewMessage && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className={`p-4 rounded-2xl text-xs font-bold ${reviewMessage.includes('Помилка') ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}
                      >
                        {reviewMessage}
                      </motion.div>
                    )}
                    <div className="flex gap-2 justify-center py-2">
                      {[1, 2, 3, 4, 5].map(i => (
                        <button 
                          key={i} 
                          type="button"
                          onClick={() => setNewReview({ ...newReview, rating: i })}
                          className={`p-1 transition-all hover:scale-125 ${i <= newReview.rating ? 'text-gold' : 'text-slate-200'}`}
                        >
                          <Star size={32} fill="currentColor" />
                        </button>
                      ))}
                    </div>
                    <textarea 
                      placeholder="Поділіться вашими враженнями про товар..."
                      value={newReview.comment}
                      onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-[1.5rem] p-6 text-sm focus:ring-2 focus:ring-tiffany transition-all min-h-[150px] resize-none"
                      required
                    />
                    <button 
                      type="submit"
                      disabled={submittingReview}
                      className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold hover:bg-tiffany transition-all flex items-center justify-center gap-3 shadow-lg"
                    >
                      {submittingReview ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                      <span>Надіслати відгук</span>
                    </button>
                  </form>
                ) : (
                  <div className="text-center p-8 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                    <p className="text-slate-500 text-sm leading-relaxed">Ви зможете залишити відгук після того, як отримаєте замовлення з цим товаром. Це гарантує чесність відгуків.</p>
                  </div>
                )
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                  <p className="text-slate-500 text-sm mb-6">Увійдіть у свій акаунт, щоб поділитися враженнями</p>
                  <Link to="/login" className="inline-block bg-white text-slate-900 px-8 py-3 rounded-xl font-bold border border-slate-200 hover:bg-tiffany hover:text-white hover:border-tiffany transition-all">Увійти</Link>
                </div>
              )}
            </div>
          </div>

          <div className="lg:w-2/3 space-y-8">
            {reviews.length > 0 ? (
              reviews.map(review => (
                <motion.div 
                  key={review.id}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                        <User size={28} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-lg">{review.user_name}</div>
                        <div className="text-xs text-slate-400 font-medium uppercase tracking-widest">{review.created_at ? new Date(review.created_at).toLocaleDateString('uk-UA') : ''}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 text-gold">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} size={16} fill={i <= review.rating ? "currentColor" : "none"} />
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-lg italic">
                    "{review.comment}"
                  </p>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-32 bg-slate-50 rounded-[4rem] border border-dashed border-slate-200">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                  <MessageSquare size={40} />
                </div>
                <p className="text-slate-400 font-medium">Ще немає жодного відгуку. Будьте першим!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="text-tiffany font-bold text-xs uppercase tracking-[0.3em] mb-4">Вам також сподобається</div>
              <h2 className="text-4xl font-serif font-bold text-slate-900">Схожі товари</h2>
            </div>
            <Link to="/catalog" className="text-sm font-bold text-slate-400 hover:text-tiffany transition-colors uppercase tracking-widest">Дивитись все</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {relatedProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
  <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
