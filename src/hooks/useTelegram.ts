import { useEffect, useState, useRef } from 'react';

export const useTelegram = () => {
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState<any>(null);
  const initialized = useRef(false);

  useEffect(() => {
    // Устанавливаем флаг, что мы на клиенте
    setIsClient(true);

    if (!initialized.current) {
      initialized.current = true;
      
      if (window.Telegram?.WebApp) {
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

      // Моковые данные для разработки
      const mockUser = {
        id: 123456789,
        first_name: 'Тест',
        last_name: 'Пользователь',
        username: 'testuser'
      };

      // Устанавливаем пользователя один раз
      const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      setUser(telegramUser || mockUser);
    }
  }, []);

  return {
    webApp: isClient ? window.Telegram?.WebApp : null,
    user, // Теперь стабильный объект
  };
};