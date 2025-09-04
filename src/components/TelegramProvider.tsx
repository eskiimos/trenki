'use client';

import { useEffect } from 'react';

const TelegramProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const initTelegram = () => {
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
    };

    // Проверяем, загружен ли уже Telegram WebApp
    if (typeof window !== 'undefined') {
      if (window.Telegram?.WebApp) {
        initTelegram();
      } else {
        // Ждем загрузки скрипта
        const checkTelegram = setInterval(() => {
          if (window.Telegram?.WebApp) {
            initTelegram();
            clearInterval(checkTelegram);
          }
        }, 100);

        // Очищаем интервал через 10 секунд если скрипт не загрузился
        setTimeout(() => clearInterval(checkTelegram), 10000);
      }
    }
  }, []);

  return <>{children}</>;
};

export default TelegramProvider;
