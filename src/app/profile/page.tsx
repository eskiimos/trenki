'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, History, Settings, Sparkles, Star } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { ProfileSkeleton } from '../../components/Skeleton';
import { Button } from '@/components/ui';
import BottomNavigation from '@/components/BottomNavigation';
import PotentialRing from '@/components/PotentialRing';
import SubscriptionExpiryCard from '@/components/SubscriptionExpiryCard';
import EvolutionModal from '@/components/EvolutionModal';
import StatusPathModal from '@/components/StatusPathModal';
import TempoBadge from '@/components/TempoBadge';
import { StatusIcon } from '@/components/gamification/icons';
import LeagueTable from '@/components/LeagueTable';
import { NavRow, SettingsGroup } from '@/components/profile/SettingsList';
import { calculateAge } from '@/lib/age-utils';
import { useSubscription } from '@/hooks/useSubscription';
import { openSubscriptionModal } from '@/lib/subscription-modal';

const ProfilePage = () => {
  const router = useRouter();
  const { user } = useTelegram();
  const { paywalled } = useSubscription();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentGains, setRecentGains] = useState<any>(null);
  // Геймификация: уровень/статус/XP. null — ещё грузится или ошибка (карточку не показываем).
  const [gamification, setGamification] = useState<{
    level: number;
    xpIntoLevel: number;
    xpForNext: number;
    status: { key: string; title: string; emoji: string };
    nextStatus: { title: string; minLevel: number } | null;
    /** Серия дней подряд (для отсчёта в бейдже темпа) */
    streak?: number;
    /** «Темп ×2»: серия ≥ 3 дней жива — весь XP дня удвоен */
    tempoActive?: boolean;
  } | null>(null);
  // Модалка «Путь хоккеиста» — открывается тапом по бейджу статуса
  const [statusPathOpen, setStatusPathOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gamification/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.status) setGamification(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Показываем скелетон во время загрузки
  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="bg-surface min-h-screen text-white">
      {/* Шапка: назад · заголовок · редактирование + настройки.
          Иконки — 24 (--icon-lg, дефолт кита для действий/хедеров). */}
      <div className="flex items-center justify-between gap-4 p-4 safe-top max-w-3xl md:mx-auto md:px-8">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" aria-label="На главную" className="inline-flex">
            <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
          </Link>
          <h1 className="text-white text-xs font-bold font-overpass leading-[120%] tracking-[0.5px] uppercase truncate">
            Профиль
          </h1>
        </div>

        <Link
          href="/profile/edit"
          aria-label="Редактировать профиль"
          className="inline-flex shrink-0 hover:opacity-80 transition-opacity"
        >
          <Image src="/icons/icon-edit.svg" alt="" width={24} height={24} />
        </Link>
      </div>

      {/* Основной контент */}
      <div className="px-4 pb-nav max-w-3xl md:mx-auto md:px-8">
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
          <div style={{ position: 'relative' }}>
            {/* Для FREE/paywalled потенциал серый и цифры скрыты (п.2) — grayed внутри PotentialRing */}
            <PotentialRing
              ratings={{
                power: userProfile?.profile?.ratingPower,
                speed: userProfile?.profile?.ratingSpeed,
                endurance: userProfile?.profile?.ratingEndurance,
                technique: userProfile?.profile?.ratingTechnique,
                flexibility: userProfile?.profile?.ratingFlexibility,
              }}
              potential={userProfile?.profile?.potential}
              grayed={paywalled}
              gains={{
                endurance: recentGains?.gainEndurance,
                technique: recentGains?.gainTechnique,
                power: recentGains?.gainPower,
                speed: recentGains?.gainSpeed,
                flexibility: recentGains?.gainFlexibility,
              }}
            />
            {paywalled && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: 20,
                  gap: 14,
                }}
              >
                <div style={{ color: '#F9F8FE', fontWeight: 800, fontSize: 14, lineHeight: 1.4, maxWidth: 280 }}>
                  Оформи подписку и получи доступ ко всем возможностям
                </div>
                <button
                  type="button"
                  onClick={() => openSubscriptionModal('potential')}
                  className="font-overpass uppercase transition-transform active:scale-95"
                  style={{
                    background: '#A1FF4A',
                    color: '#060919',
                    border: 'none',
                    borderRadius: 999,
                    padding: '12px 22px',
                    fontWeight: 900,
                    fontSize: 13,
                    letterSpacing: 0.3,
                    cursor: 'pointer',
                  }}
                >
                  Оформить подписку
                </button>
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Карточка уровня (геймификация): статус-«эволюция», уровень, XP-прогресс.
            Пока сводка не загрузилась — ничего не показываем (без скелетона). */}
        {gamification && (
          <div className="bg-surface rounded-2xl p-4 mb-6 border border-white/5">
            {/* Ряд 1: звание слева, уровень справа — как до бейджа темпа,
                чтобы на узких экранах (iPhone ~390) ничего не переносилось */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <button
                type="button"
                onClick={() => setStatusPathOpen(true)}
                aria-haspopup="dialog"
                className="inline-flex items-center gap-1.5 bg-brand text-night text-xs font-bold font-overpass uppercase rounded-full px-3 py-1 cursor-pointer transition-transform active:scale-95"
              >
                <StatusIcon statusKey={gamification.status.key} size={14} />
                {gamification.status.title}
              </button>
              <span className="text-white text-base font-bold font-overpass whitespace-nowrap shrink-0">
                Уровень {gamification.level}
              </span>
            </div>
            {/* Бейдж темпа — отдельной строкой, виден ВСЕГДА (активный ×2 или
                отсчёт). Тап открывает ачивки — эндпоинт только для своего юзера,
                поэтому кликабельно лишь в профиле (в родительском кабинете — статика). */}
            <div className="mb-3">
              {/* Тап по бейджу — страница ачивок (решение босса: страница, не модалка) */}
              <Link
                href="/achievements"
                className="inline-flex cursor-pointer transition-transform active:scale-95"
              >
                <TempoBadge streak={gamification.streak ?? 0} tempoActive={!!gamification.tempoActive} />
              </Link>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{
                  width: `${Math.min(100, Math.round((gamification.xpIntoLevel / gamification.xpForNext) * 100))}%`,
                }}
              />
            </div>
            <div className="text-muted text-xs mt-2">
              XP: {gamification.xpIntoLevel}/{gamification.xpForNext} · до следующего уровня
            </div>
            {gamification.nextStatus && (
              <div className="text-muted/70 text-xs mt-1">
                Следующее звание: {gamification.nextStatus.title} (ур. {gamification.nextStatus.minLevel})
              </div>
            )}
          </div>
        )}

        {/* Лига сверстников (по году рождения) — свой рейтинг недели,
            collapsible-паттерн как в родительском кабинете */}
        <div className="mb-6">
          <LeagueTable
            endpoint="/api/league"
            noBirthYearText="Укажи дату рождения в профиле, чтобы участвовать в лиге."
          />
        </div>

        {/* Модалка «Путь хоккеиста» — вся лестница званий, по тапу на бейдж */}
        {gamification && (
          <StatusPathModal
            currentLevel={gamification.level}
            open={statusPathOpen}
            onClose={() => setStatusPathOpen(false)}
          />
        )}


        {/* Модалка «Эволюция!» — при смене статуса с прошлого визита */}
        {gamification && (
          <EvolutionModal
            statusKey={gamification.status.key}
            title={gamification.status.title}
          />
        )}

        {/* Баннер «подписка скоро закончится» (п.5) — для премиума за 3 дня до конца */}
        <SubscriptionExpiryCard />

        {/* На планшете возвращаем нижний отступ после двухколоночного блока */}
        <div className="hidden md:block md:h-6" />

        {/* Кнопка для прохождения опроса потенциала */}
        {userProfile?.profile && (userProfile.profile.potential === undefined || userProfile.profile.potential < 10) && (
          <div className="mb-6">
            <Button variant="primary" fullWidth onClick={() => router.push('/onboarding/characteristics')}>
              <span className="inline-flex items-center justify-center gap-2">
                <Sparkles size={20} aria-hidden />
                Узнать свой потенциал
              </span>
            </Button>
          </div>
        )}

        {/* ─── Мои тренировки ─── */}
        <SettingsGroup title="Мои тренировки">
          <NavRow
            href="/profile/watch-history"
            icon={History}
            label="История тренировок"
            hint="Тренировки от ИИ-тренера и просмотренные видео"
          />
          {/* Избранное — отдельная страница (треньки + тренировки от ИИ) */}
          <NavRow
            href="/profile/favorites"
            icon={Star}
            label="Избранное"
            hint="Сохранённые тренировки и треньки"
          />
          <NavRow href="/profile/assignments" icon={ClipboardList} label="Задания от тренера" />
        </SettingsGroup>

        {/* Вход в настройки — последним блоком страницы, отдельной карточкой:
            в шапке шестерёнку не замечали. Подпись перечисляет содержимое,
            чтобы не приходилось угадывать, что внутри. */}
        <SettingsGroup>
          <NavRow
            href="/profile/settings"
            icon={Settings}
            label="Настройки"
            hint="Уведомления, родителям, команда, помощь, выход"
          />
        </SettingsGroup>
      </div>

      {/* Тапбар */}
      <BottomNavigation activeTab="profile" />
    </div>
  );
};

export default ProfilePage;
