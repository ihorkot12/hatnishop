import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ShoppingBag, Search, Menu, User, LogOut, Heart, X, Bell, BellOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useWishlist } from '../store/WishlistContext';
import { useNotifications } from '../store/NotificationContext';
import { TopBar } from './TopBar';

export const Navbar = () => {
  const { totalItems } = useCart();
  const { user, logout } = useAuth();
  const { wishlist } = useWishlist();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) => 
    `transition-all duration-300 ${isActive ? 'text-slate-900 underline underline-offset-8 decoration-slate-900 decoration-1' : 'text-slate-500 hover:text-slate-900'}`;

  const scrollToTop = (e: React.MouseEvent) => {
    if (window.location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="sticky top-0 z-50">
      <TopBar />
      <nav className="bg-white/80 backdrop-blur-2xl border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          <div className="flex items-center gap-12">
            <Link 
              to="/" 
              onClick={scrollToTop}
              className="text-3xl font-serif font-bold tracking-tight text-slate-900 hover:no-underline group"
            >
              ХАТНІ <span className="text-[#68b8b0] italic transition-colors group-hover:text-tiffany">ШТУЧКИ</span>
            </Link>
            <div className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-bold">
              <NavLink to="/catalog" className={navLinkClass} end>Каталог</NavLink>
              <NavLink to="/catalog?category=kitchen" className={navLinkClass}>Кухня</NavLink>
              <NavLink to="/catalog?category=textile" className={navLinkClass}>Текстиль</NavLink>
              <NavLink to="/catalog?category=decor" className={navLinkClass}>Декор</NavLink>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 text-slate-400 hover:text-slate-900 transition-all duration-300"
            >
              <Search size={20} strokeWidth={1.5} />
            </button>
            
            <Link to="/wishlist" className="p-2 text-slate-400 hover:text-slate-900 transition-all duration-300 relative">
              <Heart size={20} strokeWidth={1.5} />
              {wishlist.length > 0 && (
                <span className="absolute top-0 right-0 bg-pink-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </Link>

            <div className="relative">
              <button 
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="p-2 text-slate-400 hover:text-slate-900 transition-all duration-300 relative"
              >
                <Bell size={20} strokeWidth={1.5} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-tiffany text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 z-50"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-slate-900">Сповіщення</h3>
                      <span className="text-[10px] font-bold text-tiffany uppercase tracking-widest">{unreadCount} нових</span>
                    </div>
                    
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                      {notifications.length > 0 ? (
                        notifications.map(notif => (
                          <div 
                            key={notif.id} 
                            onClick={() => markAsRead(notif.id)}
                            className={`p-4 rounded-2xl transition-all cursor-pointer ${notif.is_read ? 'bg-slate-50 opacity-60' : 'bg-tiffany/5 border border-tiffany/10'}`}
                          >
                            <div className="font-bold text-sm text-slate-900 mb-1">{notif.title}</div>
                            <div className="text-xs text-slate-500 leading-relaxed">{notif.message}</div>
                            <div className="text-[8px] text-slate-300 mt-2 uppercase font-bold">{new Date(notif.created_at).toLocaleDateString('uk-UA')}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <BellOff size={32} className="mx-auto text-slate-200 mb-3" />
                          <p className="text-slate-400 text-xs">У вас поки немає сповіщень</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link to="/cart" className="p-2 text-slate-400 hover:text-slate-900 transition-all duration-300 relative">
              <ShoppingBag size={20} strokeWidth={1.5} />
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 bg-slate-900 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>
            
            <div className="relative">
              {user ? (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 p-2 text-slate-900 hover:text-tiffany transition-all"
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
                    ) : (
                      <div className="w-8 h-8 bg-tiffany/10 rounded-full flex items-center justify-center text-tiffany">
                        <User size={18} />
                      </div>
                    )}
                    <span className="text-xs font-bold hidden lg:block">{user.name}</span>
                  </button>
                  
                  {showUserMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50">
                      <div className="px-4 py-3 border-b border-slate-50 mb-2">
                        <div className="text-[10px] uppercase text-slate-400 font-bold">Ваші бонуси</div>
                        <div className="text-tiffany font-bold">{user.bonuses} грн</div>
                      </div>
                      <Link to="/admin" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                        <User size={16} /> Адмін-панель
                      </Link>
                      <button 
                        onClick={() => { logout(); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <LogOut size={16} /> Вийти
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/login" className="p-2 text-slate-400 hover:text-slate-900 transition-all duration-300">
                  <User size={20} strokeWidth={1.5} />
                </Link>
              )}
            </div>

            <button className="md:hidden p-2 text-slate-400">
              <Menu size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
      </nav>

      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 w-full bg-white/95 backdrop-blur-xl border-b border-slate-100 p-8 shadow-2xl z-40"
          >
            <div className="max-w-3xl mx-auto relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
              <input 
                autoFocus
                type="text" 
                placeholder="Що ви шукаєте?"
                className="w-full bg-slate-50 border-none rounded-[2rem] pl-16 pr-8 py-6 text-xl font-serif focus:ring-2 focus:ring-tiffany transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    window.location.href = `/catalog?search=${(e.target as HTMLInputElement).value}`;
                  }
                }}
              />
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
              >
                <X size={24} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
