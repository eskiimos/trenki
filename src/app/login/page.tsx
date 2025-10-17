'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, saveAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const scriptLoaded = useRef(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Проверяем, не авторизован ли пользователь уже
  useEffect(() => {
    if (isAuthenticated()) {
      console.log('✅ User already authenticated, redirecting...');
      router.push('/');
    } else {
      setIsChecking(false);
    }
  }, [router]);

  // Обработчик успешной авторизации
  const onTelegramAuth = async (user: any) => {
    console.log('✅ Telegram Login Widget auth:', user);
    
    try {
      // Проверяем подпись на сервере
      const response = await fetch('/api/auth/telegram-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });

      if (!response.ok) {
        throw new Error('Auth verification failed');
      }

      const data = await response.json();
      console.log('✅ Server verified auth:', data);

      // Сохраняем авторизацию
      saveAuth({
        telegramId: user.id.toString(),
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
      });

      // Просто перенаправляем на главную
      router.push('/');
    } catch (err) {
      console.error('❌ Auth error:', err);
      setError('Ошибка авторизации. Попробуйте ещё раз.');
    }
  };

  // Загружаем Telegram Login Widget
  useEffect(() => {
    if (isChecking) return;
    
    // Устанавливаем глобальный обработчик ПЕРЕД загрузкой скрипта
    (window as any).onTelegramAuth = onTelegramAuth;

    if (!scriptLoaded.current) {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', 'trenkibot');
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '8');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      script.async = true;
      
      const container = document.getElementById('telegram-login-container');
      if (container) {
        container.appendChild(script);
        scriptLoaded.current = true;
      }
    }
  }, [isChecking]);

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
            className="flex justify-center w-full"
          />
          
          {error && (
            <div className="w-full p-4 bg-red-500/20 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
          
          <div className="text-center text-xs text-gray-500 max-w-sm space-y-2">
            <p>При нажатии на кнопку откроется окно Telegram для авторизации</p>
            <p className="text-[#A1FF4A]">
              ⚠️ Если видите ошибку "Bot domain invalid", настройте домен в @BotFather
            </p>
          </div>
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
