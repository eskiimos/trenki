'use client';

import { useEffect, useState } from 'react';

export default function TelegramTestPage() {
  const [webAppData, setWebAppData] = useState<any>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    const results: string[] = [];

    // Проверяем наличие Telegram WebApp
    if (typeof window !== 'undefined') {
      const tg = (window as any).Telegram?.WebApp;
      
      if (tg) {
        results.push('✅ Telegram WebApp API доступен');
        
        setWebAppData({
          initData: tg.initData,
          initDataUnsafe: tg.initDataUnsafe,
          version: tg.version,
          platform: tg.platform,
          colorScheme: tg.colorScheme,
          isExpanded: tg.isExpanded,
          viewportHeight: tg.viewportHeight,
          viewportStableHeight: tg.viewportStableHeight,
        });
        
        results.push(`📱 Платформа: ${tg.platform}`);
        results.push(`🎨 Версия: ${tg.version}`);
        results.push(`🌓 Цветовая схема: ${tg.colorScheme}`);
        
        if (tg.initDataUnsafe?.user) {
          results.push(`👤 Пользователь: ${tg.initDataUnsafe.user.first_name}`);
          results.push(`🆔 User ID: ${tg.initDataUnsafe.user.id}`);
        }
      } else {
        results.push('❌ Telegram WebApp API недоступен');
        results.push('⚠️ Приложение открыто не в Telegram');
      }
    }

    setTestResults(results);
  }, []);

  const testOpenLink = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.openTelegramLink('https://t.me/trenkibot?start=test');
      setTestResults(prev => [...prev, '🔗 Попытка открыть ссылку...']);
    } else {
      setTestResults(prev => [...prev, '❌ WebApp API недоступен']);
    }
  };

  const testOpenExternal = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.openLink('https://google.com');
      setTestResults(prev => [...prev, '🌐 Попытка открыть внешнюю ссылку...']);
    } else {
      setTestResults(prev => [...prev, '❌ WebApp API недоступен']);
    }
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white p-6">
      <h1 className="text-3xl font-bold mb-6">🧪 Telegram WebApp Test</h1>

      <div className="space-y-6">
        {/* Результаты проверки */}
        <div className="bg-[#1a1f3a] rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Результаты проверки</h2>
          <div className="space-y-2">
            {testResults.map((result, index) => (
              <div key={index} className="text-sm font-mono">
                {result}
              </div>
            ))}
          </div>
        </div>

        {/* Данные WebApp */}
        {webAppData && (
          <div className="bg-[#1a1f3a] rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">WebApp Data</h2>
            <pre className="text-xs overflow-auto bg-black/30 p-4 rounded">
              {JSON.stringify(webAppData, null, 2)}
            </pre>
          </div>
        )}

        {/* Тестовые кнопки */}
        <div className="space-y-3">
          <button
            onClick={testOpenLink}
            className="w-full bg-[#0088cc] hover:bg-[#006699] text-white font-bold py-4 px-6 rounded-xl"
          >
            🤖 Test: openTelegramLink (to bot)
          </button>

          <button
            onClick={testOpenExternal}
            className="w-full bg-[#A1FF4A] hover:opacity-90 text-[#0A0E1A] font-bold py-4 px-6 rounded-xl"
          >
            🌐 Test: openLink (external)
          </button>

          <button
            onClick={() => window.location.href = 'https://t.me/trenkibot?start=test'}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-xl"
          >
            🔗 Test: window.location.href
          </button>
        </div>

        {/* Информация */}
        <div className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-4">
          <p className="text-yellow-300 text-sm">
            <strong>Примечание:</strong> Эта страница предназначена для тестирования 
            интеграции с Telegram WebApp API. Откройте её через Mini App в Telegram 
            для корректной работы.
          </p>
        </div>
      </div>
    </div>
  );
}
