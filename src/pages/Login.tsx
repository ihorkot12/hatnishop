import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, LogIn } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      navigate(-1);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-12 border border-slate-100"
      >
        <div className="text-center mb-10">
          <h2 className="text-4xl font-serif font-bold text-slate-900 mb-3">
            {isRegister ? 'Створити акаунт' : 'Вітаємо знову'}
          </h2>
          <p className="text-slate-400 font-light">
            {isRegister ? 'Приєднуйтесь до нашої родини' : 'Увійдіть у свій профіль'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-500 text-sm rounded-2xl border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {isRegister && (
            <div className="relative">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input
                type="text"
                placeholder="Ваше ім'я"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl py-5 pl-14 pr-6 text-slate-900 focus:ring-2 focus:ring-tiffany transition-all"
                required
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input
              type="email"
              placeholder="Електронна пошта"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl py-5 pl-14 pr-6 text-slate-900 focus:ring-2 focus:ring-tiffany transition-all"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl py-5 pl-14 pr-6 text-slate-900 focus:ring-2 focus:ring-tiffany transition-all"
              required
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold hover:bg-tiffany transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10"
          >
            {isRegister ? 'Зареєструватися' : 'Увійти'} <ArrowRight size={20} />
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-10">
          {isRegister ? 'Вже маєте акаунт?' : 'Ще не маєте акаунту?'}{' '}
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-tiffany font-bold hover:underline underline-offset-4"
          >
            {isRegister ? 'Увійти' : 'Створити зараз'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};
