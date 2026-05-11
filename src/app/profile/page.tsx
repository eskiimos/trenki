'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '../../hooks/useTelegram';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { ProfileSkeleton } from '../../components/Skeleton';
import BottomNavigation from '@/components/BottomNavigation';
import { clearAuth, getTelegramId } from '@/lib/auth';
import { calculateAge } from '@/lib/age-utils';

// ======================== PotentialSection ========================
// Чистый CSS/inline-SVG, без svg-файлов из /icons.
// Левая колонка — 5 характеристик (название + линия + кружок).
// Правая часть — большое кольцо общего потенциала с динамическим цветом
// и декоративными точками-маркерами по периметру.

interface PotentialSectionProps {
  ratingEndurance?: number;
  ratingTechnique?: number;
  ratingPower?: number;
  ratingSpeed?: number;
  ratingFlexibility?: number;
  potential?: number;
  gains?: {
    endurance?: number;
    technique?: number;
    power?: number;
    speed?: number;
    flexibility?: number;
  };
}

// Цвет в зависимости от значения потенциала (0-20 → orange, 20-50 → orange→yellow, 50-70 → yellow→green, 70+ → green)
function potentialColor(p: number): string {
  if (p <= 0) return '#AEABBB';
  if (p <= 20) return '#FF8C4A';
  if (p <= 50) {
    const t = (p - 20) / 30;
    const g = Math.round(140 + (201 - 140) * t);
    return `rgb(255,${g},74)`;
  }
  if (p < 70) {
    const t = (p - 50) / 20;
    const r = Math.round(255 + (161 - 255) * t);
    const g = Math.round(201 + (255 - 201) * t);
    return `rgb(${r},${g},74)`;
  }
  return '#A1FF4A';
}

interface CharRowProps {
  label: string;
  value?: number;
  gain?: number;
  /** отступ справа — круг сдвигается влево, линия становится короче */
  insetRight: number;
}

function CharRow({ label, value, gain, insetRight }: CharRowProps) {
  const hasValue = typeof value === 'number' && !Number.isNaN(value) && value > 0;
  const display = hasValue ? value!.toFixed(1) : '–';
  const hasGain = typeof gain === 'number' && !Number.isNaN(gain) && gain > 0;

  return (
    <div
      className="flex items-center"
      style={{ paddingRight: insetRight }}
    >
      <div
        className="text-white uppercase select-none shrink-0"
        style={{
          fontFamily: 'Overpass, sans-serif',
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: '0.5px',
          lineHeight: '100%',
        }}
      >
        {label}
      </div>

      {/* Соединительная линия — растягивается на оставшееся место */}
      <div
        style={{
          flex: 1,
          minWidth: 8,
          height: 1,
          background: 'linear-gradient(90deg, rgba(68,92,255,0) 0%, rgba(68,92,255,0.5) 50%, rgba(68,92,255,0.9) 100%)',
          marginLeft: 6,
          marginRight: -1,
        }}
      />

      {/* Маленький круг с числом */}
      <div className="relative shrink-0" style={{ width: 56, height: 56, zIndex: 2 }}>
        <svg viewBox="0 0 56 56" className="absolute inset-0 w-full h-full">
          {/* Внешнее тонкое кольцо */}
          <circle cx="28" cy="28" r="26" fill="none" stroke="#445CFF" strokeWidth="1.5" opacity="0.7" />
          {/* Внутренний slight glow */}
          <circle cx="28" cy="28" r="22" fill="rgba(68,92,255,0.06)" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hasGain && (
            <span
              className="font-overpass"
              style={{
                color: '#A1FF4A',
                fontWeight: 700,
                fontSize: 9,
                lineHeight: '100%',
                marginBottom: 1,
              }}
            >
              +{gain!.toFixed(1)}
            </span>
          )}
          <span
            className="font-overpass"
            style={{
              color: hasValue ? '#445CFF' : '#AEABBB',
              fontWeight: 900,
              fontSize: hasValue ? 16 : 18,
              lineHeight: '100%',
            }}
          >
            {display}
          </span>
        </div>
      </div>
    </div>
  );
}

