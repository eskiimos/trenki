'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, saveAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginToken, setLoginToken] = useState<string | null>(null);

  // Создаем токен для входа
  const createLoginToken = async () => {
    try {
      console.log('📡 Creating login token...');
      
      const response = await fetch('/api/auth/create-login-token', {
        method: 'POST',
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to create token:', errorText);
        throw new Error('Failed to create login token');
      }

      const data = await response.json();
      console.log('✅ Token created:', data.token);
      return data.token;
    } catch (err) {
      console.error('❌ Error creating login token:', err);
      throw err;
    }
  };

  // Проверяем статус токена
  const checkLoginStatus = async (token: string) => {
    try {
      const response = await fetch(`/api/auth/check-login-token?token=${token}`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data.authenticated && data.user) {
        console.log('✅ Authentication successful!');
        
        // Очищаем сохраненный токен
        localStorage.removeItem('pendingLoginToken');
        
        // Сохраняем авторизацию (включая cookie)
        saveAuth({
          telegramId: data.user.telegramId,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          username: data.user.username,
        });

        console.log('🔄 Redirecting to:', data.needsOnboarding ? '/onboarding' : '/');

        // Используем агрессивный редирект через window.location для гарантии
        setTimeout(() => {
          if (data.needsOnboarding) {
            window.location.href = '/onboarding';
          } else {
            window.location.href = '/';
          }
        }, 100);
        
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Error checking login status:', err);
      return null;
    }
  };

  // Функция для возобновления проверки при возврате в приложение
  const resumeLoginCheck = (token: string) => {
    console.log('🔄 Resuming login check for token:', token);
    
    let attempts = 0;
    const maxAttempts = 150; // 150 попыток * 2 секунды = 5 минут
    
    // Начинаем проверять статус каждые 2 секунды
    const intervalId = setInterval(async () => {
      attempts++;
      const authenticated = await checkLoginStatus(token);
      
      if (authenticated) {
        console.log('✅ Authentication successful!');
        clearInterval(intervalId);
        setIsLoggingIn(false);
      } else if (authenticated === null) {
        // Ошибка или токен не найден - прекращаем
        console.log('❌ Token invalid or expired, stopping check');
        clearInterval(intervalId);
        setIsLoggingIn(false);
        localStorage.removeItem('pendingLoginToken');
        setError('Токен истек. Попробуйте войти снова.');
      } else if (attempts >= maxAttempts) {
        // Достигли максимального количества попыток
        console.log('⏰ Max attempts reached');
        clearInterval(intervalId);
        setIsLoggingIn(false);
        localStorage.removeItem('pendingLoginToken');
        setError('Время ожидания истекло. Попробуйте снова.');
      }
    }, 2000);
  };

  // Проверяем, не авторизован ли пользователь уже
  useEffect(() => {
    console.log('🚀 LoginPage useEffect started');
    console.log('📊 Initial state:', { isChecking, isLoggingIn });
    
    const checkAuthAndToken = () => {
      const authStatus = isAuthenticated();
      console.log('🔐 isAuthenticated():', authStatus);
      
      if (authStatus) {
        console.log('✅ User already authenticated, redirecting to /...');
        router.push('/');
        return true;
      }
      
      // Проверяем, есть ли активный токен в localStorage
      const savedToken = localStorage.getItem('pendingLoginToken');
      console.log('🗂️ Saved token in localStorage:', savedToken ? 'EXISTS' : 'NOT FOUND');
      
      if (savedToken) {
        console.log('🔄 Found pending login token, resuming authentication...');
        setLoginToken(savedToken);
        setIsLoggingIn(true);
        setIsChecking(false); // Важно! Убираем экран проверки авторизации
        resumeLoginCheck(savedToken);
      } else {
        console.log('✅ No pending token, showing login form');
        setIsChecking(false);
      }
      
      return false;
    };
    
    // Проверяем при загрузке
    checkAuthAndToken();
    
    // Слушаем событие возврата в приложение (когда пользователь переключается обратно на вкладку)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👀 App became visible, checking auth status...');
        checkAuthAndToken();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  // Обработчик входа через Telegram
  const handleTelegramLogin = async () => {
    setIsLoggingIn(true);
    setError(null);

    try {
      // Создаем токен
      const token = await createLoginToken();
      setLoginToken(token);
      
      // Сохраняем токен в localStorage для продолжения проверки после возврата
      localStorage.setItem('pendingLoginToken', token);

      console.log('🔑 Login token created:', token);

      // Открываем бота с токеном в новой вкладке
      const botUrl = `https://t.me/trenkiapp_bot?start=${token}`;
      
      console.log('🤖 Opening bot URL in new tab:', botUrl);
      
      // ВСЕГДА открываем в новой вкладке через createElement
      // Это работает и в PWA, и в обычном браузере
      const link = document.createElement('a');
      link.href = botUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ Link clicked, starting polling...');
      
      // Запускаем polling - при возврате продолжим проверку
      resumeLoginCheck(token);

    } catch (err) {
      console.error('Login error:', err);
      setError('Ошибка входа. Попробуйте снова.');
      setIsLoggingIn(false);
      localStorage.removeItem('pendingLoginToken');
    }
  };

  // Показываем загрузку во время проверки авторизации
  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#101530] flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A1FF4A] mx-auto mb-4"></div>
          <p className="text-gray-400">Проверка авторизации...</p>
        </div>
        
        {/* Кнопка для отладки - если застряло */}
        <button
          onClick={() => {
            console.log('🔄 Manual reset triggered');
            localStorage.removeItem('pendingLoginToken');
            localStorage.removeItem('telegramId');
            setIsChecking(false);
            setIsLoggingIn(false);
            setError(null);
          }}
          className="text-gray-500 text-sm hover:text-white transition-colors"
        >
          Сбросить состояние
        </button>
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

        {/* Кнопка входа через Telegram */}
        <div className="flex flex-col items-center gap-4">
          {!isLoggingIn ? (
            <>
              <button
                onClick={handleTelegramLogin}
                className="w-full bg-[#0088cc] hover:bg-[#006699] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.73-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.38-.48.9-.72 3.55-1.55 5.93-2.57 7.14-3.07 3.4-1.42 4.1-1.67 4.57-1.67.1 0 .33.02.48.14.12.1.15.24.17.34-.01.1.01.24 0 .35z"/>
                </svg>
                Вход через Telegram
              </button>
              
              {/* Dev-кнопка для localhost */}
              {typeof window !== 'undefined' && 
                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                <button
                  onClick={() => {
                    console.log('🔓 Dev mode: bypassing authentication');
                    // Создаём фейковые данные для разработки
                    saveAuth({
                      telegramId: 'dev_user_' + Date.now(),
                      firstName: 'Dev',
                      lastName: 'User',
                      username: 'dev_user',
                    });
                    window.location.href = '/';
                  }}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  🔓 Dev: Войти без Telegram
                </button>
              )}
            </>
          ) : (
            <button
              disabled
              className="w-full bg-gray-600 cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3"
            >
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Ожидание подтверждения...
            </button>
          )}

          {isLoggingIn && loginToken && (
            <div className="w-full space-y-3">
              <div className="p-6 bg-[#0A0E1A] border border-[#A1FF4A] rounded-xl">
                <div className="flex items-center gap-4 mb-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A1FF4A]"></div>
                  <div className="flex-1">
                    <p className="text-white font-medium mb-1">
                      Откройте Telegram
                    </p>
                    <p className="text-gray-400 text-sm">
                      Нажмите "Старт" в боте для подтверждения входа
                    </p>
                  </div>
                </div>
                
                {/* Ссылка для ручного открытия */}
                <a
                  href={`https://t.me/trenkiapp_bot?start=${loginToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-2 px-4 bg-[#0088cc] hover:bg-[#006699] text-white text-sm rounded-lg transition-colors"
                >
                  Или откройте бота вручную
                </a>
              </div>
              
              {/* Кнопка отмены */}
              <button
                onClick={() => {
                  setIsLoggingIn(false);
                  setLoginToken(null);
                  localStorage.removeItem('pendingLoginToken');
                  setError(null);
                }}
                className="w-full py-3 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Отменить
              </button>
            </div>
          )}
          
          {error && (
            <div className="w-full p-4 bg-red-500/20 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
        </div>

        {/* Информация */}
        <div className="mt-8 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center text-[#A1FF4A] text-xl">
              ✓
            </div>
            <p className="text-gray-400 text-sm">
              Безопасная авторизация через Telegram бота
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center text-[#A1FF4A] text-xl">
              ✓
            </div>
            <p className="text-gray-400 text-sm">
              Автоматическая регистрация при первом входе
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center text-[#A1FF4A] text-xl">
              ✓
            </div>
            <p className="text-gray-400 text-sm">
              Email в формате {`{ваш_id}@t.me`} создается автоматически
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
