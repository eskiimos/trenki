'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTelegram } from '../../hooks/useTelegram';
import { ProfileSkeleton } from '../../components/Skeleton';
import BottomNavigation from '@/components/BottomNavigation';

const ProfilePage = () => {
  const { user } = useTelegram();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    const fetchUserProfile = async () => {
      if (!user?.id || cancelled) {
        setIsLoading(false);
        return;
      }

      try {
        const telegramId = user?.id?.toString() || user?.username || 'testuser';
        console.log('Profile page: fetching profile for', telegramId);
        
        // Запрос к API для получения полного профиля пользователя
        const response = await fetch(`/api/profile?telegramId=${telegramId}`);
        
        if (!response.ok || cancelled) {
          throw new Error('Ошибка загрузки профиля');
        }

        const data = await response.json();
        
        if (!cancelled) {
          setUserProfile(data.user);
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

    // Проверяем, есть ли уже данные профиля для этого пользователя
    if (user?.id && !userProfile) {
      fetchUserProfile();
    } else if (user?.id && userProfile) {
      setIsLoading(false);
    }

    // Cleanup функция для предотвращения race conditions
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // Зависимость только от ID пользователя

  // Определяем отображаемые данные
  const displayName = userProfile?.firstName || user?.first_name || 'ТРЕНЬКИ';
  const displayLastName = userProfile?.lastName || user?.last_name || 'ТРЕНЬКИ';
  
  // Мапинг позиций
  const positionMap: Record<string, string> = {
    'GOALTENDER': 'Вратарь',
    'DEFENSEMAN': 'Защитник',
    'LEFT_WING': 'Левый крайний',
    'CENTER': 'Центральный нападающий',
    'RIGHT_WING': 'Правый крайний'
  };

  const displayPosition = userProfile?.profile?.position ? 
    positionMap[userProfile.profile.position] || userProfile.profile.position :
    'Позиция не указана';

  // Показываем скелетон во время загрузки
  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="bg-[#101530] min-h-screen text-white">
      {/* Шапка с кнопкой назад */}
      <div className="flex items-center p-4 pt-[100px]">
        <div className="flex items-center gap-4">
          <Link href="/" className="inline-block">
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
          <h1 className="text-white text-xs font-normal font-overpass">Профиль</h1>
        </div>
      </div>

      {/* Основной контент */}
      <div className="px-4 pb-20">
        {/* Профиль игрока */}
        <div className="flex gap-3 mb-4">
          {/* Большое фото - адаптируется к высоте соседнего блока */}
          <div className="w-52 self-stretch bg-[#f6f6f6] rounded-lg overflow-hidden">
            <Image 
              src="/avatars/ChatGPT Image 5 сент. 2025 г., 11_46_52.png"
              alt="Игрок" 
              width={208} 
              height={350} 
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Информация об игроке */}
          <div className="flex-1 flex flex-col gap-2">
            {/* Аватар и иконка редактирования */}
            <div className="flex justify-between items-start">
              <div className="w-14 h-14 rounded bg-gradient-to-b from-[#445CFF]/20 to-[#445CFF]/60 overflow-hidden p-1">
                <Image 
                  src="/trenki_app.jpeg"
                  alt="Логотип клуба" 
                  width={56} 
                  height={56} 
                  className="w-full h-full object-contain"
                />
              </div>
              <Link href="/profile/edit" className="w-6 h-6 flex items-center justify-center hover:opacity-80 transition-opacity">
                <Image 
                  src="/icons/tabler_edit.svg"
                  alt="Редактировать" 
                  width={24} 
                  height={24} 
                  className="w-full h-full"
                />
              </Link>
            </div>
            
            {/* Имя */}
            <div className="text-white text-sm font-medium font-overpass leading-tight">
              {isLoading ? 'Загрузка...' : (
                <>
                  {displayName}
                  {displayLastName && <><br/>{displayLastName}</>}
                </>
              )}
            </div>
            
            {/* Позиция */}
            <div className="text-[#AEABBB] text-xs font-medium font-overpass">
              {userProfile?.profile?.number || '--'} | {displayPosition}
            </div>
            
            {/* Характеристики */}
            <div className="text-[#AEABBB] text-xs font-medium font-overpass">
              {userProfile?.profile?.age || '--'} лет | {userProfile?.profile?.height || '--'} см | {userProfile?.profile?.weight || '--'} кг
            </div>
            
            {/* Статистика - скрыта, будет доступна в платной версии */}
            {/* <div className="flex flex-col gap-0.5 mt-2">
              <StatBar label="сила" value={userProfile?.profile?.strength?.toString() || '0'} change="+7" isPositive={true} />
              <StatBar label="выносливость" value={userProfile?.profile?.endurance?.toString() || '0'} change="-4" isPositive={false} />
              <StatBar label="скорость" value={userProfile?.profile?.speed?.toString() || '0'} change="+4" isPositive={true} />
              <StatBar label="техника" value={userProfile?.profile?.technique?.toString() || '0'} change="-9" isPositive={false} />
              <StatBar label="катание" value={userProfile?.profile?.skating?.toString() || '0'} change="+2" isPositive={true} />
              <StatBar label="броски" value={userProfile?.profile?.shooting?.toString() || '0'} change="+5" isPositive={true} />
              <StatBar label="передачи" value={userProfile?.profile?.passing?.toString() || '0'} change="+3" isPositive={true} />
              <StatBar label="общее" value={userProfile?.profile?.overall?.toString() || '0'} change="-9" isPositive={false} isTotal={true} />
            </div> */}
          </div>
        </div>

        {/* Ежедневный прогресс - скрыт, будет доступен в платной версии */}
        {/* <div className="flex items-center gap-2 mb-6">
          <div className="text-white text-xs font-medium font-overpass leading-tight">
            Ежедневный<br/>прогресс {userProfile?.profile?.dailyProgress || 0}/{userProfile?.profile?.maxDailyGoal || 10}
          </div>
          <div className="flex-1 h-2 bg-[#2d3448] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#A1FF4A] to-[#7DFF8C] rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(100, ((userProfile?.profile?.dailyProgress || 0) / (userProfile?.profile?.maxDailyGoal || 10)) * 100)}%` 
              }}
            ></div>
          </div>
        </div> */}

        {/* Меню разделы */}
        <div className="space-y-4">
          <MenuSection title="Плейлисты" />
          <MenuSection title="Избранные тренера" />
          <MenuSection title="Избранные видео" />
          <MenuSection title="История просмотров" />
          
          {/* Баннер бота */}
          <div className="bg-[#2d3448] rounded-lg p-4 text-center">
            <div className="text-[#AEABBB] text-sm font-medium font-overpass mb-4">
              подключайся к чат-боту<br/>и получи больше возможностей
            </div>
            <button className="bg-[#445CFF] text-white px-6 py-2 rounded-full text-xs font-medium font-overpass">
              К боту
            </button>
          </div>
          
          {/* FAQ */}
          <div className="space-y-4">
            <MenuSection title="Частые вопросы" />
            <div className="space-y-1">
              <FAQItem question="Как начать тренироваться?" />
              <FAQItem question="Как отслеживать прогресс?" />
              <FAQItem question="Где найти программы тренировок?" />
              <FAQItem question="Как связаться с тренером?" />
            </div>
          </div>
          
          {/* Кнопка админки */}
          <div className="pt-4">
            <Link href="/admin">
              <button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
                🔧 Админка
              </button>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Тапбар */}
      <BottomNavigation activeTab="profile" />
    </div>
  );
};

