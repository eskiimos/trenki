'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '../../hooks/useTelegram';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { ProfileSkeleton } from '../../components/Skeleton';
import BottomNavigation from '@/components/BottomNavigation';
import { clearAuth } from '@/lib/auth';

const ProfilePage = () => {
  const router = useRouter();
  const { user } = useTelegram();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Push-уведомления
  const { 
    isSupported, 
    isSubscribed, 
    isLoading: pushLoading, 
    error: pushError,
    subscribe, 
    unsubscribe 
  } = usePushNotifications();

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
        
        // Запрос к API для получения полного профиля пользователя с таймаутом
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
        
        const response = await fetch(`/api/profile?telegramId=${telegramId}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok || cancelled) {
          throw new Error('Ошибка загрузки профиля');
        }

        const data = await response.json();
        console.log('Profile data received:', data);
        
        if (!cancelled) {
          setUserProfile(data.user);
          setIsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Ошибка загрузки профиля:', error);
          setIsLoading(false);
        }
      }
    };

    // Запускаем загрузку только если есть user.id и ещё нет профиля
    if (user?.id) {
      fetchUserProfile();
    } else {
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

  // Функция выхода
  const handleLogout = () => {
    if (confirm('Вы уверены, что хотите выйти?')) {
      clearAuth();
      router.push('/');
      router.refresh();
    }
  };

  // Показываем скелетон во время загрузки
  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="bg-[#101530] min-h-screen text-white">
      {/* Шапка с кнопкой назад */}
      <div className="flex items-center justify-between p-4 pt-[100px]">
        <div className="flex items-center gap-4">
          <Link href="/" className="inline-block">
            <div className="w-8 h-8 flex items-center justify-center">
              <Image 
                src="/icons/icon-action-back.svg" 
                alt="Назад" 
                width={32} 
                height={32}
              />
            </div>
          </Link>
          <h1 className="text-white text-xs font-bold font-overpass leading-[120%] tracking-[0.5px] align-middle uppercase">Профиль</h1>
        </div>
        
        {/* Кнопка редактирования */}
        <Link href="/profile/edit" className="inline-block">
          <div className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity">
            <Image 
              src="/icons/icon-edit.svg" 
              alt="Редактировать профиль" 
              width={32} 
              height={32}
            />
          </div>
        </Link>
      </div>

      {/* Основной контент */}
      <div className="px-4 pb-20">
        {/* Профиль игрока - новый дизайн */}
        <div className="mb-6">
          {/* Карточка аватара */}
          <div className="bg-[#060919] rounded-lg overflow-hidden">
            {/* Аватар пользователя */}
            <div className="w-full h-[235px] relative">
              <Image 
                src={userProfile?.avatar || "/avatars/Avatar.png"}
                alt="Игрок" 
                width={400} 
                height={235} 
                className="w-full h-full object-cover"
              />
              
              {/* Номер и позиция - левый верхний угол */}
              <div className="absolute top-3 left-3 w-16 h-16 bg-[#445CFF] rounded-lg flex flex-col items-center justify-center">
                <div className="text-white text-2xl font-black font-overpass leading-none">
                  {userProfile?.profile?.number || '-'}
                </div>
                <div className="text-white text-xs font-medium font-overpass uppercase leading-none mt-1">
                  {userProfile?.profile?.position ? 
                    (userProfile.profile.position === 'GOALTENDER' ? 'ВР' :
                     userProfile.profile.position === 'DEFENSEMAN' ? 'ЗЩ' :
                     userProfile.profile.position === 'LEFT_WING' ? 'ЛК' :
                     userProfile.profile.position === 'CENTER' ? 'ЦН' :
                     userProfile.profile.position === 'RIGHT_WING' ? 'ПК' : '-')
                    : '-'
                  }
                </div>
              </div>
              
              {/* Логотип клуба - правый верхний угол */}
              <div className="absolute top-3 right-3 w-16 h-16 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                <Image 
                  src={userProfile?.clubLogo || "/icons/icon-app.svg"}
                  alt="Логотип клуба" 
                  width={64} 
                  height={64} 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            {/* Имя */}
            <div className="h-10 px-4 flex items-center border-b border-[#26252F]">
              <div className="text-[#445CFF] text-base font-medium font-overpass uppercase">
                {isLoading ? 'Загрузка...' : (displayName || 'ИМЯ')}
              </div>
            </div>
            
            {/* Фамилия */}
            <div className="h-10 px-4 flex items-center border-b border-[#26252F]">
              <div className="text-[#445CFF] text-base font-medium font-overpass uppercase">
                {isLoading ? '' : (displayLastName || 'ФАМИЛИЯ')}
              </div>
            </div>
            
            {/* Возраст, рост, вес */}
            <div className="h-10 px-4 flex items-center">
              <div className="text-[#AEABBB] text-sm font-medium font-overpass uppercase">
                {userProfile?.profile?.age || '-'} ГОД | {userProfile?.profile?.height || '-'} СМ | {userProfile?.profile?.weight || '-'} КГ
              </div>
            </div>
          </div>
        </div>

        {/* Секция потенциала */}
        <div className="mb-6">
          <div className="bg-[#060919] rounded-lg p-6 relative overflow-hidden">
            <div className="flex items-center justify-between">
              {/* Левая часть - характеристики */}
              <div className="flex-1 space-y-6">
                {/* Выносливость */}
                <div className="flex items-center gap-3">
                  <div className="text-[#AEABBB] text-xs font-medium font-overpass uppercase tracking-wide whitespace-nowrap">
                    ВЫНОСЛИВОСТЬ
                  </div>
                  <div className="flex-1 h-[1px] bg-[#445CFF]/30"></div>
                  <div className="w-12 h-12 rounded-full border-2 border-[#445CFF] flex items-center justify-center">
                    <span className="text-[#445CFF] text-lg font-black font-overpass">
                      {userProfile?.profile?.ratingEndurance?.toFixed(0) || '-'}
                    </span>
                  </div>
                </div>

                {/* Гибкость */}
                <div className="flex items-center gap-3">
                  <div className="text-[#AEABBB] text-xs font-medium font-overpass uppercase tracking-wide whitespace-nowrap">
                    ГИБКОСТЬ
                  </div>
                  <div className="flex-1 h-[1px] bg-[#445CFF]/30"></div>
                  <div className="w-12 h-12 rounded-full border-2 border-[#445CFF] flex items-center justify-center">
                    <span className="text-[#445CFF] text-lg font-black font-overpass">
                      {userProfile?.profile?.ratingFlexibility?.toFixed(0) || '-'}
                    </span>
                  </div>
                </div>

                {/* Сила */}
                <div className="flex items-center gap-3">
                  <div className="text-[#AEABBB] text-xs font-medium font-overpass uppercase tracking-wide whitespace-nowrap">
                    СИЛА
                  </div>
                  <div className="flex-1 h-[1px] bg-[#445CFF]/30"></div>
                  <div className="w-12 h-12 rounded-full border-2 border-[#445CFF] flex items-center justify-center">
                    <span className="text-[#445CFF] text-lg font-black font-overpass">
                      {userProfile?.profile?.ratingPower?.toFixed(0) || '-'}
                    </span>
                  </div>
                </div>

                {/* Техника */}
                <div className="flex items-center gap-3">
                  <div className="text-[#AEABBB] text-xs font-medium font-overpass uppercase tracking-wide whitespace-nowrap">
                    ТЕХНИКА
                  </div>
                  <div className="flex-1 h-[1px] bg-[#445CFF]/30"></div>
                  <div className="w-12 h-12 rounded-full border-2 border-[#445CFF] flex items-center justify-center">
                    <span className="text-[#445CFF] text-lg font-black font-overpass">
                      {userProfile?.profile?.ratingTechnique?.toFixed(0) || '-'}
                    </span>
                  </div>
                </div>

                {/* Скорость */}
                <div className="flex items-center gap-3">
                  <div className="text-[#AEABBB] text-xs font-medium font-overpass uppercase tracking-wide whitespace-nowrap">
                    СКОРОСТЬ
                  </div>
                  <div className="flex-1 h-[1px] bg-[#445CFF]/30"></div>
                  <div className="w-12 h-12 rounded-full border-2 border-[#445CFF] flex items-center justify-center">
                    <span className="text-[#445CFF] text-lg font-black font-overpass">
                      {userProfile?.profile?.ratingSpeed?.toFixed(0) || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Правая часть - общий потенциал */}
              <div className="ml-8 relative">
                {/* Большой круг */}
                <div className="relative w-40 h-40">
                  {/* Внешнее кольцо с градиентом */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 160 160">
                    <circle
                      cx="80"
                      cy="80"
                      r="72"
                      fill="none"
                      stroke="#445CFF"
                      strokeWidth="3"
                      opacity="0.2"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="72"
                      fill="none"
                      stroke="url(#gradient)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(userProfile?.profile?.potential || 0) * 4.52} 1000`}
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#A1FF4A" />
                        <stop offset="100%" stopColor="#7DFF8C" />
                      </linearGradient>
                    </defs>
                  </svg>
                  
                  {/* Внутренний контент */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[#A1FF4A] text-5xl font-black font-overpass leading-none">
                      {userProfile?.profile?.potential?.toFixed(0) || '-'}
                    </div>
                    <div className="text-[#AEABBB] text-xs font-medium font-overpass uppercase mt-2 text-center leading-tight">
                      ОБЩИЙ<br/>ПОТЕНЦИАЛ
                    </div>
                  </div>
                  
                  {/* Декоративные точки вокруг */}
                  <div className="absolute -top-1 left-1/2 w-2 h-2 rounded-full bg-[#A1FF4A]"></div>
                  <div className="absolute top-8 -right-2 w-2 h-2 rounded-full bg-[#A1FF4A]"></div>
                  <div className="absolute bottom-8 -right-2 w-2 h-2 rounded-full bg-[#A1FF4A]"></div>
                  <div className="absolute top-1/4 -left-2 w-2 h-2 rounded-full bg-[#A1FF4A]"></div>
                  <div className="absolute bottom-1/4 -left-2 w-2 h-2 rounded-full bg-[#A1FF4A]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Дневной прогресс */}
        {userProfile?.profile?.potential !== undefined && userProfile?.profile?.potential > 0 && (
          <div className="bg-[#2d3448] rounded-lg p-4 mb-6">
            <div className="text-white text-sm font-medium font-overpass mb-3">
              📅 Сегодня
            </div>
            
            <div className="space-y-3">
              {/* Модули */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[#AEABBB] text-xs font-overpass">Модули</span>
                  <span className="text-white text-xs font-bold font-overpass">
                    {userProfile?.profile?.modulesToday || 0}/4
                  </span>
                </div>
                <div className="h-2 bg-[#1a1f35] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#445CFF] to-[#7B61FF] rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, ((userProfile?.profile?.modulesToday || 0) / 4) * 100)}%` 
                    }}
                  />
                </div>
              </div>
              
              {/* Тренировки */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[#AEABBB] text-xs font-overpass">Тренировки</span>
                  <span className="text-white text-xs font-bold font-overpass">
                    {userProfile?.profile?.trainingsToday || 0}/2
                  </span>
                </div>
                <div className="h-2 bg-[#1a1f35] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#A1FF4A] to-[#7DFF8C] rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, ((userProfile?.profile?.trainingsToday || 0) / 2) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* Предупреждение о лимите */}
            {((userProfile?.profile?.modulesToday || 0) >= 4 || (userProfile?.profile?.trainingsToday || 0) >= 2) && (
              <div className="mt-3 p-2 bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded text-[#FF6B6B] text-[10px] font-overpass text-center">
                ⚠️ Дневной лимит достигнут. Приходи завтра!
              </div>
            )}
          </div>
        )}

        {/* Меню разделы */}
        <div className="space-y-3 mb-6">
          <Link href="/training/history">
            <div className="flex justify-between items-center py-3 cursor-pointer hover:opacity-80 transition-opacity">
              <span className="text-white text-sm font-medium font-overpass uppercase tracking-wide">ИЗБРАННЫЕ ТРЕНЕРЫ</span>
              <Image 
                src="/icons/arrow.svg" 
                alt="Стрелка" 
                width={20} 
                height={20}
                className="opacity-50"
              />
            </div>
          </Link>
          
          <div className="h-[1px] bg-[#26252F]"></div>
          
          <div className="flex justify-between items-center py-3">
            <span className="text-white text-sm font-medium font-overpass uppercase tracking-wide">ИЗБРАННЫЕ ТРЕНИРОВКИ</span>
            <Image 
              src="/icons/arrow.svg" 
              alt="Стрелка" 
              width={20} 
              height={20}
              className="opacity-50"
            />
          </div>
          
          <div className="h-[1px] bg-[#26252F]"></div>
          
          <div className="flex justify-between items-center py-3">
            <span className="text-white text-sm font-medium font-overpass uppercase tracking-wide">ИСТОРИЯ ПРОСМОТРОВ</span>
            <Image 
              src="/icons/arrow.svg" 
              alt="Стрелка" 
              width={20} 
              height={20}
              className="opacity-50"
            />
          </div>
        </div>
        
        {/* FAQ секция */}
        <div className="mb-6">
          <h2 className="text-white text-sm font-medium font-overpass uppercase tracking-wide mb-4">
            ЧАСТЫЕ ВОПРОСЫ
          </h2>
          <div className="space-y-2">
            <FAQItem question="А что будет, если вот так?" />
            <FAQItem question="А если вот так?" />
            <FAQItem question="А вот так?" />
          </div>
        </div>

        {/* Служебные кнопки */}
        <div className="space-y-2">
          {/* Кнопка админки */}
          <div>
            <Link href="/admin">
              <button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
                🔧 Админка
              </button>
            </Link>
          </div>
          
          {/* Кнопка push-уведомлений */}
          {isSupported && (
            <div className="pt-2">
              <button 
                onClick={isSubscribed ? unsubscribe : subscribe}
                disabled={pushLoading}
                className={`w-full ${
                  isSubscribed 
                    ? 'bg-gray-600 hover:bg-gray-700' 
                    : 'bg-green-600 hover:bg-green-700'
                } text-white font-semibold py-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {pushLoading ? '⏳ Загрузка...' : isSubscribed ? '🔕 Отключить уведомления' : '🔔 Включить уведомления'}
              </button>
              {pushError && (
                <p className="text-red-500 text-xs mt-1 text-center">{pushError}</p>
              )}
            </div>
          )}
          
          {/* Кнопка выхода */}
          <div className="pt-2">
            <button 
              onClick={handleLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-4 rounded-lg transition-all duration-300"
            >
              🚪 Выйти
            </button>
          </div>
        </div>
      </div>
      
      {/* Тапбар */}
      <BottomNavigation activeTab="profile" />
    </div>
  );
};

// Компонент для характеристик
const CharacteristicBar = ({ emoji, label, value }: {
  emoji: string;
  label: string;
  value: number;
}) => {
  // Определяем цвет на основе значения
  const getColor = (val: number) => {
    if (val >= 80) return '#A1FF4A'; // Зеленый
    if (val >= 60) return '#FFD700'; // Золотой
    if (val >= 40) return '#FFA500'; // Оранжевый
    return '#FF6B6B'; // Красный
  };
  
  const color = getColor(value);
  
  return (
    <div className="bg-[#2d3448] rounded px-2 py-1.5">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1">
          <span className="text-sm">{emoji}</span>
          <span className="text-[#AEABBB] text-[10px] font-medium font-overpass">{label}</span>
        </div>
        <span className="text-white text-sm font-black font-overpass">
          {value.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 bg-[#1a1f35] rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ 
            width: `${Math.min(100, value)}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  );
};

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
  <div className="bg-[#060919] rounded-lg px-4 py-3 flex justify-between items-center cursor-pointer hover:opacity-80 transition-opacity">
    <span className="text-white text-sm font-normal font-overpass">{question}</span>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      <path d="M4 6L8 10L12 6" stroke="#AEABBB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

export default ProfilePage;
