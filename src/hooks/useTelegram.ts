import { useEffect } from 'react';

export const useTelegram = () => {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // Разворачиваем приложение на полный экран
      tg.expand();
      
      // Отключаем вертикальные свайпы, которые могут сворачивать приложение
      tg.isVerticalSwipesEnabled = false;
      
      // Включаем подтверждение закрытия
      tg.enableClosingConfirmation();
      
      // Устанавливаем цвета темы
      tg.setHeaderColor('#060919');
      tg.setBackgroundColor('#060919');
      
      // Показываем основную кнопку если нужно
      tg.MainButton.hide();
      
      console.log('Telegram WebApp initialized');
    }
  }, []);

  return {
    webApp: typeof window !== 'undefined' ? window.Telegram?.WebApp : null,
    user: typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user : null,
  };
};
