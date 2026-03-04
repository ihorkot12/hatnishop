import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Heart, Share2, ShieldCheck, Truck, RotateCcw, Star, Send, User, Bell } from 'lucide-react';
import { MOCK_PRODUCTS } from '../constants';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useWishlist } from '../store/WishlistContext';
import { ProductCard } from '../components/ProductCard';
import { generateProductDescription } from '../services/geminiService';
import { Review } from '../types';

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

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch('/api/products');
        const products = await res.json();
        const found = products.find((p: any) => p.id === id);
        if (found) {
          setProduct(found);
          setSelectedImage(found.image);
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
      fetch('/api/subscriptions/price-drop')
        .then(res => res.json())
        .then(data => {
          setIsSubscribed(data.some((s: any) => s.product_id === product.id));
        });
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
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user && product) {
      fetch('/api/orders')
        .then(res => res.json())
        .then(orders => {
          const hasCompletedOrder = orders.some((o: any) => o.status === 'completed' || o.status === 'shipped');
          setCanReview(hasCompletedOrder);
        })
        .catch(err => console.error(err));
    }
  }, [user, product]);

  useEffect(() => {
    if (product) {
      if (product.aiDescription) {
        setAiDescription(product.aiDescription);
        setLoadingAi(false);
      } else {
        setLoadingAi(true);
        generateProductDescription(product.name, product.category).then(desc => {
          setAiDescription(desc || null);
          setLoadingAi(false);
          // Save to DB for future use
          if (desc) {
            fetch(`/api/products/${product.id}/ai-description`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ aiDescription: desc })
            });
          }
        });
      }
      fetchReviews();
    }
  }, [product]);

  const fetchReviews = async () => {
    const res = await fetch(`/api/reviews/${id}`);
    const data = await res.json();
    setReviews(data);
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

  const relatedProducts = product ? [] : []; // We'll handle this later or keep empty for now
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
        {/* Images */}
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="aspect-square rounded-[2.5rem] overflow-hidden shadow-lg border border-slate-100"
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
              className={`aspect-square rounded-2xl overflow-hidden border cursor-pointer transition-colors ${selectedImage === product.image ? 'border-tiffany' : 'border-slate-200 hover:border-tiffany'}`}
            >
              <img src={product.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            {product.images && product.images.map((img: string, i: number) => (
              <div 
                key={i} 
                onClick={() => setSelectedImage(img)}
                className={`aspect-square rounded-2xl overflow-hidden border cursor-pointer transition-colors ${selectedImage === img ? 'border-tiffany' : 'border-slate-200 hover:border-tiffany'}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <div className="flex items-center gap-4 mb-6">
            <span className="bg-tiffany/10 text-tiffany px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              {product.category}
            </span>
            <div className="flex items-center gap-1 text-gold">
              <Star size={14} fill="currentColor" />
              <span className="text-slate-900 font-bold ml-1">{averageRating}</span>
              <span className="text-slate-400 text-xs ml-2">({reviews.length} відгуків)</span>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
            {product.name}
          </h1>
          
          <div className="text-3xl font-bold text-slate-900 mb-4">
            {product.price} <span className="text-lg font-normal text-slate-500">грн</span>
          </div>

          <div className="flex items-center gap-2 mb-8">
            <div className={`w-2 h-2 rounded-full ${product.stock > 5 ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
            <span className={`text-sm font-bold uppercase tracking-widest ${product.stock > 5 ? 'text-emerald-600' : 'text-red-600'}`}>
              {product.stock > 5 ? 'В наявності' : `Залишилось лише ${product.stock} шт`}
            </span>
          </div>

          <div className="prose prose-slate mb-10">
            <p className="text-slate-600 text-lg leading-relaxed">
              {product.description}
            </p>
            {loadingAi ? (
              <div className="animate-pulse flex space-x-4 mt-4">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded"></div>
                </div>
              </div>
            ) : aiDescription && (
              <div className="mt-6 p-6 bg-tiffany/5 rounded-3xl border border-tiffany/10 italic text-slate-700">
                <p className="text-sm font-bold text-tiffany uppercase tracking-widest mb-2">Порада від Хатніх Штучок:</p>
                "{aiDescription}"
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-10">
            {product.material && (
              <div className="bg-slate-50 p-4 rounded-2xl">
                <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Матеріал</div>
                <div className="font-semibold text-slate-800">{product.material}</div>
              </div>
            )}
            {product.brand && (
              <div className="bg-slate-50 p-4 rounded-2xl">
                <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Бренд</div>
                <div className="font-semibold text-slate-800">{product.brand}</div>
              </div>
            )}
          </div>

          <div className="flex gap-4 mb-12">
            <button 
              onClick={() => addToCart(product)}
              className="flex-1 bg-slate-900 text-white h-16 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-tiffany transition-all shadow-xl shadow-slate-900/10"
            >
              <ShoppingCart size={24} /> Додати в кошик
            </button>
            <button 
              onClick={() => product && toggleWishlist(product)}
              className={`w-16 h-16 border rounded-2xl flex items-center justify-center transition-all ${isWishlisted ? 'bg-pink-50 text-pink-500 border-pink-200' : 'border-slate-200 text-slate-400 hover:text-pink-500 hover:border-pink-200'}`}
            >
              <Heart size={24} fill={isWishlisted ? "currentColor" : "none"} />
            </button>
            <button 
              onClick={toggleSubscription}
              disabled={subscribing}
              className={`w-16 h-16 border rounded-2xl flex items-center justify-center transition-all ${isSubscribed ? 'bg-tiffany/10 text-tiffany border-tiffany/20' : 'border-slate-200 text-slate-400 hover:text-tiffany hover:border-tiffany'}`}
              title={isSubscribed ? "Скасувати сповіщення про зниження ціни" : "Сповістити про зниження ціни"}
            >
              <Bell size={24} fill={isSubscribed ? "currentColor" : "none"} />
            </button>
            <button className="w-16 h-16 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-tiffany hover:border-tiffany transition-all">
              <Share2 size={24} />
            </button>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-8">
            <div className="flex items-center gap-4 text-slate-600">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-900">
                <Truck size={20} />
              </div>
              <div>
                <div className="font-bold text-sm">Швидка доставка</div>
                <div className="text-xs">Відправляємо Новою Поштою протягом 24 годин</div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-slate-600">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-900">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="font-bold text-sm">Гарантія якості</div>
                <div className="text-xs">Кожен товар перевіряється перед відправкою</div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-slate-600">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-900">
                <RotateCcw size={20} />
              </div>
              <div>
                <div className="font-bold text-sm">Повернення 14 днів</div>
                <div className="text-xs">Без зайвих питань протягом двох тижнів</div>
              </div>
            </div>

            {/* Admin Tool: Simulate Price Drop (Visible only to admins) */}
            {user?.role === 'admin' && (
              <div className="pt-8 border-t border-dashed border-slate-100">
                <button 
                  onClick={async () => {
                    const newPrice = product.price - 50;
                    try {
                      const res = await fetch(`/api/admin/products/${product.id}/price`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ newPrice }),
                      });
                      if (res.ok) {
                        setProduct({ ...product, price: newPrice });
                        alert(`Ціну знижено до ${newPrice} грн. Сповіщення підписникам надіслано!`);
                      } else {
                        const data = await res.json();
                        alert(`Помилка: ${data.error || 'Недостатньо прав'}`);
                      }
                    } catch (err) {
                      alert('Помилка з\'єднання з сервером');
                    }
                  }}
                  className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-tiffany transition-colors flex items-center gap-2"
                >
                  <span className="w-2 h-2 bg-tiffany rounded-full animate-pulse"></span>
                  Адмін: Симулювати зниження ціни (-50 грн)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Buy Together / Bundles */}
      <section className="mb-24 bg-slate-900 rounded-[3rem] p-12 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-tiffany/10 -skew-x-12 translate-x-1/4" />
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="max-w-xl">
            <div className="text-tiffany font-bold text-[10px] uppercase tracking-widest mb-4">Економія 15%</div>
            <h2 className="text-4xl font-serif font-bold mb-6">Купуйте разом з цим товаром</h2>
            <p className="text-white/60 mb-8">Ми підібрали ідеальне доповнення. Купуючи набором, ви отримуєте знижку 15% на все замовлення.</p>
            <div className="flex items-center gap-6">
              <div className="flex -space-x-4">
                <div className="w-16 h-16 rounded-full border-2 border-slate-900 overflow-hidden">
                  <img src={product.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-slate-900 overflow-hidden">
                  <img src={relatedProducts[0]?.image} alt="" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="text-2xl font-bold text-tiffany">
                {Math.floor((product.price + (relatedProducts[0]?.price || 0)) * 0.85)} грн
                <span className="text-sm text-white/40 line-through ml-2">{product.price + (relatedProducts[0]?.price || 0)} грн</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => {
              addToCart(product);
              if (relatedProducts[0]) addToCart(relatedProducts[0]);
            }}
            className="px-10 py-5 bg-tiffany text-white rounded-2xl font-bold hover:bg-white hover:text-tiffany transition-all shadow-xl shadow-tiffany/20"
          >
            Додати набір у кошик
          </button>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="mb-24">
        <div className="flex flex-col lg:flex-row gap-16">
          <div className="lg:w-1/3">
            <h2 className="text-4xl font-bold text-slate-900 mb-6">Відгуки покупців</h2>
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <div className="text-center mb-8">
                <div className="text-6xl font-bold text-slate-900 mb-2">{averageRating}</div>
                <div className="flex justify-center gap-1 text-gold mb-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={20} fill={i <= Math.round(Number(averageRating)) ? "currentColor" : "none"} />
                  ))}
                </div>
                <div className="text-slate-400 text-sm">На основі {reviews.length} відгуків</div>
              </div>

              {user ? (
                canReview ? (
                  <form onSubmit={handleReviewSubmit} className="space-y-4">
                    <div className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-widest">Залишити відгук</div>
                    {reviewMessage && (
                      <div className={`p-4 rounded-xl text-xs font-bold ${reviewMessage.includes('Помилка') ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                        {reviewMessage}
                      </div>
                    )}
                    <div className="flex gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map(i => (
                        <button 
                          key={i} 
                          type="button"
                          onClick={() => setNewReview({ ...newReview, rating: i })}
                          className={`p-1 transition-colors ${i <= newReview.rating ? 'text-gold' : 'text-slate-200'}`}
                        >
                          <Star size={24} fill="currentColor" />
                        </button>
                      ))}
                    </div>
                    <textarea 
                      placeholder="Поділіться вашими враженнями..."
                      value={newReview.comment}
                      onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-tiffany transition-all min-h-[120px]"
                      required
                    />
                    <button 
                      type="submit"
                      disabled={submittingReview}
                      className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-tiffany transition-all flex items-center justify-center gap-2"
                    >
                      {submittingReview ? 'Надсилаємо...' : 'Надіслати відгук'} <Send size={18} />
                    </button>
                  </form>
                ) : (
                  <div className="text-center p-6 bg-slate-50 rounded-2xl">
                    <p className="text-slate-500 text-sm">Ви можете залишити відгук тільки після того, як отримаєте замовлення з цим товаром.</p>
                  </div>
                )
              ) : (
                <div className="text-center p-6 bg-slate-50 rounded-2xl">
                  <p className="text-slate-500 text-sm mb-4">Увійдіть, щоб залишити відгук</p>
                  <Link to="/login" className="text-tiffany font-bold hover:underline">Увійти</Link>
                </div>
              )}
            </div>
          </div>

          <div className="lg:w-2/3 space-y-8">
            {reviews.length > 0 ? (
              reviews.map(review => (
                <motion.div 
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[2rem] p-8 border border-slate-100"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-tiffany/10 rounded-full flex items-center justify-center text-tiffany">
                        <User size={24} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{review.user_name}</div>
                        <div className="text-xs text-slate-400">{review.created_at ? new Date(review.created_at).toLocaleDateString('uk-UA') : ''}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 text-gold">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} size={14} fill={i <= review.rating ? "currentColor" : "none"} />
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed italic">
                    "{review.comment}"
                  </p>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                <p className="text-slate-400">Будьте першим, хто залишить відгук!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Related Products */}
      <section>
        <h2 className="text-3xl font-bold text-slate-900 mb-10">З цим також купують</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {relatedProducts.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
};
