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
            
            {/* Потенциал - крупно */}
            {userProfile?.profile?.potential !== undefined && userProfile?.profile?.potential > 0 && (
              <div className="bg-gradient-to-r from-[#445CFF]/20 to-[#7B61FF]/20 rounded-lg p-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#AEABBB] text-xs font-medium font-overpass">⚡ Потенциал</span>
                  <span className="text-white text-2xl font-black font-overpass">
                    {userProfile.profile.potential.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
            
            {/* Характеристики - компактно */}
            {userProfile?.profile?.potential !== undefined && userProfile?.profile?.potential > 0 && (
              <div className="flex flex-col gap-0.5 mt-2">
                <CharacteristicBar 
                  emoji="💪" 
                  label="Сила" 
                  value={userProfile?.profile?.ratingPower || 0} 
                />
                <CharacteristicBar 
                  emoji="⚡" 
                  label="Скорость" 
                  value={userProfile?.profile?.ratingSpeed || 0} 
                />
                <CharacteristicBar 
                  emoji="🫀" 
                  label="Выносливость" 
                  value={userProfile?.profile?.ratingEndurance || 0} 
                />
                <CharacteristicBar 
                  emoji="🎯" 
                  label="Техника" 
                  value={userProfile?.profile?.ratingTechnique || 0} 
                />
                <CharacteristicBar 
                  emoji="🤸" 
                  label="Гибкость" 
                  value={userProfile?.profile?.ratingFlexibility || 0} 
                />
              </div>
            )}
            
            {/* Приглашение пройти опрос, если характеристики не заполнены */}
            {(!userProfile?.profile?.potential || userProfile?.profile?.potential === 0) && (
              <Link href="/onboarding/characteristics" className="block mt-2">
                <div className="bg-gradient-to-r from-[#445CFF] to-[#7B61FF] rounded-lg p-3 text-center">
                  <div className="text-white text-xs font-medium font-overpass mb-1">
                    📊 Пройди стартовый опрос
                  </div>
                  <div className="text-white/70 text-[10px] font-overpass">
                    Узнай свой потенциал и начни расти!
                  </div>
                </div>
              </Link>
            )}
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
        <div className="space-y-4">
          <Link href="/training/history">
            <div className="flex justify-between items-center cursor-pointer hover:opacity-80 transition-opacity">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏋️</span>
                <span className="text-[#AEABBB] text-xs font-normal font-overpass">История тренировок</span>
              </div>
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
          </Link>
          <MenuSection title="Плейлисты" />
          <MenuSection title="Избранные тренера" />
          <MenuSection title="Избранные видео" />
          <MenuSection title="История просмотров" />
          
          {/* Скаченные видео */}
          <Link href="/offline-videos">
            <div className="flex justify-between items-center cursor-pointer hover:opacity-80 transition-opacity">
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="#AEABBB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 10L12 15L17 10" stroke="#AEABBB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 15V3" stroke="#AEABBB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[#AEABBB] text-xs font-normal font-overpass">Скаченные видео</span>
              </div>
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
          </Link>
          
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
