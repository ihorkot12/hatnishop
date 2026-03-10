import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { CartProvider } from './store/CartContext';
import { AuthProvider } from './store/AuthContext';
import { WishlistProvider } from './store/WishlistContext';
import { NotificationProvider } from './store/NotificationContext';
import { Navbar } from './components/Navbar';
import { ChatAssistant } from './components/ChatAssistant';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { Cart } from './pages/Cart';
import { Wishlist } from './pages/Wishlist';
import { Admin } from './pages/Admin';
import { Login } from './pages/Login';
import { SpecialOffers } from './components/SpecialOffers';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <WishlistProvider>
          <CartProvider>
          <Router>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/login" element={<Login />} />
              </Routes>
            </main>
            <SpecialOffers />
            <ChatAssistant />
          <footer className="bg-slate-900 text-white py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                <div className="col-span-1 md:col-span-2">
                  <div className="text-2xl font-bold tracking-tighter mb-6">
                    ХАТНІ <span className="text-tiffany">ШТУЧКИ</span>
                  </div>
                  <p className="text-white/50 max-w-sm leading-relaxed mb-8">
                    "Хатні Штучки" — ваш улюблений інтернет-магазин естетичного посуду та декору в Україні. Ми допомагаємо купити затишні речі, які наповнюють дім теплом та гармонією.
                  </p>
                  <div className="flex gap-4">
                    {['Instagram', 'Facebook', 'Pinterest'].map(social => (
                      <a key={social} href="#" className="text-sm font-bold uppercase tracking-widest hover:text-tiffany transition-colors">
                        {social}
                      </a>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-bold mb-6 uppercase tracking-widest text-xs text-white/30">Магазин</h4>
                  <ul className="space-y-4 text-white/70">
                    <li><Link to="/catalog" className="hover:text-white transition-colors">Весь каталог</Link></li>
                    <li><Link to="/catalog?category=kitchen" className="hover:text-white transition-colors">Кухня</Link></li>
                    <li><Link to="/catalog?category=textile" className="hover:text-white transition-colors">Текстиль</Link></li>
                    <li><Link to="/catalog?category=decor" className="hover:text-white transition-colors">Декор</Link></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold mb-6 uppercase tracking-widest text-xs text-white/30">Допомога</h4>
                  <ul className="space-y-4 text-white/70">
                    <li><a href="#" className="hover:text-white transition-colors">Доставка та оплата</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Повернення</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Про нас</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Контакти</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold mb-6 uppercase tracking-widest text-xs text-white/30">Спільнота</h4>
                  <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                    <p className="text-xs text-white/70 mb-4 leading-relaxed">
                      Підписуйтесь на наш Telegram-канал, щоб першими дізнаватись про новинки та секретні акції! 🌿
                    </p>
                    <a 
                      href="https://t.me/+gcAKeeKFKL43NjYy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-tiffany text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-white hover:text-slate-900 transition-all w-full justify-center"
                    >
                      Приєднатись до ТГ
                    </a>
                  </div>
                </div>
              </div>
              <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-white/30 text-xs">
                <div>© 2024 Хатні Штучки. Всі права захищено.</div>
                <div className="flex gap-8">
                  <a href="#" className="hover:text-white">Політика конфіденційності</a>
                  <a href="#" className="hover:text-white">Публічна оферта</a>
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
  );
}
