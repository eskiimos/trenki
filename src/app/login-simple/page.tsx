'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginSimple() {
  const router = useRouter();
  const scriptLoaded = useRef(false);

  useEffect(() => {
    // Загружаем скрипт Telegram Login Widget
    if (!scriptLoaded.current) {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', 'trenkiapp_bot');
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
        router.push('/');
      }
    };

    window.addEventListener('message', handleAuth);
    return () => window.removeEventListener('message', handleAuth);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Добро пожаловать в Trenki! 💪
          </h1>
          <p className="text-gray-600">
            Войдите через Telegram, чтобы начать тренировки
          </p>
        </div>

        <div 
          id="telegram-login-container" 
          className="flex justify-center"
        />

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Нажимая на кнопку, вы соглашаетесь с</p>
          <p>условиями использования сервиса</p>
        </div>
      </div>
    </div>
  );
}
