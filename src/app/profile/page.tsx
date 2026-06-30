'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '../../hooks/useTelegram';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { ProfileSkeleton } from '../../components/Skeleton';
import { Button } from '@/components/ui';
import BottomNavigation from '@/components/BottomNavigation';
import AccountSwitcher from '@/components/AccountSwitcher';
import PotentialSection from '@/components/PotentialSection';
import { useTour } from '@/components/tour/TourProvider';
import { clearAuth, getTelegramId } from '@/lib/auth';
import { calculateAge } from '@/lib/age-utils';

const ProfilePage = () => {
  const router = useRouter();
  const { user } = useTelegram();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentGains, setRecentGains] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { startTour } = useTour();

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('/api/profile', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok || cancelled) {
          throw new Error('Ошибка загрузки профиля');
        }

        const data = await response.json();

        if (!cancelled) {
          setUserProfile(data.user);
          setIsLoading(false);

          if (data.user?.id) {
            fetchRecentGains();
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Ошибка загрузки профиля:', error);
          setIsLoading(false);
        }
      }
    };

    const fetchRecentGains = async () => {
      try {
        const response = await fetch('/api/profile/recent-gains?limit=10');
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

  // Команда атлета (для кнопки "Покинуть")
  const [athleteTeam, setAthleteTeam] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    fetch('/api/teams', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.teams?.[0]) setAthleteTeam({ id: d.teams[0].id, name: d.teams[0].name });
      })
      .catch(() => {});
  }, []);

  const handleLeaveTeam = async () => {
    if (!athleteTeam) return;
    if (!confirm(`Покинуть команду «${athleteTeam.name}»?`)) return;
    const res = await fetch(`/api/teams/${athleteTeam.id}/leave`, { method: 'DELETE' });
    if (res.ok) {
      setAthleteTeam(null);
    }
  };

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
  const handleLogout = async () => {
    if (confirm('Вы уверены, что хотите выйти?')) {
      await clearAuth();
      router.push('/login');
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
        <div className="mb-6 md:mb-0" data-tour="potential-ring">
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
            <Button variant="primary" fullWidth onClick={() => router.push('/onboarding/characteristics')}>
              ✨ Узнать свой потенциал
            </Button>
          </div>
        )}

        {/* ─── Навигация ─── */}
        <div className="mb-6">
          <h2 className="text-white/50 text-xs font-medium font-overpass uppercase tracking-wide mb-2 px-1">
            Навигация
          </h2>
          <div className="bg-[#060919] rounded-lg px-4">
            <Link href="/profile/watch-history">
              <div className="flex justify-between items-center py-4 cursor-pointer hover:opacity-80 transition-opacity">
                <span className="text-white text-sm font-medium font-overpass uppercase tracking-wide">История тренировок</span>
                <Image src="/icons/arrow.svg" alt="" width={20} height={20} className="opacity-50" />
              </div>
            </Link>
            <div className="h-[1px] bg-[#26252F]" />
            <button
              type="button"
              onClick={() => router.push('/profile/assignments')}
              className="w-full flex justify-between items-center py-4 cursor-pointer hover:opacity-80 transition-opacity text-left"
            >
              <span className="text-white text-sm font-medium font-overpass uppercase tracking-wide">Задания от тренера</span>
              <Image src="/icons/arrow.svg" alt="" width={20} height={20} className="opacity-50" />
            </button>
          </div>
        </div>

        {/* ─── Настройки ─── */}
        {(userProfile?.profile || isSupported) && (
          <div className="mb-6">
            <h2 className="text-white/50 text-xs font-medium font-overpass uppercase tracking-wide mb-2 px-1">
              Настройки
            </h2>
            <div className="bg-[#060919] rounded-lg px-4">
              {userProfile?.profile && (
                <button
                  type="button"
                  onClick={async () => {
                    const next = !userProfile.profile.autoGenerateMicrocycle;
                    // Оптимистично обновляем UI; если API упадёт — откатим.
                    setUserProfile((prev: any) =>
                      prev ? { ...prev, profile: { ...prev.profile, autoGenerateMicrocycle: next } } : prev,
                    );
                    try {
                      const res = await fetch('/api/profile/microcycle-preferences', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ autoGenerate: next }),
                      });
                      if (!res.ok) throw new Error();
                    } catch {
                      setUserProfile((prev: any) =>
                        prev ? { ...prev, profile: { ...prev.profile, autoGenerateMicrocycle: !next } } : prev,
                      );
                    }
                  }}
                  className="w-full flex justify-between items-center py-4 text-left"
                >
                  <span className="text-white text-sm font-medium font-overpass uppercase tracking-wide">Авто-генерация цикла</span>
                  <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${userProfile.profile.autoGenerateMicrocycle ? 'bg-[#A1FF4A]' : 'bg-white/20'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${userProfile.profile.autoGenerateMicrocycle ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </span>
                </button>
              )}
              {userProfile?.profile && isSupported && <div className="h-[1px] bg-[#26252F]" />}
              {isSupported && (
                <>
                  <button
                    type="button"
                    onClick={isSubscribed ? unsubscribe : subscribe}
                    disabled={pushLoading}
                    className="w-full flex justify-between items-center py-4 text-left disabled:opacity-50"
                  >
                    <span className="text-white text-sm font-medium font-overpass uppercase tracking-wide">
                      {pushLoading ? 'Загрузка…' : 'Push-уведомления'}
                    </span>
                    <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${isSubscribed ? 'bg-[#A1FF4A]' : 'bg-white/20'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isSubscribed ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </span>
                  </button>
                  {pushError && <p className="text-red-500 text-xs pb-2 text-center">{pushError}</p>}
                </>
              )}
            </div>
          </div>
        )}
        
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

        {/* ─── Аккаунт ─── */}
        <div className="mb-6">
          <h2 className="text-white/50 text-xs font-medium font-overpass uppercase tracking-wide mb-2 px-1">
            Аккаунт
          </h2>
          <div className="space-y-2">
            {/* Переключатель аккаунтов: для админа всегда (включая «+ Добавить»),
                для обычного — только если уже есть >=2 аккаунтов */}
            <AccountSwitcher hideWhenSingle={!(isAdmin || userProfile?.role === 'COACH')} />

            {/* Вступить в команду по коду / Покинуть команду */}
            {athleteTeam ? (
              <Button variant="ghost" size="sm" fullWidth onClick={handleLeaveTeam}>
                🚪 Покинуть команду «{athleteTeam.name}»
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => {
                  const code = prompt('Введи код приглашения');
                  if (code?.trim()) router.push(`/join/${code.trim().toUpperCase()}`);
                }}
              >
                👥 Вступить в команду
              </Button>
            )}

            {/* Обратная связь */}
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => window.open('https://t.me/trenki_support', '_blank', 'noopener,noreferrer')}
            >
              💬 Поддержка в Telegram
            </Button>
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => window.open('https://vk.com/mark_kovalevskiy', '_blank', 'noopener,noreferrer')}
              style={{ marginTop: 8 }}
            >
              🅥 Мы во ВКонтакте
            </Button>

            {/* Выход */}
            <Button variant="ghost" size="sm" fullWidth onClick={handleLogout}>
              🚪 Выйти
            </Button>
          </div>
        </div>

        {/* ─── Админ ─── */}
        {isAdmin && (
          <div className="mb-6 space-y-2">
            <Button variant="ghost" size="sm" fullWidth onClick={() => router.push('/admin')}>
              ⚙️ Панель администратора
            </Button>
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => {
                router.push('/');
                // даём главной смонтироваться, затем стартуем тур
                setTimeout(() => startTour(), 400);
              }}
            >
              🧭 Тур по приложению
            </Button>
          </div>
        )}
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
