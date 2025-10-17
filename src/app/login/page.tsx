'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { saveAuth, isAuthenticated } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Проверяем, не авторизован ли пользователь уже
  useEffect(() => {
    if (isAuthenticated()) {
      console.log('User already authenticated, redirecting to home...');
      router.push('/');
    } else {
      setIsChecking(false);
    }
  }, [router]);

  // Генерируем login токен при загрузке страницы
  useEffect(() => {
    const generateToken = async () => {
      try {
        const response = await fetch('/api/auth/login-token', {
          method: 'POST',
        });
        const data = await response.json();
        if (data.token) {
          setLoginToken(data.token);
        }
      } catch (err) {
        console.error('Error generating login token:', err);
      }
    };

    if (!isChecking && !isAuthenticated()) {
      generateToken();
    }
  }, [isChecking]);

  // Polling для проверки статуса токена
  useEffect(() => {
    if (!loginToken || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/auth/login-token?token=${loginToken}`);
        const data = await response.json();

        if (data.status === 'success') {
          // Авторизация успешна!
          clearInterval(pollInterval);
          
          const telegramId = data.telegramId;
          
          // Получаем данные пользователя из БД через API
          const userResponse = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(telegramId) }),
          });
          
          if (!userResponse.ok) {
            throw new Error('Failed to fetch user data');
          }
          
          const userData = await userResponse.json();
          
          // Сохраняем авторизацию
          saveAuth({
            telegramId: telegramId,
            firstName: userData.user.firstName,
            lastName: userData.user.lastName,
            username: userData.user.username,
          });

          // Проверяем, нужен ли онбординг
          if (!userData.user?.profile?.age || !userData.user?.profile?.gender) {
            router.push('/onboarding');
          } else {
            router.push('/');
          }
        }
      } catch (err) {
        console.error('Error polling login token:', err);
      }
    }, 2000); // Проверяем каждые 2 секунды

    return () => clearInterval(pollInterval);
  }, [loginToken, isPolling, router]);

  const handleTelegramLogin = () => {
    if (!loginToken) return;
    
    // Начинаем polling
    setIsPolling(true);
    setIsLoading(true);
    
    // Открываем бота с токеном
    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'trenkibot';
    const deepLink = `https://t.me/${botUsername}?start=login_${loginToken}`;
    
    // Открываем в новом окне/вкладке
    window.open(deepLink, '_blank');
  };

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

        {/* Telegram Login Button */}
        {!isLoading ? (
          <button
            onClick={handleTelegramLogin}
            disabled={!loginToken}
            className="w-full bg-[#54A9EB] hover:bg-[#4A9AD9] disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all duration-200 transform hover:scale-105"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
            </svg>
            {loginToken ? 'Войти через Telegram' : 'Загрузка...'}
          </button>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A1FF4A] mb-4"></div>
            <p className="text-gray-400">Ожидание подтверждения в Telegram...</p>
            <p className="text-gray-500 text-sm mt-2">Откройте бота и нажмите кнопку подтверждения</p>
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded-lg">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

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
