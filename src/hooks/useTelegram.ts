import { useEffect, useState, useRef } from 'react';
import { saveAuth, getUserData, updateLastLogin } from '@/lib/auth';

export const useTelegram = () => {
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    // Устанавливаем флаг, что мы на клиенте
    setIsClient(true);

    if (!initialized.current) {
      initialized.current = true;
      
      const initTelegram = async () => {
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
          
          console.log('✅ Telegram WebApp initialized');
          console.log('📱 Platform:', tg.platform);
          console.log('🔐 Is Telegram App:', isTelegramApp);
          
          // Если открыто в Telegram, автоматически авторизуемся
          if (isTelegramApp && tg.initData) {
            console.log('🔄 Auto-authenticating via Telegram WebApp...');
            
            try {
              // Отправляем initData на сервер для проверки
              const response = await fetch('/api/auth/verify-telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData }),
              });
              
              if (response.ok) {
                const data = await response.json();
                console.log('✅ Telegram auth successful!', data.user);
                
                // Сохраняем авторизацию
                saveAuth({
                  telegramId: data.user.telegramId,
                  firstName: data.user.firstName,
                  lastName: data.user.lastName,
                  username: data.user.username,
                });
                
                setUser(data.user);
              } else {
                console.error('❌ Telegram auth failed:', await response.text());
              }
            } catch (error) {
              console.error('❌ Error during auto-auth:', error);
            }
          }
        }

        // Проверяем сохранённые данные пользователя
        const userData = getUserData();
        
        if (userData) {
          updateLastLogin();
          console.log('👤 User loaded from storage:', userData);
          setUser(userData);
        } else {
          console.log('⚠️ No user found in storage');
        }
        
        setIsLoading(false);
      };
      
      initTelegram();
    }
  }, []);

  // Определяем источник запуска
  const isTelegramApp = isClient && window.Telegram?.WebApp?.initData && window.Telegram?.WebApp?.initData.length > 0;
  const platform = isClient ? window.Telegram?.WebApp?.platform : null;

  return {
    webApp: isClient ? window.Telegram?.WebApp : null,
    user,
    isLoading,
    isTelegramApp, // true - если открыто в Telegram Mini App, false - если PWA/браузер
    platform, // 'ios', 'android', 'macos', 'windows', 'web' и т.д.
  };
};