function PotentialSection({
  ratingEndurance,
  ratingTechnique,
  ratingPower,
  ratingSpeed,
  ratingFlexibility,
  potential,
  gains,
}: PotentialSectionProps) {
  const p = potential || 0;
  const ringColor = potentialColor(p);

  // Большое кольцо
  const RING_SIZE = 144;
  const RING_RADIUS = 60;          // основное кольцо
  const RING_INNER_RADIUS = 52;    // декоративное внутреннее
  const RING_OUTER_RADIUS = 68;    // декоративное внешнее
  const DOTS_RADIUS = 72;          // радиус, на котором сидят точки
  const RING_CIRC = 2 * Math.PI * RING_RADIUS;

  // 10 точек — делят круг на 10 секторов (каждая = 10 единиц потенциала)
  const DOT_COUNT = 10;
  const dots = Array.from({ length: DOT_COUNT }, (_, i) => {
    const angle = (i / DOT_COUNT) * 2 * Math.PI - Math.PI / 2; // старт сверху
    const x = RING_SIZE / 2 + DOTS_RADIUS * Math.cos(angle);
    const y = RING_SIZE / 2 + DOTS_RADIUS * Math.sin(angle);
    return { x, y, key: i };
  });

  // Порядок согласно Figma: Выносливость, Техника, Сила, Скорость, Гибкость
  // insetRight: дуга, выгнутая ВЛЕВО (как ")"). Сила в центре имеет
  // самую короткую линию (круг ближе к лейблу), крайние строки — длиннее.
  const rows: CharRowProps[] = [
    { label: 'выносливость', value: ratingEndurance,   gain: gains?.endurance,   insetRight: 0  },
    { label: 'техника',      value: ratingTechnique,   gain: gains?.technique,   insetRight: 24 },
    { label: 'сила',         value: ratingPower,       gain: gains?.power,       insetRight: 40 },
    { label: 'скорость',     value: ratingSpeed,       gain: gains?.speed,       insetRight: 24 },
    { label: 'гибкость',     value: ratingFlexibility, gain: gains?.flexibility, insetRight: 0  },
  ];

  return (
    <div
      className="relative"
      style={{
        backgroundColor: '#060919',
        borderRadius: 12,
        padding: '18px 16px',
      }}
    >
      <div className="flex items-stretch gap-2">
        {/* Левая колонка — 5 характеристик */}
        <div className="flex-1 flex flex-col justify-between" style={{ minHeight: RING_SIZE + 32, gap: 10 }}>
          {rows.map((r) => (
            <CharRow key={r.label} {...r} />
          ))}
        </div>

        {/* Правая часть — большое кольцо */}
        <div className="relative shrink-0 self-center" style={{ width: RING_SIZE, height: RING_SIZE, zIndex: 1 }}>
          <svg
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="absolute inset-0 w-full h-full"
            style={{ transform: 'rotate(-90deg)' }}
          >
            {/* Внешнее декоративное тонкое кольцо */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_OUTER_RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="1"
              opacity="0.35"
            />
            {/* Внутреннее декоративное тонкое кольцо */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_INNER_RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="1"
              opacity="0.35"
            />
            {/* Базовое тёмное кольцо (фон под прогресс) */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="#1F2540"
              strokeWidth="6"
            />
            {/* Полоса заполнения */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(p / 100) * RING_CIRC} ${RING_CIRC}`}
              style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.6s ease' }}
            />
          </svg>

          {/* Декоративные точки — 10 шт, делят кольцо на 10 секторов */}
          <svg
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {dots.map((d) => (
              <circle
                key={d.key}
                cx={d.x}
                cy={d.y}
                r={2}
                fill={ringColor}
                opacity={0.55}
              />
            ))}
          </svg>

          {/* Внутренний контент */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="font-overpass"
              style={{
                color: ringColor,
                fontWeight: 900,
                fontSize: 32,
                lineHeight: '100%',
                transition: 'color 0.6s ease',
              }}
            >
              {p > 0 ? p.toFixed(1) : '–'}
            </div>
            <div
              className="font-overpass uppercase italic mt-1 text-center"
              style={{
                color: '#F9F8FE',
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: '0.5px',
                lineHeight: '110%',
              }}
            >
              общий
              <br />
              потенциал
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ======================== /PotentialSection ========================

const ProfilePage = () => {
  const router = useRouter();
  const { user } = useTelegram();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentGains, setRecentGains] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
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
          
          // Загружаем последние приросты
          if (data.user?.id) {
            fetchRecentGains(data.user.id);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Ошибка загрузки профиля:', error);
          setIsLoading(false);
        }
      }
    };

    const fetchRecentGains = async (userId: string) => {
      try {
        const response = await fetch(`/api/profile/recent-gains?userId=${userId}&limit=10`);
        if (response.ok) {
          const data = await response.json();
          setRecentGains(data.totalGains);
        }
      } catch (error) {
        console.error('Ошибка загрузки приростов:', error);
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

  useEffect(() => {
    const telegramId = getTelegramId();
    if (!telegramId) return;
    fetch(`/api/user/is-admin?telegramId=${telegramId}`)
      .then(r => r.json())
      .then(d => setIsAdmin(d.isAdmin === true))
      .catch(() => {});
  }, []);

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

  const displayAge = userProfile?.profile?.birthDate
    ? calculateAge(new Date(userProfile.profile.birthDate))
    : null;

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
      <div className="flex items-center justify-between p-4 max-w-3xl md:mx-auto md:px-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
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
          <div className="w-6 h-6 flex items-center justify-center hover:opacity-80 transition-opacity">
            <Image 
              src="/icons/icon-edit.svg" 
              alt="Редактировать профиль" 
              width={24} 
              height={24}
            />
          </div>
        </Link>
      </div>

      {/* Основной контент */}
      <div className="px-4 pb-32 max-w-3xl md:mx-auto md:px-8">
        {/* Верхний блок: на планшете аватар и потенциал — в 2 колонки */}
        <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
        {/* Профиль игрока - новый дизайн */}
        <div className="mb-6 md:mb-0">
          {/* Карточка аватара */}
          <div className="bg-[#060919] rounded-lg overflow-hidden">
            {/* Аватар пользователя */}
            <div className="w-full aspect-square relative">
              <Image 
                src={userProfile?.profile?.avatarUrl || "/avatars/Avatar.png"}
                alt="Игрок" 
                width={400} 
                height={400} 
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
                  src={userProfile?.profile?.clubLogoUrl || "/icons/icon-app.svg"}
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
                {displayAge ?? '-'} ЛЕТ | {userProfile?.profile?.height || '-'} СМ | {userProfile?.profile?.weight || '-'} КГ
              </div>
            </div>
          </div>
        </div>

        {/* Секция потенциала — pure CSS/SVG, повторяет дизайн из Figma */}
        <div className="mb-6 md:mb-0">
          <PotentialSection
            ratingEndurance={userProfile?.profile?.ratingEndurance}
            ratingTechnique={userProfile?.profile?.ratingTechnique}
            ratingPower={userProfile?.profile?.ratingPower}
            ratingSpeed={userProfile?.profile?.ratingSpeed}
            ratingFlexibility={userProfile?.profile?.ratingFlexibility}
            potential={userProfile?.profile?.potential}
            gains={{
              endurance: recentGains?.gainEndurance,
              technique: recentGains?.gainTechnique,
              power: recentGains?.gainPower,
              speed: recentGains?.gainSpeed,
              flexibility: recentGains?.gainFlexibility,
            }}
          />
        </div>
        </div>

        {/* На планшете возвращаем нижний отступ после двухколоночного блока */}
        <div className="hidden md:block md:h-6" />

        {/* Кнопка для прохождения опроса потенциала */}
        {userProfile?.profile && (userProfile.profile.potential === undefined || userProfile.profile.potential < 10) && (
          <div className="mb-6">
            <button
              onClick={() => router.push('/onboarding/characteristics')}
              className="w-full bg-gradient-to-r from-[#445CFF] to-[#A1FF4A] text-white font-bold font-overpass text-base py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
            >
              ✨ Узнать свой потенциал
            </button>
          </div>
        )}

        {/* Дневной прогресс - временно скрыто */}
        {false && userProfile?.profile?.potential !== undefined && userProfile?.profile?.potential > 0 && (
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
        <div className="bg-[#060919] rounded-lg px-4 mb-6">
          {/* ВРЕМЕННО СКРЫТО 
          <Link href="/training/history">
            <div className="flex justify-between items-center py-4 cursor-pointer hover:opacity-80 transition-opacity">
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
          
          <Link href="/favorites">
            <div className="flex justify-between items-center py-4 cursor-pointer hover:opacity-80 transition-opacity">
              <span className="text-white text-sm font-medium font-overpass uppercase tracking-wide">ИЗБРАННЫЕ ТРЕНИРОВКИ</span>
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
          */}
          
          <Link href="/profile/watch-history">
            <div className="flex justify-between items-center py-4 cursor-pointer hover:opacity-80 transition-opacity">
              <span className="text-white text-sm font-medium font-overpass uppercase tracking-wide">ИСТОРИЯ ПРОСМОТРОВ</span>
              <Image 
                src="/icons/arrow.svg" 
                alt="Стрелка" 
                width={20} 
                height={20}
                className="opacity-50"
              />
            </div>
          </Link>
        </div>
        
        {/* FAQ секция */}
        <div className="mb-6">
          <h2 className="text-white text-sm font-medium font-overpass uppercase tracking-wide mb-4">
            ЧАСТЫЕ ВОПРОСЫ
          </h2>
          <div className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            <FAQItem 
              question="Как часто можно тренироваться?" 
              answer="Рекомендуется тренироваться 3-5 раз в неделю с днями отдыха для восстановления. В приложении доступно до 2 тренировок в день."
            />
            <FAQItem 
              question="Как растет мой потенциал?" 
              answer="Потенциал растет по мере выполнения тренировок и модулей. Система анализирует ваш прогресс и автоматически обновляет характеристики: силу, выносливость, скорость, технику и гибкость."
            />
            <FAQItem 
              question="Что такое модули тренировок?" 
              answer="Модули — это короткие тренировочные блоки по 10-15 минут, сфокусированные на конкретных навыках. Вы можете выполнить до 4 модулей в день."
            />
            <FAQItem 
              question="Можно ли тренироваться без инвентаря?" 
              answer="Да! В приложении есть тренировки с собственным весом и минимальным инвентарем. Фильтруйте тренировки по доступному оборудованию."
            />
          </div>
        </div>

        {/* Служебные кнопки */}
        <div className="space-y-2">
          {/* Кнопка push-уведомлений */}
          {isSupported && (
            <div className="pt-2">
              <button 
                onClick={isSubscribed ? unsubscribe : subscribe}
                disabled={pushLoading}
                className={`w-full ${
                  isSubscribed 
                    ? 'bg-white/10 hover:bg-white/15' 
                    : 'bg-white/10 hover:bg-white/15'
                } text-white/70 font-medium py-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm`}
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
              className="w-full bg-white/10 hover:bg-white/15 text-white/70 font-medium py-3 rounded-lg transition-all duration-300 text-sm"
            >
              🚪 Выйти
            </button>
          </div>
          {/* Кнопка панели администратора */}
          {isAdmin && (
            <div className="pt-2">
              <button
                onClick={() => router.push('/admin')}
                className="w-full bg-[#A1FF4A]/10 hover:bg-[#A1FF4A]/20 text-[#A1FF4A] font-bold py-3 rounded-lg transition-all duration-300 text-sm"
              >
                ⚙️ Панель администратора
              </button>
            </div>
          )}        </div>
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
const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="bg-[#060919] rounded-lg overflow-hidden">
      <div 
        className="px-4 py-3 flex justify-between items-center cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-white text-sm font-normal font-overpass">{question}</span>
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 16 16" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg" 
          className={`flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M4 6L8 10L12 6" stroke="#AEABBB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {isOpen && (
        <div className="px-4 pb-3 pt-0">
          <p className="text-[#AEABBB] text-xs font-normal font-overpass leading-relaxed">
            {answer}
          </p>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
