'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '../../../hooks/useTelegram';
import { ProfileEditSkeleton } from '../../../components/Skeleton';

const ProfileEditPage = () => {
  const { user } = useTelegram();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    position: '',
    number: '',
    age: '',
    height: '',
    weight: ''
  });

  useEffect(() => {
    let cancelled = false;

    const fetchUserProfile = async () => {
      if (!user?.id || cancelled) {
        setIsLoading(false);
        return;
      }

      try {
        const telegramId = user?.id?.toString() || user?.username || 'testuser';
        console.log('Profile edit page: fetching profile for', telegramId);
        
        const response = await fetch(`/api/profile?telegramId=${telegramId}`);
        
        if (!response.ok || cancelled) {
          throw new Error('Ошибка загрузки профиля');
        }

        const data = await response.json();
        
        if (!cancelled) {
          setUserProfile(data.user);
          
          // Заполняем форму данными
          setFormData({
            firstName: data.user?.firstName || user.first_name || '',
            lastName: data.user?.lastName || user.last_name || '',
            position: data.user?.profile?.position || '',
            number: data.user?.profile?.number?.toString() || '',
            age: data.user?.profile?.age?.toString() || '',
            height: data.user?.profile?.height?.toString() || '',
            weight: data.user?.profile?.weight?.toString() || ''
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Ошибка загрузки профиля:', error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    // Загружаем данные только если их еще нет
    if (user?.id && !userProfile) {
      fetchUserProfile();
    } else if (user?.id && userProfile) {
      setIsLoading(false);
    }

    // Cleanup функция
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // Зависимость только от ID пользователя

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Более надежное получение telegramId для продакшена
      let telegramId = user?.id?.toString();
      
      // Fallback методы для получения telegramId на продакшене
      if (!telegramId) {
        telegramId = user?.username;
      }
      
      // Попробуем получить данные из Telegram WebApp напрямую
      if (!telegramId && typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const webAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
        telegramId = webAppUser?.id?.toString() || webAppUser?.username;
      }
      
      // Последний fallback для тестирования
      if (!telegramId) {
        telegramId = 'testuser';
      }
      
      console.log('=== PROFILE SAVE DEBUG ===');
      console.log('User:', user);
      console.log('Final telegramId:', telegramId);
      console.log('Form data:', formData);
      console.log('Environment:', process.env.NODE_ENV);
      console.log('Window Telegram:', typeof window !== 'undefined' ? window.Telegram : 'not available');
      
      const requestData = {
        telegramId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: user?.username,
        profile: {
          position: formData.position || null,
          number: formData.number ? parseInt(formData.number) : null,
          age: formData.age ? parseInt(formData.age) : null,
          height: formData.height ? parseInt(formData.height) : null,
          weight: formData.weight ? parseInt(formData.weight) : null,
        },
      };
      
      console.log('Request data:', JSON.stringify(requestData, null, 2));
      
      // Проверим доступность API перед основным запросом  
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      console.log('Base URL:', baseUrl);
      console.log('API URL:', `${baseUrl}/api/profile`);
      
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      let responseData;
      try {
        responseData = await response.json();
        console.log('Response data:', responseData);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error('Сервер вернул невалидный ответ');
      }

      if (response.ok) {
        console.log('Profile saved successfully, redirecting to profile page');
        router.push('/profile');
      } else {
        console.error('Server error:', responseData);
        throw new Error(responseData.error || `Ошибка сервера: ${response.status}`);
      }
    } catch (error: unknown) {
      console.error('=== PROFILE SAVE ERROR ===');
      
      const err = error as { name?: string; message?: string };
      
      console.error('Error type:', err?.name || 'Unknown');
      console.error('Error message:', err?.message || 'No message');
      console.error('Full error:', error);
      
      let errorMessage = 'Ошибка при сохранении профиля. Попробуйте еще раз.';
      
      if (err?.message?.includes('Failed to fetch')) {
        errorMessage = 'Проблема с подключением. Проверьте интернет соединение.';
      } else if (err?.message?.includes('Сервер вернул невалидный ответ')) {
        errorMessage = 'Сервер недоступен. Попробуйте позже.';
      } else if (err?.message?.includes('Ошибка сервера:')) {
        errorMessage = err.message;
      }
      
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <ProfileEditSkeleton />;
  }

  return (
    <div className="bg-[#101530] min-h-screen text-white">
      {/* Шапка */}
      <div className="flex items-center justify-between p-4 pt-[100px] border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="inline-block">
            <div className="w-4 h-4 flex items-center justify-center">
              <Image 
                src="/icons/arrow.svg" 
                alt="Назад" 
                width={16} 
                height={16}
                style={{ transform: 'rotate(180deg)' }}
              />
            </div>
          </Link>
          <h1 className="text-white text-lg font-semibold">Редактировать профиль</h1>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      {/* Основной контент */}
      <div className="px-4 py-6 pb-32">
        <div className="space-y-6">
          {/* Личная информация */}
          <div className="bg-[#1a1e3a] rounded-lg p-4">
            <h2 className="text-white text-base font-semibold mb-4">Личная информация</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Имя
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="w-full bg-[#2a2e4a] text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Введите имя"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Фамилия
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="w-full bg-[#2a2e4a] text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Введите фамилию"
                />
              </div>
            </div>
          </div>

          {/* Хоккейная информация */}
          <div className="bg-[#1a1e3a] rounded-lg p-4">
            <h2 className="text-white text-base font-semibold mb-4">Хоккейная информация</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Позиция
                </label>
                <select
                  value={formData.position}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  className="w-full bg-[#2a2e4a] text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Выберите позицию</option>
                  <option value="GOALTENDER">Вратарь</option>
                  <option value="DEFENSEMAN">Защитник</option>
                  <option value="LEFT_WING">Левый крайний</option>
                  <option value="CENTER">Центральный нападающий</option>
                  <option value="RIGHT_WING">Правый крайний</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Номер игрока
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={formData.number}
                  onChange={(e) => handleInputChange('number', e.target.value)}
                  className="w-full bg-[#2a2e4a] text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Введите номер (1-99)"
                />
              </div>
            </div>
          </div>

          {/* Физические характеристики */}
          <div className="bg-[#1a1e3a] rounded-lg p-4">
            <h2 className="text-white text-base font-semibold mb-4">Физические характеристики</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Возраст (лет)
                </label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={formData.age}
                  onChange={(e) => handleInputChange('age', e.target.value)}
                  className="w-full bg-[#2a2e4a] text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Введите возраст"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Рост (см)
                </label>
                <input
                  type="number"
                  min="100"
                  max="230"
                  value={formData.height}
                  onChange={(e) => handleInputChange('height', e.target.value)}
                  className="w-full bg-[#2a2e4a] text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Введите рост в см"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Вес (кг)
                </label>
                <input
                  type="number"
                  min="30"
                  max="150"
                  value={formData.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  className="w-full bg-[#2a2e4a] text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Введите вес в кг"
                />
              </div>
            </div>
          </div>

          {/* Информационная секция */}
          <div className="bg-[#1a1e3a] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 mt-1">
                <Image 
                  src="/icons/ant-design-thunderbolt-filled.svg" 
                  alt="Информация" 
                  width={20} 
                  height={20}
                  className="opacity-70"
                />
              </div>
              <div>
                <p className="text-gray-300 text-sm">
                  <span className="font-medium">Статистика и прогресс</span> будут доступны в платной версии приложения
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Детальная аналитика, отслеживание прогресса и персональные рекомендации
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Нижнее меню */}
      <BottomNavigation />
    </div>
  );
};

// Компонент нижнего меню (можно выделить в отдельный файл)
const BottomNavigation = () => (
  <div className="fixed bottom-0 left-0 right-0 bg-[#101530] border-t border-gray-700">
    <div className="flex justify-around py-2">
      <Link href="/" className="flex flex-col items-center p-2">
        <div className="w-6 h-6 mb-1">
          <Image src="/icons/ant-design-thunderbolt-filled.svg" alt="Главная" width={24} height={24} />
        </div>
      </Link>
      <Link href="/trainers" className="flex flex-col items-center p-2">
        <div className="w-6 h-6 mb-1">
          <Image src="/icons/ant-design-thunderbolt-filled_dark.svg" alt="Тренеры" width={24} height={24} />
        </div>
      </Link>
      <Link href="/shorts" className="flex flex-col items-center p-2">
        <div className="w-6 h-6 mb-1">
          <Image src="/icons/ant-design-thunderbolt-filled_f.svg" alt="Shorts" width={24} height={24} />
        </div>
      </Link>
      <Link href="/profile" className="flex flex-col items-center p-2">
        <div className="w-6 h-6 mb-1">
          <Image src="/icons/ant-design-thunderbolt-filled.svg" alt="Профиль" width={24} height={24} />
        </div>
      </Link>
    </div>
  </div>
);

export default ProfileEditPage;