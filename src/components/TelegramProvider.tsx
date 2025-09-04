'use client';

import { useEffect } from 'react';

const TelegramProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // Инициализируем приложение
      tg.ready();
      
      // Разворачиваем приложение на полный экран
      tg.expand();
      
      // Отключаем вертикальные свайпы, которые могут сворачивать приложение
      tg.isVerticalSwipesEnabled = false;
      
      // Включаем подтверждение закрытия
      tg.enableClosingConfirmation();
      
      // Устанавливаем цвета темы
      tg.setHeaderColor('#060919');
      tg.setBackgroundColor('#060919');
      
      // Скрываем основную кнопку по умолчанию
      tg.MainButton.hide();
      
      console.log('Telegram WebApp initialized:', {
        version: tg.version,
        platform: tg.platform,
        isExpanded: tg.isExpanded,
        viewportHeight: tg.viewportHeight,
        user: tg.initDataUnsafe?.user
      });
    }
  }, []);

  return <>{children}</>;
};

export default TelegramProvider;
