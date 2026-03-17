import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../store/CartContext';

interface HeroProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  featuredProduct?: any;
}

export const Hero = ({ title, subtitle, badge, featuredProduct: propProduct }: HeroProps) => {
  const { addToCart } = useCart();
  
  // Default featured product if none provided
  const defaultProduct = {
    id: 'p1',
    name: 'Керамічна чашка "Ранкова кава"',
    price: 350,
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80',
    category: 'tableware'
  };

  const featuredProduct = propProduct || defaultProduct;

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-warm-bg">
      {/* Background Accents */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-tiffany/5 -skew-x-12 translate-x-1/4" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-tiffany/10 text-tiffany text-[10px] uppercase font-bold tracking-widest mb-8">
              <Star size={12} fill="currentColor" />
              <span>{badge || 'Бестселер сезону'}</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-serif font-bold text-slate-900 leading-[0.9] mb-8 tracking-tight">
              {title ? (
                <div dangerouslySetInnerHTML={{ __html: title.replace('декор для дому', '<span class="text-tiffany italic">декор для дому</span>') }} />
              ) : (
                <>Естетичний посуд та <span className="text-tiffany italic">декор для дому</span></>
              )}
            </h1>
            
            <p className="text-xl text-slate-500 font-light leading-relaxed mb-12 max-w-lg">
              {subtitle || 'Інтернет-магазин "Хатні Штучки" — ваш провідник у світ затишку. Купуйте кераміку, текстиль та аксесуари, які перетворюють оселю на місце сили.'}
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link 
                to="/catalog" 
                className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-tiffany transition-all flex items-center gap-3 shadow-2xl shadow-slate-900/20"
              >
                Купити для кухні <ArrowRight size={20} />
              </Link>
              <Link 
                to="/catalog?category=bundles" 
                className="px-10 py-5 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold hover:border-tiffany transition-all"
              >
                Готові набори
              </Link>
            </div>
          </motion.div>

          {/* Right Product */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            className="relative"
          >
            <div className="relative aspect-square rounded-[3rem] overflow-hidden shadow-2xl shadow-slate-900/10 group">
              <img 
                src={featuredProduct.image} 
                alt={featuredProduct.name}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              
              {/* Floating Price Tag */}
              <div className="absolute bottom-8 left-8 right-8 bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-white/20 flex justify-between items-center shadow-xl">
                <div>
                  <h3 className="text-slate-900 font-bold text-lg">{featuredProduct.name}</h3>
                  <div className="text-tiffany font-bold text-2xl">
                    {featuredProduct.price} <span className="text-sm font-normal text-slate-400">грн</span>
                  </div>
                </div>
                <button 
                  onClick={() => addToCart(featuredProduct as any)}
                  className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-tiffany transition-all shadow-lg"
                >
                  <ShoppingCart size={24} />
                </button>
              </div>
            </div>
            
            {/* 3D Parallax Accents */}
            <motion.div 
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-10 -right-10 w-32 h-32 bg-white rounded-3xl shadow-xl flex items-center justify-center border border-slate-50"
            >
              <div className="text-center">
                <div className="text-tiffany font-bold text-2xl">100%</div>
                <div className="text-[8px] uppercase font-bold text-slate-400">Кераміка</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