// Компонент для статистики
const StatBar = ({ label, value, change, isPositive, isTotal = false }: {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  isTotal?: boolean;
}) => (
  <div className={`flex justify-between items-center px-2 py-1 rounded ${isTotal ? 'bg-[#3d4759]' : 'bg-[#2d3448]'}`}>
    <span className="text-[#AEABBB] text-xs font-medium font-overpass">{label}</span>
    <div className="flex items-center gap-1">
      <span className="text-white text-lg font-black font-overpass">{value}</span>
      <span className={`text-xs font-black font-overpass ${isPositive ? 'text-[#A1FF4A]' : 'text-[#E40202]'}`}>
        ({change})
      </span>
    </div>
  </div>
);

// Компонент для пунктов меню
const MenuSection = ({ title }: { title: string }) => (
  <div className="flex justify-between items-center">
    <span className="text-[#AEABBB] text-xs font-normal font-overpass">{title}</span>
    <div className="w-4 h-4 flex items-center justify-center">
      <Image 
        src="/icons/arrow.svg" 
        alt="Стрелка" 
        width={16} 
        height={16}
        className="transform rotate-90"
      />
    </div>
  </div>
);

// Компонент для FAQ
const FAQItem = ({ question }: { question: string }) => (
  <div className="bg-[#2d3448]/50 rounded px-3 py-2 flex justify-between items-center">
    <span className="text-[#AEABBB] text-xs font-medium font-overpass">{question}</span>
    <div className="w-3 h-3 flex items-center justify-center">
      <Image 
        src="/icons/arrow.svg" 
        alt="Стрелка" 
        width={12} 
        height={12}
        className="transform rotate-180"
      />
    </div>
  </div>
);

export default ProfilePage;
