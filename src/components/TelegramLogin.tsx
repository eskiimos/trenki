'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface TelegramLoginProps {
  botUsername: string; // Имя бота (без @)
  onAuth: (user: TelegramAuthData) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  requestAccess?: boolean;
  usePic?: boolean;
  dataAuthUrl?: string;
}

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthData) => void;
  }
}

export default function TelegramLogin({
  botUsername,
  onAuth,
  buttonSize = 'large',
  cornerRadius = 20,
  requestAccess = true,
  usePic = true,
  dataAuthUrl,
}: TelegramLoginProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Для локальной разработки используем iframe вместо виджета
    // так как localhost не поддерживается Telegram Login Widget напрямую
    
    // Создаём уникальное имя функции для callback
    const callbackName = `onTelegramAuth_${Date.now()}`;
    
    // Регистрируем глобальную функцию для callback
    (window as any)[callbackName] = (user: TelegramAuthData) => {
      console.log('Telegram auth callback received:', user);
      onAuth(user);
    };

    // Для localhost не используем тестовую авторизацию
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      setError('Авторизация через Telegram Login Widget недоступна на localhost. Используйте вход через бота на странице /login.');
      setIsLoading(false);
      return;
    }

    // Создаём скрипт виджета для production
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', buttonSize);
    script.setAttribute('data-radius', cornerRadius.toString());
    script.setAttribute('data-request-access', requestAccess ? 'write' : '');
    script.setAttribute('data-userpic', usePic ? 'true' : 'false');
    
    if (dataAuthUrl) {
      script.setAttribute('data-auth-url', dataAuthUrl);
    } else {
      script.setAttribute('data-onauth', callbackName);
    }

    script.async = true;
    script.onload = () => {
      setIsLoading(false);
      console.log('Telegram Login Widget loaded');
    };
    script.onerror = () => {
      setError('Ошибка загрузки Telegram виджета');
      setIsLoading(false);
      console.error('Failed to load Telegram Login Widget');
    };

    if (containerRef.current) {
      containerRef.current.innerHTML = ''; // Очищаем контейнер
      containerRef.current.appendChild(script);
    }

    // Cleanup
    return () => {
      delete (window as any)[callbackName];
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [botUsername, buttonSize, cornerRadius, requestAccess, usePic, dataAuthUrl, onAuth]);

  return (
    <div className="flex flex-col items-center">
      {error && (
        <div className="mb-4 text-red-500 text-sm text-center">
          {error}
        </div>
      )}
      
      {isLoading && (
        <div className="mb-4 text-gray-400 text-sm">
          Загрузка виджета Telegram...
        </div>
      )}
      
      <div ref={containerRef} className="telegram-login-container" />
      
      <div className="mt-4 text-center text-gray-400 text-xs max-w-xs">
        Нажимая на кнопку, вы соглашаетесь на обработку персональных данных
      </div>
    </div>
  );
}
