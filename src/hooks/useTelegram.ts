import { useEffect, useState, useRef } from 'react';
import { getUserData, updateLastLogin } from '@/lib/auth';

export const useTelegram = () => {
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState<any>(null);
  const initialized = useRef(false);

  useEffect(() => {
    // Устанавливаем флаг, что мы на клиенте
    setIsClient(true);

    if (!initialized.current) {
      initialized.current = true;
      
      // Проверяем, открыто ли приложение в Telegram
      const isTelegramApp = window.Telegram?.WebApp?.initData && window.Telegram?.WebApp?.initData.length > 0;
      
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
        console.log('Platform:', tg.platform);
        console.log('Is Telegram App:', isTelegramApp);
      }

      // Получаем данные пользователя через нашу систему авторизации
      const userData = getUserData();
      
      if (userData) {
        // Обновляем время последнего входа
        updateLastLogin();
        
        // Формируем объект пользователя в формате Telegram
        const telegramUser = {
          id: userData.id,
          is_bot: false,
          first_name: userData.firstName || 'User',
          last_name: userData.lastName,
          username: userData.username,
          language_code: (userData as any).languageCode || 'ru',
          photo_url: (userData as any).photoUrl,
        };
        
        console.log('useTelegram: User loaded:', telegramUser);
        setUser(telegramUser);
      } else {
        console.log('useTelegram: No user found');
        setUser(null);
      }
    }
  }, []);

  // Определяем источник запуска
  const isTelegramApp = isClient && window.Telegram?.WebApp?.initData && window.Telegram?.WebApp?.initData.length > 0;
  const platform = isClient ? window.Telegram?.WebApp?.platform : null;

  return {
    webApp: isClient ? window.Telegram?.WebApp : null,
    user, // Теперь стабильный объект
    isTelegramApp, // true - если открыто в Telegram Mini App, false - если PWA/браузер
    platform, // 'ios', 'android', 'macos', 'windows', 'web' и т.д.
  };
};