
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '../hooks/useTelegram';
import { apiCache } from '../lib/cache';
import { getTelegramId } from '@/lib/auth';
import BottomNavigation from '@/components/BottomNavigation';
import WorkoutReminder from '@/components/WorkoutReminder';
import AssignmentsBanner from '@/components/AssignmentsBanner';
import { Skeleton } from '@/components/Skeleton';

// Компонент для короткого видео
interface ShortVideoPlayerProps {
  shortId: string;
  poster: string;
  title: string;
  trainer?: {
    name: string;
    lastName: string;
    avatar?: string;
  };
}

const ShortVideoPlayer = ({ shortId, poster, title, trainer }: ShortVideoPlayerProps) => {
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
    const checkAuth = async () => {
      // На localhost в dev middleware пропускает без cookie — даём UI отрисоваться.
      const isLocalhost = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      if (isLocalhost) {
        setIsCheckingAuth(false);
        return;
      }

      // Источник истины — серверная сессия. localStorage может быть устаревшим:
      // полагаясь на него мы попадали в loop /login ↔ /.
      try {
        const res = await fetch('/api/users/me', { cache: 'no-store', credentials: 'include' });
        if (res.status === 401) {
          // на всякий случай чистим устаревший кеш, чтобы LoginPage не дёргался
          try { localStorage.removeItem('trenki_auth'); } catch {}
          router.replace('/login');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data?.role === 'COACH') {
            router.replace('/coach/team');
            return;
          }
        }
      } catch {
        // сетевая ошибка — пробуем показать страницу, чтобы не блокировать UI
      }
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
      
      {/* Контейнер с максимальной шириной для планшетов и десктопов */}
      <div className="max-w-4xl mx-auto">
        {/* Напоминание о незавершенной тренировке */}
        <WorkoutReminder />
        
        {/* Секция с короткими видео (треньки) */}
        <TrenkiSection />

        {/* Запланированная тренировка (за 1 час до старта) */}
        <ScheduledWorkoutSection />

        {/* Баннер с тренировками от тренера */}
        <AssignmentsBanner />

        {/* Каталог тренировок */}
        <TrainingsSection />

        {/* Список тренеров */}
        <TrainersSection />
        
        {/* Промо-баннер */}
        <AllVideosSection />
      </div>
      
      {/* Нижнее меню */}
      <BottomNavigation activeTab="home" />
    </div>
  );
};

