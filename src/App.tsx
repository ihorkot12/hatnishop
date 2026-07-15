import { Suspense, lazy, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { BrowserRouter as Router, Link, Route, Routes, useLocation } from 'react-router-dom';
import { CartProvider } from './store/CartContext';
import { AuthProvider } from './store/AuthContext';
import { WishlistProvider } from './store/WishlistContext';
import { NotificationProvider } from './store/NotificationContext';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { SpecialOffers } from './components/SpecialOffers';

// Home is kept eager (it's the landing route); every other route is
// code-split so the initial bundle only ships what the entry page needs.
const Catalog = lazy(() => import('./pages/Catalog').then((module) => ({ default: module.Catalog })));
const ProductDetail = lazy(() => import('./pages/ProductDetail').then((module) => ({ default: module.ProductDetail })));
const Cart = lazy(() => import('./pages/Cart').then((module) => ({ default: module.Cart })));
const BundleBuilder = lazy(() => import('./pages/BundleBuilder').then((module) => ({ default: module.BundleBuilder })));
const Wishlist = lazy(() => import('./pages/Wishlist').then((module) => ({ default: module.Wishlist })));
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })));
const AboutUs = lazy(() => import('./pages/AboutUs').then((module) => ({ default: module.AboutUs })));
const FAQ = lazy(() => import('./pages/FAQ').then((module) => ({ default: module.FAQ })));
const Admin = lazy(() => import('./pages/Admin').then((module) => ({ default: module.Admin })));

const RouteFallback = () => (
  <div className="mx-auto min-h-[60vh] max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
    <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
    <div className="mt-4 h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
    <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map(index => (
        <div key={index} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="aspect-[4/5] animate-pulse bg-slate-100" />
          <div className="space-y-2 p-5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Скролимо на початок сторінки при кожній зміні маршруту. Без цього перехід
// (наприклад, клік по товару на головній або вхід у каталог) залишав сторінку
// прокрученою донизу — виглядало так, ніби «нічого не відкрилось».
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    // 'auto', а не 'smooth': на переході між сторінками потрібне миттєве
    // повернення вгору, а не плавна прокрутка через увесь контент.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
};

// Свідомо БЕЗ AnimatePresence-переходів між роутами: у зв'язці з lazy-роутами
// (mode="wait" + Suspense) нова сторінка не монтувалася — при зміні URL показувався
// контент попередньої сторінки. Косметика не варта зламаної навігації.
// Плавність натомість дають entrance-анімації всередині самих сторінок.
const AppRoutes = () => (
  <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/catalog" element={<Catalog />} />
      <Route path="/bundle-builder" element={<BundleBuilder />} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/wishlist" element={<Wishlist />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/login" element={<Login />} />
      <Route path="/about" element={<AboutUs />} />
      <Route path="/faq" element={<FAQ />} />
    </Routes>
  </Suspense>
);

// Плаваючий віджет акцій показуємо лише там, де користувач обирає товари,
// і не відволікаємо в кошику, профілі чи адмінці.
const FloatingOffers = () => {
  const { pathname } = useLocation();
  const isShoppingRoute = pathname === '/' || pathname === '/catalog' || pathname.startsWith('/product/');
  return isShoppingRoute ? <SpecialOffers /> : null;
};

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
    <AuthProvider>
      <NotificationProvider>
        <WishlistProvider>
          <CartProvider>
            <Router>
              <ScrollToTop />
              <div className="flex min-h-screen flex-col">
                <Navbar />
                <main className="flex-grow">
                  <AppRoutes />
                </main>

                <FloatingOffers />

                <footer className="bg-slate-950 py-16 text-white">
                  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-10 border-b border-white/10 pb-12 md:grid-cols-4">
                      <div className="md:col-span-2">
                        <div className="mb-5 text-2xl font-serif font-bold tracking-normal">
                          ХАТНІ <span className="italic text-tiffany">ШТУЧКИ</span>
                        </div>
                        <p className="mb-7 max-w-md leading-7 text-white/55">
                          Естетичний посуд, текстиль і декор для дому, де речі виглядають зібраними, корисними і теплими.
                        </p>
                        <div className="flex flex-wrap gap-4">
                          {['Instagram', 'Facebook', 'Pinterest'].map((social) => (
                            <a key={social} href="#" className="text-xs font-bold uppercase text-white/45 transition-colors hover:text-tiffany hover:no-underline">
                              {social}
                            </a>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-5 text-xs font-bold uppercase text-white/35">Магазин</h4>
                        <ul className="space-y-4 text-white/70">
                          <li><Link to="/catalog" className="transition-colors hover:text-white hover:no-underline">Весь каталог</Link></li>
                          <li><Link to="/catalog?category=kitchen" className="transition-colors hover:text-white hover:no-underline">Кухня</Link></li>
                          <li><Link to="/catalog?category=textile" className="transition-colors hover:text-white hover:no-underline">Текстиль</Link></li>
                          <li><Link to="/catalog?category=decor" className="transition-colors hover:text-white hover:no-underline">Декор</Link></li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="mb-5 text-xs font-bold uppercase text-white/35">Допомога</h4>
                        <ul className="space-y-4 text-white/70">
                          <li><Link to="/faq" className="transition-colors hover:text-white hover:no-underline">Доставка та оплата</Link></li>
                          <li><Link to="/faq" className="transition-colors hover:text-white hover:no-underline">Повернення</Link></li>
                          <li><Link to="/about" className="transition-colors hover:text-white hover:no-underline">Про нас</Link></li>
                          <li>
                            <a href="https://t.me/+gcAKeeKFKL43NjYy" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white hover:no-underline">
                              Telegram
                            </a>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-white/35 md:flex-row">
                      <div>© 2026 Хатні Штучки. Всі права захищено.</div>
                      <div className="flex gap-8">
                        <a href="#" className="hover:text-white hover:no-underline">Політика конфіденційності</a>
                        <a href="#" className="hover:text-white hover:no-underline">Публічна оферта</a>
                      </div>
                    </div>
                  </div>
                </footer>
              </div>
            </Router>
          </CartProvider>
        </WishlistProvider>
      </NotificationProvider>
    </AuthProvider>
    </MotionConfig>
  );
}
