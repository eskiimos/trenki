'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const scriptLoaded = useRef(false);
  const [isChecking, setIsChecking] = useState(true);

  // Проверяем, не авторизован ли пользователь уже
  useEffect(() => {
    if (isAuthenticated()) {
      console.log('User already authenticated, redirecting to home...');
      router.push('/');
    } else {
      setIsChecking(false);
    }
  }, [router]);

  // Загружаем Telegram Login Widget
  useEffect(() => {
    if (isChecking) return;
    
    if (!scriptLoaded.current) {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', 'trenkibot');
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '8');
      script.setAttribute('data-auth-url', 'https://trenki.vercel.app/api/auth/telegram-callback');
      script.setAttribute('data-request-access', 'write');
      script.async = true;
      
      const container = document.getElementById('telegram-login-container');
      if (container) {
        container.appendChild(script);
      }
      
      scriptLoaded.current = true;
    }

    // Слушаем успешную авторизацию
    const handleAuth = (event: MessageEvent) => {
      if (event.data.type === 'telegram-auth-success') {
        console.log('✅ Telegram auth successful!');
        // Проверяем localStorage и перенаправляем
        const userData = localStorage.getItem('telegram_user');
        if (userData) {
          router.push('/');
        }
      }
    };

    window.addEventListener('message', handleAuth);
    return () => window.removeEventListener('message', handleAuth);
  }, [router, isChecking]);

  // Показываем загрузку во время проверки авторизации
  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A1FF4A] mx-auto mb-4"></div>
          <p className="text-gray-400">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] flex flex-col items-center justify-center px-6">
      {/* Логотип */}
      <div className="mb-8 text-center">
        <h1 className="text-white text-6xl font-bold tracking-wider mb-4">
          ТРЕНЬКИ
        </h1>
        <p className="text-gray-400 text-lg">
          Цифровой мир хоккея
        </p>
      </div>

      {/* Основной контейнер */}
      <div className="w-full max-w-md bg-[#1a1f3a] rounded-2xl p-8 shadow-2xl">
        <h2 className="text-white text-2xl font-bold text-center mb-2">
          Вход в приложение
        </h2>
        <p className="text-gray-400 text-sm text-center mb-8">
          Используйте Telegram для быстрого и безопасного входа
        </p>

        {/* Telegram Login Widget */}
        <div className="flex flex-col items-center gap-4">
          <div 
            id="telegram-login-container" 
            className="flex justify-center"
          />
          
          <p className="text-gray-500 text-xs text-center max-w-sm">
            При нажатии на кнопку откроется окно Telegram для авторизации
          </p>
        </div>

        {/* Информация */}
        <div className="mt-8 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center text-[#A1FF4A] text-xl">
              ✓
            </div>
            <p className="text-gray-400 text-sm">
              Безопасная авторизация через Telegram
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center text-[#A1FF4A] text-xl">
              ✓
            </div>
            <p className="text-gray-400 text-sm">
              Не нужно запоминать пароли
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center text-[#A1FF4A] text-xl">
              ✓
            </div>
            <p className="text-gray-400 text-sm">
              Мгновенный вход в один клик
            </p>
          </div>
        </div>
      </div>

      {/* Нижний текст */}
      <div className="mt-8 text-center">
        <p className="text-gray-500 text-xs max-w-md">
          Нажимая кнопку входа, вы соглашаетесь с{' '}
          <a href="/terms" className="text-[#A1FF4A] hover:underline">
            условиями использования
          </a>
          {' '}и{' '}
          <a href="/privacy" className="text-[#A1FF4A] hover:underline">
            политикой конфиденциальности
          </a>
        </p>
      </div>
    </div>
  );
}
