
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '../hooks/useTelegram';
import { apiCache } from '../lib/cache';
import { getTelegramId } from '@/lib/auth';
import BottomNavigation from '@/components/BottomNavigation';
import WorkoutReminder from '@/components/WorkoutReminder';

// Компонент для короткого видео
interface ShortVideoPlayerProps {
  shortId: string;
  poster: string;
  title: string;
}

const ShortVideoPlayer = ({ shortId, poster, title }: ShortVideoPlayerProps) => {
  return (
    <Link href={`/shorts/${shortId}`}>
      <div className="flex-shrink-0 w-36 cursor-pointer">
        <div className="bg-gray-200 rounded overflow-hidden relative aspect-[9/16]" style={{ borderRadius: '4px' }}>
          <Image
            src={poster}
            alt={title}
            fill
            className="object-cover"
            sizes="144px"
          />
        </div>
      </div>
    </Link>
  );
};

const HomePage = () => {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Инициализируем Telegram WebApp
  useTelegram();
  
  // Проверяем авторизацию при загрузке страницы
  useEffect(() => {
    const checkAuth = () => {
      // 🔓 Пропускаем проверку авторизации на localhost
      const isLocalhost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      
      if (isLocalhost) {
        console.log('🔓 Localhost detected, skipping auth check');
        setIsCheckingAuth(false);
        return;
      }
      
      const telegramId = getTelegramId();
      
      if (!telegramId) {
        console.log('❌ Пользователь не авторизован, редирект на /login');
        router.push('/login');
        return;
      }
      
      console.log('✅ Пользователь авторизован:', telegramId);
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  // Показываем загрузку во время проверки авторизации
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#060919] flex items-center justify-center">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    );
  }
  
  return (
    <div className="bg-[#060919] min-h-screen text-white pb-32">
      <Header />
      
      {/* Напоминание о незавершенной тренировке */}
      <div className="px-4 mt-4">
        <WorkoutReminder />
      </div>
      
      {/* Секция с короткими видео (треньки) */}
      <TrenkiSection />
      
      {/* Основное обучающее видео */}
      <HeroVideoSection />
      
      {/* Каталог тренировок */}
      <TrainingsSection />
      
      {/* Список тренеров */} 
      <TrainersSection />
      
      {/* Промо-баннер */}
      <PromoBannerSection />
      
      {/* Нижнее меню */}
      <BottomNavigation activeTab="home" />
    </div>
  );
};

const Header = () => {
  const { user } = useTelegram();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authData, setAuthData] = useState<any>(null);

  // Загружаем данные авторизации из localStorage
  useEffect(() => {
    const { getAuth } = require('@/lib/auth');
    const auth = getAuth();
    console.log('📦 Header: loaded authData from localStorage:', auth);
    setAuthData(auth);
  }, []);

  useEffect(() => {
    let cancelled = false;
    
    const fetchUserProfile = async () => {
      // Используем user.id из Telegram WebApp или telegramId из authData
      const userId = user?.id || authData?.telegramId;
      
      if (!userId || cancelled) {
        setIsLoading(false);
        return;
      }

      console.log('Header: attempting to fetch user status for', userId);

      // Проверяем кеш перед запросом
      const cacheKey = `user-status-${userId}`;
      const cachedData = apiCache.get(cacheKey);
      
      if (cachedData && !cancelled) {
        console.log('Header: using cached data for user status');
        
        // ВСЕГДА устанавливаем данные пользователя (имя и фамилию)
        if (cachedData.user) {
          const profileData: any = {
            firstName: cachedData.user.firstName,
            lastName: cachedData.user.lastName,
          };
          
          // Если профиль полностью заполнен, добавляем дополнительные данные
          if (cachedData.hasCompleteProfile && cachedData.user.profile) {
            const positionMap: Record<string, string> = {
              'GOALTENDER': 'ВР',
              'DEFENSEMAN': 'ЗАЩ',
              'LEFT_WING': 'ЛК',
              'CENTER': 'Ц',
              'RIGHT_WING': 'ПК'
            };
            
            profileData.overall = cachedData.user.profile.overall;
            profileData.number = cachedData.user.profile.number;
            profileData.position = positionMap[cachedData.user.profile.position] || cachedData.user.profile.position;
            profileData.potential = 'высокий';
          }
          
          setUserProfile(profileData);
          
          // Обновляем authData если данные из базы отличаются
          if (authData && (authData.firstName !== cachedData.user.firstName || authData.lastName !== cachedData.user.lastName)) {
            console.log('🔄 Updating authData with correct data from database (from cache)');
            const { saveAuth } = require('@/lib/auth');
            saveAuth({
              telegramId: cachedData.user.telegramId,
              firstName: cachedData.user.firstName,
              lastName: cachedData.user.lastName,
              username: cachedData.user.username,
            });
            
            // Перезагружаем страницу чтобы обновить все компоненты
            console.log('🔄 Reloading page to apply updated authData...');
            window.location.reload();
          }
        } else {
          setUserProfile(null);
        }
        setIsLoading(false);
        return;
      }

      try {
        console.log('Header: making API request to /api/user/status');
        // Запрос к API для проверки статуса профиля
        const response = await fetch(`/api/user/status?telegramId=${userId}`);
        
        if (!response.ok || cancelled) {
          throw new Error('Ошибка загрузки профиля');
        }

        const data = await response.json();
        
        if (cancelled) return;
        
        // Сохраняем в кеш
        apiCache.set(cacheKey, data);
        console.log('Header: cached user status data');
        
        // ВСЕГДА устанавливаем данные пользователя (имя и фамилию)
        if (data.user) {
          const profileData: any = {
            firstName: data.user.firstName,
            lastName: data.user.lastName,
          };
          
          // Если профиль полностью заполнен, добавляем дополнительные данные
          if (data.hasCompleteProfile && data.user.profile) {
            const positionMap: Record<string, string> = {
              'GOALTENDER': 'ВР',
              'DEFENSEMAN': 'ЗАЩ',
              'LEFT_WING': 'ЛК',
              'CENTER': 'Ц',
              'RIGHT_WING': 'ПК'
            };
            
            profileData.overall = data.user.profile.overall;
            profileData.number = data.user.profile.number;
            profileData.position = positionMap[data.user.profile.position] || data.user.profile.position;
            profileData.potential = 'высокий';
          }
          
          setUserProfile(profileData);
          
          // Обновляем authData если данные из базы отличаются
          if (authData && (authData.firstName !== data.user.firstName || authData.lastName !== data.user.lastName)) {
            console.log('🔄 Updating authData with correct data from database (API response)');
            const { saveAuth } = require('@/lib/auth');
            saveAuth({
              telegramId: data.user.telegramId,
              firstName: data.user.firstName,
              lastName: data.user.lastName,
              username: data.user.username,
            });
            
            // Перезагружаем страницу чтобы обновить все компоненты
            console.log('🔄 Reloading page to apply updated authData...');
            window.location.reload();
          }
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Header: error loading profile:', error);
          setUserProfile(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    // Загружаем данные только если их еще нет
    const userId = user?.id || authData?.telegramId;
    if (userId && !userProfile) {
      fetchUserProfile();
    } else if (userId && userProfile) {
      setIsLoading(false);
    }
    
    // Cleanup функция
    return () => {
      cancelled = true;
    };
  }, [user?.id, authData?.telegramId]); // Зависимость от обоих источников ID

  // Логика отображения имени (приоритет):
  // 1. Из профиля базы данных (САМЫЙ НАДЁЖНЫЙ - заполнен через онбординг)
  // 2. Из localStorage (authData) - может быть неправильным если в Telegram неправильное имя
  // 3. Из Telegram WebApp (может быть неправильным)
  // 4. Заглушка "ТРЕНЬКИ"
  console.log('🎨 Header display name sources:', {
    userProfile: { firstName: userProfile?.firstName, lastName: userProfile?.lastName },
    authData: { firstName: authData?.firstName, lastName: authData?.lastName },
    user: { first_name: user?.first_name, last_name: user?.last_name }
  });
  
  const displayName = userProfile?.firstName 
    || authData?.firstName 
    || user?.first_name 
    || 'ТРЕНЬКИ';
  
  const displayLastName = userProfile?.lastName 
    || authData?.lastName 
    || user?.last_name 
    || 'ТРЕНЬКИ';

  console.log('👤 Header display name sources:', {
    'userProfile?.firstName': userProfile?.firstName,
    'authData?.firstName': authData?.firstName,
    'user?.first_name': user?.first_name,
    'final displayName': displayName,
    'final displayLastName': displayLastName
  });

  return (
    <header style={{
      width: '100%', 
      paddingBottom: 24, 
      paddingLeft: 16, 
      paddingRight: 16, 
      paddingTop: 100,
      borderBottom: '1px #101530 solid', 
      flexDirection: 'column', 
      justifyContent: 'flex-start', 
      alignItems: 'flex-start', 
      gap: 12, 
      display: 'flex'
    }}>
      <div style={{
        width: '100%', 
        justifyContent: 'flex-start', 
        alignItems: 'center', 
        gap: 4, 
        display: 'flex'
      }}>
        {/* Показываем номер и позицию только если профиль заполнен */}
        {userProfile && (
          <div style={{
            width: 40, 
            paddingTop: 4, 
            paddingBottom: 4, 
            overflow: 'hidden', 
            borderRadius: 2, 
            flexDirection: 'column', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            display: 'flex'
          }}>
            <div style={{
              textAlign: 'center', 
              color: '#F9F8FE', 
              fontSize: 24, 
              fontFamily: 'Overpass', 
              fontWeight: '700', 
              lineHeight: '24px'
            }}>{userProfile.number}</div>
            <div style={{
              textAlign: 'center', 
              color: '#F9F8FE', 
              fontSize: 12, 
              fontFamily: 'Overpass', 
              fontWeight: '700', 
              lineHeight: '12px', 
              letterSpacing: 0.50
            }}>{userProfile.position}</div>
          </div>
        )}
        
        <div style={{
          flex: '1 1 0', 
          padding: 4, 
          borderRadius: 2, 
          flexDirection: 'column', 
          justifyContent: 'flex-start', 
          alignItems: 'flex-start', 
          display: 'flex'
        }}>
          <div style={{
            width: '100%', 
            paddingTop: 4, 
            paddingBottom: 4, 
            justifyContent: 'flex-start', 
            alignItems: 'center', 
            gap: 10, 
            display: 'flex'
          }}>
            <div style={{
              flex: '1 1 0', 
              color: '#F9F8FE', 
              fontSize: 16, 
              fontFamily: 'Overpass', 
              fontWeight: '700', 
              textTransform: 'uppercase', 
              lineHeight: '16px', 
              letterSpacing: 0.50
            }}>{displayName}</div>
          </div>
          {displayLastName && (
            <div style={{
              width: '100%', 
              paddingTop: 4, 
              paddingBottom: 4, 
              justifyContent: 'flex-start', 
              alignItems: 'center', 
              gap: 10, 
              display: 'flex'
            }}>
              <div style={{
                flex: '1 1 0', 
                color: '#F9F8FE', 
                fontSize: 16, 
                fontFamily: 'Overpass', 
                fontWeight: '700', 
                textTransform: 'uppercase', 
                lineHeight: '16px', 
                letterSpacing: 0.50
              }}>{displayLastName}</div>
            </div>
          )}
        </div>
        
        {/* Логотип клуба - в будущем пользователь сможет загрузить свой логотип */}
        <Image 
          src="/trenki_app.jpeg" 
          alt="Логотип клуба" 
          width={48} 
          height={48} 
          style={{borderRadius: 1}}
          className="object-cover"
        />
      </div>
      
      {/* Показываем потенциал только если профиль заполнен */}
      {false && userProfile && (
        <div style={{
          width: '100%', 
          justifyContent: 'flex-start', 
          alignItems: 'center', 
          gap: 4, 
          display: 'flex'
        }}>
          <Image 
            src="/icons/ant-design-thunderbolt-filled.svg" 
            alt="Потенциал" 
            width={16} 
            height={16} 
            style={{ alignSelf: 'center' }}
          />
          <div style={{
            color: '#F9F8FE', 
            fontSize: 12, 
            fontFamily: 'Overpass', 
            fontStyle: 'italic', 
            fontWeight: '800', 
            textTransform: 'uppercase', 
            lineHeight: '12px', 
            letterSpacing: 0.50,
            alignSelf: 'center'
          }}>потенциал:</div>
          <div style={{
            flex: '1 1 0', 
            height: 12, 
            position: 'relative',
            alignSelf: 'center'
          }}>
            <div style={{
              color: '#A1FF4A', 
              fontSize: 12, 
              fontFamily: 'Overpass', 
              fontStyle: 'italic', 
              fontWeight: '800', 
              textTransform: 'uppercase', 
              lineHeight: '12px', 
              letterSpacing: 0.50
            }}>{userProfile.potential}</div>
          </div>
        </div>
      )}
    </header>
  );
};

const HeroVideoSection = () => {
  const [randomVideo, setRandomVideo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRandomVideo = async () => {
      try {
        const response = await fetch('/api/videos');
        const data = await response.json();
        const videos = data.videos || [];
        
        if (videos.length > 0) {
          // Выбираем случайное видео
          const randomIndex = Math.floor(Math.random() * videos.length);
          setRandomVideo(videos[randomIndex]);
        }
      } catch (error) {
        console.error('Error loading random video:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRandomVideo();
  }, []);

  if (isLoading) {
    return (
      <section className="px-4" style={{ paddingBottom: '15px' }}>
        <div className="bg-gray-700/30 overflow-hidden relative aspect-video w-full animate-pulse" style={{ borderRadius: '4px' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-gray-700/20 via-gray-600/30 to-gray-700/20" />
        </div>
      </section>
    );
  }

  if (!randomVideo) {
    return null;
  }

  // Форматируем длительность видео
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <section className="px-4" style={{ paddingBottom: '15px' }}>
      <Link href={`/video/${randomVideo.id}`}>
        <div className="bg-gray-900 overflow-hidden relative aspect-video w-full cursor-pointer hover:opacity-90 transition-opacity" style={{ borderRadius: '4px' }}>
          {randomVideo.thumbnail && (
            <Image 
              src={randomVideo.thumbnail} 
              alt={randomVideo.title} 
              fill
              className="object-cover" 
            />
          )}
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            {formatDuration(randomVideo.duration)}
          </div>
        </div>
      </Link>
    </section>
  );
};

// Skeleton для шортсов
const ShortVideoSkeleton = () => (
  <div className="flex-shrink-0 w-36">
    <div 
      className="bg-gray-700/30 rounded overflow-hidden relative aspect-[9/16] animate-pulse" 
      style={{ borderRadius: '4px' }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-gray-700/20 via-gray-600/30 to-gray-700/20" />
    </div>
  </div>
);

const TrenkiSection = () => {
  const [shorts, setShorts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchShorts = async () => {
      try {
        const response = await fetch('/api/shorts');
        const data = await response.json();
        setShorts(data.shorts || []);
      } catch (error) {
        console.error('Error loading shorts:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchShorts();
  }, []);

  if (isLoading) {
    return (
      <section style={{ paddingTop: '15px', paddingBottom: '15px' }}>
        <div className="flex space-x-4 overflow-x-auto pb-4 px-4">
          {/* Показываем 3 skeleton loader */}
          <ShortVideoSkeleton />
          <ShortVideoSkeleton />
          <ShortVideoSkeleton />
        </div>
      </section>
    );
  }

  if (shorts.length === 0) {
    return null; // Не показываем секцию если нет shorts
  }

  return (
    <section style={{ paddingTop: '15px', paddingBottom: '15px' }}>
      <div className="flex space-x-4 overflow-x-auto pb-4 px-4">
        {shorts.map((short) => (
          <ShortVideoPlayer 
            key={short.id} 
            shortId={short.id}
            poster={short.thumbnail || '/images/preview_shorts/shorts_1.png'}
            title={short.title} 
          />
        ))}
      </div>
    </section>
  );
};

const TrainingsSection = () => (
    <section className="px-4" style={{ paddingBottom: '15px' }}>
        <div style={{width: '100%', height: '100%', flexDirection: 'column', gap: 8, display: 'flex'}}>
            {/* Нижний ряд - 2 колонки */}
            <div style={{width: '100%', height: '100%', justifyContent: 'center', alignItems: 'stretch', gap: 8, display: 'inline-flex'}}>
                <Link href="/training/assessment" style={{flex: '1 1 0', textDecoration: 'none', display: 'flex'}}>
                    <div style={{width: '100%', paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, background: 'linear-gradient(180deg, rgba(87, 108, 255, 0) 0%, rgba(87, 108, 255, 0.50) 100%)', overflow: 'hidden', borderRadius: 8, flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 8, display: 'flex', cursor: 'pointer', transition: 'all 0.2s'}}>
                        <Image 
                            src="/icons/icon-cards.svg" 
                            alt="ИИ тренер" 
                            width={16} 
                            height={16}
                        />
                        <div style={{alignSelf: 'stretch'}}>
                            <div style={{color: '#F9F8FE', fontSize: 14, fontFamily: 'Overpass', fontWeight: '700', textTransform: 'uppercase', lineHeight: '120%', letterSpacing: 0.50, wordWrap: 'break-word'}}>
                                персональный <span style={{color: '#A1FF4A'}}>ИИ</span> тренер
                            </div>
                        </div>
                    </div>
                </Link>
                <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'inline-flex'}}>
                    <div style={{alignSelf: 'stretch', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, background: 'rgba(68, 92, 255, 0.20)', overflow: 'hidden', borderRadius: 8, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex'}}>
                        <Image 
                            src="/icons/ant-design-thunderbolt-filled_f.svg" 
                            alt="Потенциал" 
                            width={16} 
                            height={16}
                        />
                        <div style={{width: 146, color: '#F9F8FE', fontSize: 14, fontFamily: 'Overpass', fontWeight: '700', textTransform: 'uppercase', lineHeight: '120%', letterSpacing: 0.50, wordWrap: 'break-word'}}>повышение потенциала</div>
                    </div>
                    <div style={{alignSelf: 'stretch', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, background: 'rgba(68, 92, 255, 0.20)', overflow: 'hidden', borderRadius: 8, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex'}}>
                        <Image 
                            src="/icons/icon-cards-kl.svg" 
                            alt="Треньки" 
                            width={16} 
                            height={16}
                        />
                        <div style={{alignSelf: 'stretch', color: '#F9F8FE', fontSize: 14, fontFamily: 'Overpass', fontWeight: '700', textTransform: 'uppercase', lineHeight: '120%', letterSpacing: 0.50, wordWrap: 'break-word'}}>треньки, советы профи, разборы</div>
                    </div>
                </div>
            </div>
        </div>
    </section>
);

const TrainersSection = () => {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        const response = await fetch('/api/trainers');
        const data = await response.json();
        const allTrainers = data.trainers || [];
        // Берем только первых 5 тренеров для отображения
        setTrainers(allTrainers.slice(0, 5));
        // Проверяем, есть ли еще тренеры
        setHasMore(allTrainers.length > 5);
      } catch (error) {
        console.error('Error loading trainers:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTrainers();
  }, []);

  if (isLoading) {
    return (
      <section style={{ paddingBottom: '15px' }}>
        <div style={{
          width: '100%',
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 24,
          paddingBottom: 24,
          background: 'linear-gradient(180deg, #101530 0%, #060919 100%)',
          borderRadius: 1,
          flexDirection: 'column',
          gap: 16,
          display: 'flex'
        }}>
          <div style={{ color: '#F9F8FE', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            тренеры
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="w-1/2 h-[202px] bg-gray-700/30 rounded-lg animate-pulse" />
            <div className="w-1/2 h-[202px] bg-gray-700/30 rounded-lg animate-pulse" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ paddingBottom: '15px' }}>
        <div style={{
            width: '100%', 
            paddingTop: 24, 
            paddingBottom: 24, 
            background: 'linear-gradient(180deg, #101530 0%, #060919 100%)', 
            borderRadius: 1, 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: 16, 
            display: 'flex',
            overflow: 'visible'
        }}>
            <div style={{
                width: '100%',
                paddingLeft: 16,
                paddingRight: 16,
                justifyContent: 'space-between', 
                alignItems: 'center', 
                display: 'flex'
            }}>
                <div style={{
                    color: '#F9F8FE', 
                    fontSize: 12, 
                    fontFamily: 'Overpass', 
                    fontWeight: '700', 
                    textTransform: 'uppercase', 
                    lineHeight: '14.40px', 
                    letterSpacing: 0.50
                }}>тренеры</div>
                <div style={{
                    width: 16, 
                    height: 16, 
                    position: 'relative', 
                    overflow: 'hidden'
                }}>
                    <Link href="/trainers">
                        <Image 
                            src="/icons/arrow.svg" 
                            alt="Стрелка" 
                            width={16} 
                            height={16}
                        />
                    </Link>
                </div>
            </div>
            <div style={{
                display: 'flex',
                gap: 16,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                width: '100%',
                paddingLeft: '16px',
                paddingRight: '16px'
            }} className="scrollbar-hide">
                {trainers.map((trainer) => (
                  <Link key={trainer.id} href={`/trainers/${trainer.id}`} style={{ flexShrink: 0 }}>
                    <div style={{
                      width: '170px', 
                      height: 202, 
                      paddingBottom: 8, 
                      background: '#060919', 
                      overflow: 'hidden', 
                      borderRadius: 8, 
                      flexDirection: 'column', 
                      justifyContent: 'flex-start', 
                      alignItems: 'flex-start', 
                      display: 'flex',
                      cursor: 'pointer'
                    }}>
                      <div style={{
                        width: '100%', 
                        height: 112, 
                        position: 'relative', 
                        background: 'linear-gradient(180deg, rgba(87, 108, 255, 0) 0%, rgba(87, 108, 255, 0.50) 100%)', 
                        overflow: 'hidden',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        <Image 
                            src={trainer.avatar || '/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png'} 
                            alt={trainer.name} 
                            width={100}
                            height={100}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                        <div style={{
                            width: 24, 
                            height: 24, 
                            left: 4, 
                            top: 4, 
                            position: 'absolute',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <Image 
                                src="/icons/star-6.svg" 
                                alt="Звезда рейтинга" 
                                width={24} 
                                height={24}
                                style={{ position: 'absolute' }}
                            />
                            <div style={{
                                position: 'relative',
                                zIndex: 1,
                                justifyContent: 'center', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                color: '#060919', 
                                fontSize: 10, 
                                fontFamily: 'Overpass', 
                                fontWeight: '400', 
                                textTransform: 'uppercase', 
                                lineHeight: '10px', 
                                letterSpacing: 0.50
                            }}>{trainer.rating}</div>
                        </div>
                    </div>
                    <div style={{
                        alignSelf: 'stretch', 
                        padding: 8, 
                        flexDirection: 'column', 
                        justifyContent: 'center', 
                        alignItems: 'flex-start', 
                        gap: 8, 
                        display: 'flex'
                    }}>
                        <div style={{
                            alignSelf: 'stretch', 
                            color: '#445CFF', 
                            fontSize: 14, 
                            fontFamily: 'Overpass', 
                            fontWeight: '700', 
                            textTransform: 'uppercase', 
                            lineHeight: '14px', 
                            letterSpacing: 0.50,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>{trainer.name}</div>
                        <div style={{
                            alignSelf: 'stretch', 
                            color: '#445CFF', 
                            fontSize: 14, 
                            fontFamily: 'Overpass', 
                            fontWeight: '700', 
                            textTransform: 'uppercase', 
                            lineHeight: '14px', 
                            letterSpacing: 0.50,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>{trainer.lastName}</div>
                    </div>
                    <div style={{
                        alignSelf: 'stretch', 
                        padding: 8, 
                        borderTop: '1px rgba(38, 37, 47, 0.50) solid', 
                        justifyContent: 'flex-start', 
                        alignItems: 'center', 
                        gap: 10, 
                        display: 'inline-flex'
                    }}>
                        <div style={{
                            flex: '1 1 0', 
                            justifyContent: 'center', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            color: '#F9F8FE', 
                            fontSize: 12, 
                            fontFamily: 'Overpass', 
                            fontWeight: '700', 
                            textTransform: 'uppercase', 
                            lineHeight: '12px', 
                            letterSpacing: 0.50
                        }}>{trainer.speciality}</div>
                    </div>
                  </div>
                  </Link>
                ))}
                {hasMore && (
                  <Link href="/trainers" style={{ flexShrink: 0 }}>
                    <div style={{
                      width: '170px',
                      height: 202,
                      background: '#060919',
                      borderRadius: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      border: '2px dashed #445CFF'
                    }}>
                      <div style={{
                        fontSize: 32,
                        color: '#445CFF'
                      }}>+</div>
                      <div style={{
                        color: '#445CFF',
                        fontSize: 14,
                        fontFamily: 'Overpass',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        padding: '0 16px'
                      }}>
                        Еще тренеры
                      </div>
                    </div>
                  </Link>
                )}
            </div>
        </div>
    </section>
  );
};

const PromoBannerSection = () => {
  const [randomVideo, setRandomVideo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRandomVideo = async () => {
      try {
        const response = await fetch('/api/videos');
        const data = await response.json();
        const videos = data.videos || [];
        
        if (videos.length > 0) {
          // Выбираем случайное видео
          const randomIndex = Math.floor(Math.random() * videos.length);
          setRandomVideo(videos[randomIndex]);
        }
      } catch (error) {
        console.error('Error loading random video:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRandomVideo();
  }, []);

  if (isLoading) {
    return (
      <section className="px-4">
        <div className="bg-gray-700/30 rounded-lg overflow-hidden relative aspect-video animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-700/20 via-gray-600/30 to-gray-700/20" />
        </div>
      </section>
    );
  }

  if (!randomVideo) {
    return null;
  }

  // Форматируем длительность видео
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <section className="px-4">
      <Link href={`/video/${randomVideo.id}`}>
        <div className="bg-[#2d3448] rounded-lg overflow-hidden relative aspect-video border border-[#3d4759] cursor-pointer hover:opacity-90 transition-opacity">
          {randomVideo.thumbnail && (
            <Image 
              src={randomVideo.thumbnail} 
              alt={randomVideo.title} 
              fill
              className="object-cover" 
            />
          )}
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
            {formatDuration(randomVideo.duration)}
          </div>
        </div>
      </Link>
    </section>
  );
};


export default HomePage;
