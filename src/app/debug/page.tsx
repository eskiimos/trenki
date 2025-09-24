'use client';

import { useTelegram } from '../../hooks/useTelegram';
import { useState, useEffect } from 'react';

export default function TestPage() {
  const { user } = useTelegram();
  const [userStatus, setUserStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserStatus = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/user/status?telegramId=${user.id}`);
        const data = await response.json();
        setUserStatus(data);
      } catch (error) {
        console.error('Ошибка:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserStatus();
  }, [user]);

  return (
    <div className="bg-[#060919] min-h-screen text-white p-4">
      <h1 className="text-2xl font-bold mb-4">Тест Telegram данных</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Данные из Telegram:</h2>
        <pre className="bg-gray-800 p-3 rounded text-sm overflow-auto">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Статус пользователя в БД:</h2>
        {isLoading ? (
          <p>Загрузка...</p>
        ) : (
          <pre className="bg-gray-800 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(userStatus, null, 2)}
          </pre>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Логика отображения:</h2>
        <div className="bg-gray-800 p-3 rounded">
          <p><strong>Показать номер и позицию:</strong> {userStatus?.hasCompleteProfile ? 'ДА' : 'НЕТ'}</p>
          <p><strong>Показать потенциал:</strong> {userStatus?.hasCompleteProfile ? 'ДА' : 'НЕТ'}</p>
          <p><strong>Имя для отображения:</strong> {user?.first_name || 'Игрок'}</p>
          <p><strong>Фамилия для отображения:</strong> {user?.last_name || 'Не указано'}</p>
        </div>
      </div>
    </div>
  );
}