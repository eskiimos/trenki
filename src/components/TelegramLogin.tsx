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

    // Для dev-режима показываем кнопку с переходом на Telegram бот
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
      // Создаём кнопку для локальной разработки
      const button = document.createElement('button');
      button.innerHTML = `
        <div style="
          background: #54A9EB;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
          </svg>
          Login with Telegram
        </div>
      `;
      button.onclick = () => {
        // В dev-режиме используем тестовую авторизацию
        const testUser: TelegramAuthData = {
          id: 123456789,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
          photo_url: undefined,
          auth_date: Math.floor(Date.now() / 1000),
          hash: 'test_hash_' + Date.now(),
        };
        console.log('DEV MODE: Simulating Telegram auth with test user:', testUser);
        onAuth(testUser);
      };
      
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(button);
      }
      
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