const ScheduledWorkoutSection = () => {
  const router = useRouter();
  const [nextWorkout, setNextWorkout] = useState<any | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchNextWorkout = async () => {
      try {
        const telegramId = getTelegramId();

        if (!telegramId) return;

        const response = await fetch('/api/schedule', {
          headers: {
            'x-telegram-id': telegramId,
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        const now = Date.now();
        const oneHourFromNow = now + 60 * 60 * 1000;
        const upcoming = (data || [])
          .filter((item: any) => !item.completed)
          .map((item: any) => ({
            ...item,
            dateObj: new Date(item.date),
          }))
          .filter((item: any) => {
            const ts = item.dateObj.getTime();
            return ts > now && ts <= oneHourFromNow;
          })
          .sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime());

        if (isMounted) {
          setNextWorkout(upcoming[0] || null);
        }
      } catch (error) {
        console.error('Ошибка загрузки расписания:', error);
      }
    };

    fetchNextWorkout();
    const refreshInterval = setInterval(fetchNextWorkout, 60_000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    if (!nextWorkout) {
      setTimeLeftMs(null);
      return;
    }

    const updateTimer = () => {
      const diff = new Date(nextWorkout.date).getTime() - Date.now();
      setTimeLeftMs(diff);

      if (diff <= 0) {
        setNextWorkout(null);
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);

    return () => clearInterval(timerId);
  }, [nextWorkout]);

  if (!nextWorkout || timeLeftMs === null) return null;

  if (timeLeftMs <= 0) {
    return null;
  }

  const totalSeconds = Math.floor(timeLeftMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timerLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <section className="px-4 mb-4">
      <div className="self-stretch p-4 bg-gradient-to-b from-slate-900 to-slate-950 rounded-lg inline-flex flex-col justify-start items-start gap-4 overflow-hidden">
        <div className="self-stretch inline-flex justify-between items-start">
          <div className="flex-1 h-9 justify-center text-slate-50 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
            запланированная тренировка через
          </div>
          <div className="w-16 h-8 px-2 py-1 bg-lime-400/20 rounded-lg shadow-[inset_0px_1px_2px_0px_rgba(249,248,254,0.40)] flex justify-center items-center gap-4">
            <div className="justify-center text-lime-400 text-base font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
              {timerLabel}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/video/${nextWorkout.video?.id}?fromWorkout=true`)}
          className="self-stretch h-12 px-6 py-3 bg-[#A1FF4A] rounded-[32px] inline-flex justify-center items-center gap-2.5"
        >
          <div className="justify-center text-slate-950 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
            начать
          </div>
        </button>
      </div>
    </section>
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
            profileData.clubLogoUrl = cachedData.user.profile.clubLogoUrl;
          } else if (cachedData.user.profile) {
            profileData.clubLogoUrl = cachedData.user.profile.clubLogoUrl;
          }
          
          setUserProfile(profileData);
          
          // Обновляем authData если данные из базы отличаются — без reload
          if (authData && (authData.firstName !== cachedData.user.firstName || authData.lastName !== cachedData.user.lastName)) {
            const { saveAuth } = require('@/lib/auth');
            saveAuth({
              telegramId: cachedData.user.telegramId,
              firstName: cachedData.user.firstName,
              lastName: cachedData.user.lastName,
              username: cachedData.user.username,
            });
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
            profileData.clubLogoUrl = data.user.profile.clubLogoUrl;
            console.log('🏢 Club logo URL from API:', data.user.profile.clubLogoUrl);
          } else if (data.user.profile) {
            profileData.clubLogoUrl = data.user.profile.clubLogoUrl;
          }
          
          setUserProfile(profileData);
          console.log('👤 Final userProfile set:', profileData);
          
          // Обновляем authData если данные из базы отличаются — без reload
          if (authData && (authData.firstName !== data.user.firstName || authData.lastName !== data.user.lastName)) {
            const { saveAuth } = require('@/lib/auth');
            saveAuth({
              telegramId: data.user.telegramId,
              firstName: data.user.firstName,
              lastName: data.user.lastName,
              username: data.user.username,
            });
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
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
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
        
        {/* Логотип клуба или логотип приложения */}
        <Image 
          src={userProfile?.clubLogoUrl || "/icons/icon-app.svg"} 
          alt={userProfile?.clubLogoUrl ? "Логотип клуба" : "Треньки"} 
          width={48} 
          height={48} 
          style={{borderRadius: 4}}
          className="object-cover"
          onError={(e) => {
            console.log('❌ Image load error, clubLogoUrl:', userProfile?.clubLogoUrl);
            e.currentTarget.src = "/icons/icon-app.svg";
          }}
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

const ShortVideoSkeleton = () => (
  <div className="flex-shrink-0 w-36">
    <Skeleton
      width=""
      height=""
      className="aspect-9/16"
      style={{ width: '100%', borderRadius: 4 }}
    />
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
        <h2 className="px-4 text-white font-semibold mb-3" style={{ fontSize: '12px' }}>КОРОТКИЕ ВИДЕО</h2>
        <div className="flex space-x-4 overflow-x-auto pb-4 px-4">
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
      <h2 className="px-4 text-white font-semibold mb-3" style={{ fontSize: '12px' }}>КОРОТКИЕ ВИДЕО</h2>
      <div className="flex space-x-4 overflow-x-auto pb-4 px-4">
        {shorts.map((short) => (
          <ShortVideoPlayer 
            key={short.id} 
            shortId={short.id}
            poster={short.thumbnail || '/images/preview_shorts/shorts_1.png'}
            title={short.title}
            trainer={short.trainer ? {
              name: short.trainer.name,
              lastName: short.trainer.lastName,
              avatar: short.trainer.avatar
            } : undefined}
          />
        ))}
      </div>
    </section>
  );
};

const TrainingsSection = () => (
    <section className="px-4" style={{ paddingBottom: '15px' }}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2">
            {/* Блок ИИ тренера - на мобилке во всю ширину, на планшете 1 из 3 */}
            <Link href="/training/assessment" style={{textDecoration: 'none'}} className="col-span-2 sm:col-span-1">
                <div style={{width: '100%', height: 100, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, background: 'rgba(68, 92, 255, 0.20)', overflow: 'hidden', borderRadius: 8, flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', display: 'flex', cursor: 'pointer'}}>
                    <Image
                        src="/icons/icon-cards.svg"
                        alt="ИИ тренер"
                        width={24}
                        height={24}
                    />
                    <div style={{color: '#F9F8FE', fontSize: 14, fontFamily: 'Overpass', fontWeight: '700', textTransform: 'uppercase', lineHeight: '120%', letterSpacing: 0.50}}>
                        персональный <span style={{color: '#A1FF4A'}}>ИИ</span> тренер
                    </div>
                </div>
            </Link>
            
            {/* Блок "Повышение потенциала" */}
            <Link href="/video" style={{textDecoration: 'none'}} className="sm:col-span-1">
                <div style={{width: '100%', height: 100, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, background: 'rgba(68, 92, 255, 0.20)', overflow: 'hidden', borderRadius: 8, flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', display: 'flex'}}>
                    <Image
                        src="/icons/ant-design-thunderbolt-filled_f.svg"
                        alt="Потенциал"
                        width={16}
                        height={16}
                    />
                    <div style={{color: '#F9F8FE', fontSize: 14, fontFamily: 'Overpass', fontWeight: '700', textTransform: 'uppercase', lineHeight: '120%', letterSpacing: 0.50, wordWrap: 'break-word'}}>повышение потенциала</div>
                </div>
            </Link>
            
            {/* Блок "Треньки" */}
            <Link href="/shorts-catalog" style={{textDecoration: 'none'}} className="sm:col-span-1">
                <div style={{width: '100%', height: 100, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, background: 'rgba(68, 92, 255, 0.20)', overflow: 'hidden', borderRadius: 8, flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', display: 'flex'}}>
                    <Image
                        src="/icons/icon-cards-kl.svg"
                        alt="Треньки"
                        width={16}
                        height={16}
                    />
                    <div style={{color: '#F9F8FE', fontSize: 14, fontFamily: 'Overpass', fontWeight: '700', textTransform: 'uppercase', lineHeight: '120%', letterSpacing: 0.50, wordWrap: 'break-word'}}>треньки, советы профи, разборы</div>
                </div>
            </Link>
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
        let allTrainers = data.trainers || [];
        // Перемешиваем тренеров рандомно
        allTrainers = allTrainers.sort(() => Math.random() - 0.5);
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
          paddingTop: 24,
          background: 'linear-gradient(180deg, #101530 0%, #060919 100%)',
          flexDirection: 'column',
          gap: 16,
          display: 'flex',
        }}>
          <div style={{
            width: '100%',
            paddingLeft: 16,
            paddingRight: 16,
            color: '#F9F8FE',
            fontSize: 12,
            fontFamily: 'Overpass',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            lineHeight: '14.4px',
          }}>тренеры</div>
          <div style={{
            display: 'flex',
            gap: 16,
            overflowX: 'auto',
            paddingLeft: 16,
            paddingRight: 16,
          }} className="scrollbar-hide">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ width: 170, flexShrink: 0 }}>
                <Skeleton width="" height="" style={{ width: 170, height: 170, borderRadius: 8 }} />
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skeleton width="" height="" style={{ width: '70%', height: 14, borderRadius: 4 }} />
                  <Skeleton width="" height="" style={{ width: '55%', height: 14, borderRadius: 4 }} />
                </div>
                <div style={{ padding: 8, borderTop: '1px rgba(38, 37, 47, 0.50) solid' }}>
                  <Skeleton width="" height="" style={{ width: '65%', height: 12, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ paddingBottom: '0px' }}>
        <div style={{
            width: '100%', 
            paddingTop: 24, 
            paddingBottom: 0, 
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
                    width: 24, 
                    height: 24, 
                    position: 'relative', 
                    overflow: 'hidden'
                }}>
                    <Link href="/trainers">
                        <Image 
                            src="/icons/action-arrow-right.svg" 
                            alt="Стрелка" 
                            width={24} 
                            height={24}
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
                      height: 'auto',
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
                        width: '170px', 
                        height: '170px',
                        position: 'relative', 
                        background: 'linear-gradient(180deg, rgba(87, 108, 255, 0) 0%, rgba(87, 108, 255, 0.50) 100%)', 
                        overflow: 'hidden',
                        borderRadius: 8
                    }}>
                        <Image 
                            src={trainer.avatar || '/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png'} 
                            alt={trainer.name} 
                            fill
                            sizes="170px"
                            style={{
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
                  <Link href="/trainers" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{
                      width: 32,
                      height: 202,
                      background: 'transparent',
                      borderRadius: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}>
                      <div style={{
                        fontSize: 24,
                        color: '#445CFF',
                        fontWeight: 'bold'
                      }}>→</div>
                    </div>
                  </Link>
                )}
            </div>
        </div>
    </section>
  );
};

// Компонент карточки видео для горизонтальной прокрутки
interface VideoCardProps {
  video: any;
}

const VideoCard = ({ video, isNew }: VideoCardProps & { isNew?: boolean }) => {
  // Форматируем длительность видео
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Link href={`/video/${video.id}`}>
      {/* На мобиле карточка ~80% viewport, чтобы справа выглядывала
          следующая — визуальный hint что список горизонтально скроллится. */}
      <div className="flex-shrink-0 w-[80vw] sm:w-[calc(50vw-1rem)] cursor-pointer">
        {/* Video Thumbnail */}
        <div className="relative rounded overflow-hidden" style={{ width: '100%', height: 'auto', aspectRatio: '16/9', maxHeight: '280px' }}>
          {video.thumbnail && (
            <Image 
              src={video.thumbnail} 
              alt={video.title} 
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          )}
          {/* Duration badge */}
          <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-sm font-medium px-2.5 py-1 rounded-lg">
            {formatDuration(video.duration)}
          </div>
          {/* "Новинка" badge */}
          {isNew && (
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: '#A1FF4A', color: '#060919' }}>
              Новинка
            </div>
          )}
        </div>
        
        {/* Video Info */}
        <div className="px-0 py-3">
          {/* Trainer Avatar + Title на одной строке */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-700">
              {video.trainer?.avatar ? (
                <Image
                  src={video.trainer.avatar}
                  alt={`${video.trainer.name} ${video.trainer.lastName}`}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                  {video.trainer?.name?.charAt(0)}
                </div>
              )}
            </div>
            <h3 className="text-white text-base font-semibold line-clamp-2 leading-tight flex-1">
              {video.title.toUpperCase()}
            </h3>
          </div>
          
          {/* Trainer info */}
          <div style={{ fontSize: '12px' }} className="text-white/60">
            <span>
              {video.trainer?.name} {video.trainer?.lastName}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

const VideoCardSkeleton = () => (
  <div className="flex-shrink-0 w-[80vw] sm:w-[calc(50vw-1rem)]">
    <Skeleton
      width=""
      height=""
      style={{ width: '100%', aspectRatio: '16/9', maxHeight: 280, borderRadius: 4 }}
    />
    <div className="px-0 py-3">
      <div className="flex items-center gap-3 mb-2">
        <Skeleton width="" height="" style={{ width: 40, height: 40, borderRadius: 999 }} />
        <Skeleton width="" height="" style={{ flex: 1, height: 16, borderRadius: 4 }} />
      </div>
      <Skeleton width="" height="" style={{ width: 96, height: 12, borderRadius: 4 }} />
    </div>
  </div>
);

const AllVideosSection = () => {
  const [videos, setVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch('/api/videos');
        const data = await response.json();
        let allVideos = data.videos || [];
        
        if (allVideos.length > 0) {
          // Сортируем по дате создания - новые сначала
          allVideos = allVideos.sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA; // Десь в фирст - новые
          });
          // Показываем все видео
          setVideos(allVideos);
        }
      } catch (error) {
        console.error('Error loading videos:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVideos();
  }, []);

  // Автоскроллинг видео
  useEffect(() => {
    if (!scrollContainerRef.current || videos.length === 0 || isLoading || hasUserInteracted) return;

    const scrollContainer = scrollContainerRef.current;

    // Слушаем события скролла пользователя
    const handleUserScroll = () => {
      setHasUserInteracted(true);
    };

    scrollContainer.addEventListener('scroll', handleUserScroll);
    scrollContainer.addEventListener('touchstart', handleUserScroll);

    // Автоскроллинг каждые 4 секунды
    const autoScrollInterval = setInterval(() => {
      if (scrollContainer && !hasUserInteracted) {
        // Скроллим на ширину одного видео (примерно ширина экрана - 2rem)
        const scrollAmount = window.innerWidth - 32;
        
        scrollContainer.scrollBy({
          left: scrollAmount,
          behavior: 'smooth'
        });

        // Если достигли конца, возвращаемся в начало
        if (
          scrollContainer.scrollLeft + scrollContainer.clientWidth >=
          scrollContainer.scrollWidth - 10
        ) {
          scrollContainer.scrollTo({
            left: 0,
            behavior: 'smooth'
          });
        }
      }
    }, 4000);

    return () => {
      clearInterval(autoScrollInterval);
      scrollContainer.removeEventListener('scroll', handleUserScroll);
      scrollContainer.removeEventListener('touchstart', handleUserScroll);
    };
  }, [videos, isLoading, hasUserInteracted]);

  if (isLoading) {
    return (
      <section className="px-4" style={{ paddingTop: '15px', paddingBottom: '15px' }}>
        <div className="flex space-x-4 overflow-x-auto pb-4 snap-x snap-mandatory">
          {/* Показываем 5 skeleton loader */}
          <div className="snap-start">
            <VideoCardSkeleton />
          </div>
          <div className="snap-start">
            <VideoCardSkeleton />
          </div>
          <div className="snap-start">
            <VideoCardSkeleton />
          </div>
          <div className="snap-start">
            <VideoCardSkeleton />
          </div>
          <div className="snap-start">
            <VideoCardSkeleton />
          </div>
        </div>
      </section>
    );
  }

  if (videos.length === 0) {
    return null;
  }

  return (
    <section className="px-4" style={{ paddingTop: '15px', paddingBottom: '15px' }}>
      <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
      }}>
          <h2 className="text-white font-semibold" style={{ fontSize: '12px', paddingLeft: '0px', paddingRight: '0px', margin: 0 }}>ТРЕНИРОВКИ</h2>
          <Link href="/video">
              <Image 
                  src="/icons/action-arrow-right.svg" 
                  alt="Перейти ко всем" 
                  width={24} 
                  height={24}
              />
          </Link>
      </div>
      <div 
        ref={scrollContainerRef}
        className="flex space-x-4 overflow-x-auto pb-4 snap-x snap-mandatory"
      >
        {videos.map((video, index) => (
          <div key={video.id} className="snap-start">
            <VideoCard video={video} isNew={index === 0} />
          </div>
        ))}
      </div>
    </section>
  );
};


export default HomePage;
