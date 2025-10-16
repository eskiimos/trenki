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

      // Получаем пользователя из Telegram (если есть)
      // В браузере/PWA будет null, и приложение предложит регистрацию
      const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      setUser(telegramUser || null);
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