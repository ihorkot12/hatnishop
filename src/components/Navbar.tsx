import React, { useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingBag, Search, Menu, User, LogOut, Heart, X, Bell, BellOff, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useWishlist } from '../store/WishlistContext';
import { useNotifications } from '../store/NotificationContext';
import { TopBar } from './TopBar';

export const Navbar = () => {
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const { user, logout } = useAuth();
  const { wishlist } = useWishlist();
  const { notifications, unreadCount, markAsRead, clearNotifications, clearAllNotifications } = useNotifications();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [showCatalogMenu, setShowCatalogMenu] = useState(false);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetch('/api/categories/catalog')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setCategories(data);
        } else {
          setCategories([]);
        }
      })
      .catch(err => console.error(err));
  }, []);

  React.useEffect(() => {
    if (!showUserMenu && !showNotifMenu) return;

    const closeFloatingMenus = () => {
      setShowUserMenu(false);
      setShowNotifMenu(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const insideUserMenu = userMenuRef.current?.contains(target);
      const insideNotifMenu = notifMenuRef.current?.contains(target);
      if (!insideUserMenu && !insideNotifMenu) closeFloatingMenus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeFloatingMenus();
    };

    const autoHideTimer = window.setTimeout(closeFloatingMenus, 4500);

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', closeFloatingMenus, { passive: true });
    window.addEventListener('resize', closeFloatingMenus);

    return () => {
      window.clearTimeout(autoHideTimer);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', closeFloatingMenus);
      window.removeEventListener('resize', closeFloatingMenus);
    };
  }, [showUserMenu, showNotifMenu]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) => 
    `relative transition-all duration-300 whitespace-nowrap py-1 ${
      isActive 
        ? 'text-slate-900 after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1px] after:bg-slate-900' 
        : 'text-slate-500 hover:text-slate-900 hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[1px] hover:after:bg-slate-200'
    }`;

  const scrollToTop = (e: React.MouseEvent) => {
    if (window.location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="sticky top-0 z-50">
      {user?.isDegraded && (
        <div className="bg-amber-500 text-white py-2 px-4 text-center text-xs font-bold flex items-center justify-center gap-2">
          <AlertTriangle size={14} />
          <span>РЎР°Р№С‚ РїСЂР°С†СЋС” РІ РѕР±РјРµР¶РµРЅРѕРјСѓ СЂРµР¶РёРјС– С‡РµСЂРµР· С‚РµС…РЅС–С‡РЅС– СЂРѕР±РѕС‚Рё. Р”РµСЏРєС– С„СѓРЅРєС†С–С— РјРѕР¶СѓС‚СЊ Р±СѓС‚Рё РЅРµРґРѕСЃС‚СѓРїРЅС–.</span>
        </div>
      )}
      <TopBar />
      <nav className="bg-white/80 backdrop-blur-2xl border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-24 gap-3 min-w-0">
          <div className="flex min-w-0 flex-1 items-center gap-5 xl:gap-10">
            <Link 
              to="/" 
              onClick={scrollToTop}
              className="text-xl sm:text-2xl xl:text-3xl font-serif font-bold tracking-tight text-slate-900 hover:no-underline group shrink-0"
            >
              РҐРђРўРќР† <span className="text-[#68b8b0] italic transition-colors group-hover:text-tiffany">РЁРўРЈР§РљР</span>
            </Link>
            <div className="hidden min-w-0 flex-1 items-center justify-center gap-4 overflow-hidden text-[10px] font-bold uppercase tracking-[0.12em] lg:flex xl:gap-6 xl:text-[11px] xl:tracking-[0.15em]">
              <div 
                className="relative group"
                onMouseEnter={() => setShowCatalogMenu(true)}
                onMouseLeave={() => setShowCatalogMenu(false)}
              >
                <NavLink to="/catalog" className={navLinkClass} end>РљР°С‚Р°Р»РѕРі</NavLink>
                <AnimatePresence>
                  {showCatalogMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 w-[500px] max-w-[calc(100vw-2rem)] bg-white shadow-2xl border border-slate-100 p-8 rounded-3xl z-50 grid grid-cols-2 gap-8"
                    >
                      {categories.filter(c => !c.parent_id).map(parent => (
                        <div key={parent.id} className="space-y-4">
                          <Link 
                            to={`/catalog?category=${parent.slug}`}
                            className="text-slate-900 hover:text-tiffany transition-colors block border-b border-slate-50 pb-2"
                            onClick={() => setShowCatalogMenu(false)}
                          >
                            {parent.name}
                          </Link>
                          <div className="space-y-2">
                            {categories.filter(c => c.parent_id === parent.id).map(child => (
                              <Link 
                                key={child.id}
                                to={`/catalog?category=${child.slug}`}
                                className="text-[10px] text-slate-500 hover:text-tiffany transition-colors block normal-case font-medium"
                                onClick={() => setShowCatalogMenu(false)}
                              >
                                {child.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <NavLink to="/bundle-builder" className={navLinkClass}>
                Р—С–Р±СЂР°С‚Рё РЅР°Р±С–СЂ
              </NavLink>
              {categories.filter(c => !c.parent_id).slice(0, 3).map(cat => (
                <NavLink key={cat.id} to={`/catalog?category=${cat.slug}`} className={navLinkClass}>
                  {cat.name}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3 xl:gap-5">
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

            <div ref={notifMenuRef} className="relative hidden sm:block">
              <button 
                onClick={() => {
                  setShowNotifMenu(prev => !prev);
                  setShowUserMenu(false);
                }}
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
                    className="absolute right-0 mt-4 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 z-50 sm:w-96"
                  >
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <h3 className="font-bold text-slate-900">РЎРїРѕРІС–С‰РµРЅРЅСЏ</h3>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="text-[10px] font-bold text-tiffany uppercase tracking-widest">{unreadCount} РЅРѕРІРёС…</span>
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              await clearNotifications();
                              setShowNotifMenu(false);
                            }}
                            className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-all hover:bg-red-50 hover:text-red-500"
                          >
                            РћС‡РёСЃС‚РёС‚Рё
                          </button>
                        )}
                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm('РћС‡РёСЃС‚РёС‚Рё РІСЃС– СЃРїРѕРІС–С‰РµРЅРЅСЏ РґР»СЏ РІСЃС–С… РєРѕСЂРёСЃС‚СѓРІР°С‡С–РІ?')) return;
                              await clearAllNotifications();
                              setShowNotifMenu(false);
                            }}
                            className="rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-500 transition-all hover:bg-red-500 hover:text-white"
                          >
                            РћС‡РёСЃС‚РёС‚Рё РІСЃС–Рј
                          </button>
                        )}
                      </div>
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
                          <p className="text-slate-400 text-xs">РЈ РІР°СЃ РїРѕРєРё РЅРµРјР°С” СЃРїРѕРІС–С‰РµРЅСЊ</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link to="/cart" className="p-2 text-slate-400 hover:text-slate-900 transition-all duration-300 relative">
              <ShoppingBag size={20} strokeWidth={1.5} />
              <AnimatePresence mode="popLayout">
                {totalItems > 0 && (
                  <motion.span 
                    key={totalItems}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                    className="absolute top-0 right-0 bg-slate-900 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  >
                    {totalItems}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
            
            <div ref={userMenuRef} className="relative hidden md:block">
              {user ? (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setShowUserMenu(prev => !prev);
                      setShowNotifMenu(false);
                    }}
                    className="flex items-center gap-2 p-2 text-slate-900 hover:text-tiffany transition-all"
                  >
                    {user.avatar ? (
                      <img src={user.avatar || undefined} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
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
                        <div className="text-[10px] uppercase text-slate-400 font-bold">Р’Р°С€С– Р±РѕРЅСѓСЃРё</div>
                        <div className="text-tiffany font-bold">{user.bonuses} РіСЂРЅ</div>
                      </div>
                      {user.role === 'admin' && (
                        <Link to="/admin" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                          <User size={16} /> РђРґРјС–РЅ-РїР°РЅРµР»СЊ
                        </Link>
                      )}
                      <button 
                        onClick={() => { logout(); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <LogOut size={16} /> Р’РёР№С‚Рё
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

            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-400"
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-80 bg-white z-[70] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="text-xl font-serif font-bold text-slate-900">РњРµРЅСЋ</div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-900"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto space-y-8">
                <div className="space-y-4">
                  <div className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">РљР°С‚Р°Р»РѕРі</div>
                  <div className="grid gap-4">
                    <Link 
                      to="/catalog" 
                      className="text-lg font-bold text-slate-900 hover:text-tiffany"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Р’РµСЃСЊ РєР°С‚Р°Р»РѕРі
                    </Link>
                    <Link
                      to="/bundle-builder"
                      className="text-lg font-bold text-slate-900 hover:text-tiffany"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Р—С–Р±СЂР°С‚Рё РЅР°Р±С–СЂ
                    </Link>
                    {categories.filter(c => !c.parent_id).map(cat => (
                      <Link 
                        key={cat.id}
                        to={`/catalog?category=${cat.slug}`}
                        className="text-lg font-bold text-slate-900 hover:text-tiffany"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Р”РѕРїРѕРјРѕРіР°</div>
                  <div className="grid gap-4">
                    <Link to="/about" className="text-slate-600 hover:text-slate-900" onClick={() => setIsMobileMenuOpen(false)}>РџСЂРѕ РЅР°СЃ</Link>
                    <Link to="/faq" className="text-slate-600 hover:text-slate-900" onClick={() => setIsMobileMenuOpen(false)}>FAQ</Link>
                    <Link to="/faq" className="text-slate-600 hover:text-slate-900" onClick={() => setIsMobileMenuOpen(false)}>Р”РѕСЃС‚Р°РІРєР° С‚Р° РѕРїР»Р°С‚Р°</Link>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 mt-auto">
                {!user ? (
                  <Link 
                    to="/login" 
                    className="flex items-center justify-center gap-3 bg-slate-900 text-white py-4 rounded-2xl font-bold"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <User size={18} /> РЈРІС–Р№С‚Рё
                  </Link>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-tiffany/10 rounded-full flex items-center justify-center text-tiffany">
                      <User size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900">{user.name}</div>
                      {user.role === 'admin' && (
                        <Link
                          to="/admin"
                          className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white font-bold"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <User size={14} /> РђРґРјС–РЅ-РїР°РЅРµР»СЊ
                        </Link>
                      )}
                      <button 
                        onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                        className="mt-2 block text-xs text-red-500 font-bold"
                      >
                        Р’РёР№С‚Рё
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                placeholder="Р©Рѕ РІРё С€СѓРєР°С”С‚Рµ?"
                className="w-full bg-slate-50 border-none rounded-[2rem] pl-16 pr-8 py-6 text-xl font-serif focus:ring-2 focus:ring-tiffany transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = (e.target as HTMLInputElement).value.trim();
                    if (value) {
                      navigate(`/catalog?search=${encodeURIComponent(value)}`);
                    } else {
                      navigate('/catalog');
                    }
                    setIsSearchOpen(false);
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
