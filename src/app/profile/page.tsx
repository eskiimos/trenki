'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Flame, History, Plus, Settings, Smartphone, Sparkles, Star, Zap } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { ProfileSkeleton } from '../../components/Skeleton';
import { Button } from '@/components/ui';
import BottomNavigation from '@/components/BottomNavigation';
import PotentialRing from '@/components/PotentialRing';
import SubscriptionExpiryCard from '@/components/SubscriptionExpiryCard';
import EvolutionModal from '@/components/EvolutionModal';
import StatusPathModal from '@/components/StatusPathModal';
import TempoBadgeButton from '@/components/TempoBadgeButton';
import { AchievementIcon, StatusIcon } from '@/components/gamification/icons';
import LeagueTable from '@/components/LeagueTable';
import { ActionRow, NavRow, SettingsGroup } from '@/components/profile/SettingsList';
import InstallGuideSheet from '@/components/InstallGuideSheet';
import { isStandalone } from '@/lib/platform';
import { calculateAge } from '@/lib/age-utils';
import { plural } from '@/lib/plural';
import { awardTier, SHOWCASE_SLOTS, TIER_STYLE } from '@/lib/award-tier';
import { positionShort } from '@/lib/positions';
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
  // Инструкция «на экран Домой»: плашки на главной показываются один раз на
  // устройство, поэтому нужна постоянная точка входа. В установленном PWA не нужна.
  const [installOpen, setInstallOpen] = useState(false);
  const [installed, setInstalled] = useState(true);
  useEffect(() => {
    setInstalled(isStandalone());
  }, []);
  // Награды в шапке — ручной выбор игрока на /achievements (до SHOWCASE_SLOTS)
  const pinnedKeys: string[] = useMemo(
    () => (Array.isArray(userProfile?.pinnedAchievements) ? userProfile.pinnedAchievements : []),
    [userProfile],
  );
  // Счётчики наград для двух карточек-категорий
  const [awards, setAwards] = useState<{
    streakUnlocked: number;
    streakTotal: number;
    skillUnlocked: number;
    skillTotal: number;
    /** Обе группы целиком: витрина собирается на рендере (см. topAwards) */
    all: Array<{ key: string; title: string; unlocked: boolean }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gamification/achievements')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setAwards({
          streakUnlocked: d.streakUnlockedCount ?? 0,
          streakTotal: d.streakTotal ?? 0,
          skillUnlocked: d.unlockedCount ?? 0,
          skillTotal: d.total ?? 0,
          all: [...(d.streakAchievements ?? []), ...(d.achievements ?? [])],
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
  
  // Позиция сокращением (ЦН/ЛН/ПН/ЛЗ/ПЗ/ВР) — общий справочник
  const positionAbbr = positionShort(userProfile?.profile?.position);

  const displayAge = userProfile?.profile?.birthDate
    ? calculateAge(new Date(userProfile.profile.birthDate))
    : null;

  // Возраст · рост · вес — только заполненные поля
  const physical = [
    displayAge != null ? `${displayAge} ${plural(displayAge, ['год', 'года', 'лет'])}` : null,
    userProfile?.profile?.height ? `${userProfile.profile.height} см` : null,
    userProfile?.profile?.weight ? `${userProfile.profile.weight} кг` : null,
  ].filter((v): v is string => !!v);

  // Витрина наград: ТОЛЬКО то, что игрок сам выбрал (правка владельца «Начало
  // сентября»). Считается на рендере: профиль и награды приезжают параллельно.
  // Ключ, который больше не «получен» (история изменилась), молча пропускаем.
  const showcase = useMemo(() => {
    if (!awards) return [] as Array<{ key: string; title: string }>;
    const byKey = new Map(awards.all.map((a) => [a.key, a]));
    return pinnedKeys
      .map((k) => byKey.get(k))
      .filter((a): a is { key: string; title: string; unlocked: boolean } => !!a && a.unlocked)
      .slice(0, SHOWCASE_SLOTS);
  }, [awards, pinnedKeys]);

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
        {/* Карточка игрока (правка владельца: аватар меньше и слева, номер и
            позиция убраны как лишние цифры, справа — имя, возраст-рост-вес и
            общий потенциал). Под фото — выбранные игроком награды. */}
        <div className="mb-6 md:mb-0">
          <div className="bg-[#060919] rounded-lg p-4">
            <div className="flex items-start gap-4">
              {/* Аватар ~96px вместо прежних 358 на всю ширину */}
              <div className="shrink-0">
                <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-surface">
                  <Image
                    src={userProfile?.profile?.avatarUrl || '/avatars/Avatar.png'}
                    alt="Игрок"
                    fill
                    className="object-cover"
                  />
                  {/* Логотип клуба — небольшим бейджем в углу фото */}
                  {userProfile?.profile?.clubLogoUrl && (
                    <span className="absolute bottom-1 right-1 w-7 h-7 rounded-md bg-white flex items-center justify-center overflow-hidden">
                      <Image
                        src={userProfile.profile.clubLogoUrl}
                        alt=""
                        width={28}
                        height={28}
                        className="w-full h-full object-contain"
                      />
                    </span>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[#445CFF] text-lg font-bold font-overpass uppercase leading-tight break-words">
                  {isLoading ? 'Загрузка…' : `${displayName || 'ИМЯ'} ${displayLastName || ''}`.trim()}
                </div>
                <div className="text-[#AEABBB] text-sm font-medium font-overpass uppercase mt-2 flex items-center gap-2 flex-wrap">
                  {/* Позиция сокращением — правка владельца «Начало сентября» */}
                  {positionAbbr && (
                    <span
                      className="inline-flex items-center rounded-md px-2.5 text-[11px] font-black text-ink tracking-[0.5px]"
                      // «ПН» — одни заглавные, выносных элементов нет, поэтому при
                      // line-height 1 свободное место уходит вниз и текст сидит выше
                      // центра. Сверху даём на 2px больше — оптически ровно.
                      style={{
                        background: 'rgba(249,248,254,0.12)',
                        lineHeight: 1,
                        paddingTop: 6,
                        paddingBottom: 4,
                      }}
                      title="Игровое амплуа"
                    >
                      {positionAbbr}
                    </span>
                  )}
                  {/* Одной строкой через join: разделители получают гарантированные
                      пробелы (в JSX они схлопывались, выходило «28 лет ·177 см»),
                      а незаполненные поля просто выпадают, без прочерков. */}
                  <span>{physical.join(' · ')}</span>
                </div>
                {/* Общий потенциал числом — за подпиской он скрыт кольцом */}
                {!paywalled && typeof userProfile?.profile?.potential === 'number' && (
                  <div className="mt-2 inline-flex items-center gap-1.5">
                    <Zap size={16} className="text-brand" aria-hidden />
                    <span className="text-ink font-overpass font-black text-base tabular-nums">
                      {userProfile.profile.potential.toFixed(1)}
                    </span>
                    <span className="text-muted text-xs uppercase">потенциал</span>
                  </div>
                )}

              </div>
            </div>

            {/* Витрина наград — под фото, до SHOWCASE_SLOTS кружков без
                наложения (правка владельца «Начало сентября»: значки залезали
                друг на друга). Состав выбирает сам игрок на /achievements;
                справа один серый «+», пока есть место. Цвет значка — тир
                награды (серый/серебро/золото/эпик). */}
            <div className="mt-3 flex items-center gap-2" aria-label="Награды в шапке">
              {showcase.map((t) => {
                const st = TIER_STYLE[awardTier(t.key)];
                return (
                  <Link
                    key={t.key}
                    href="/achievements"
                    title={t.title}
                    aria-label={t.title}
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95"
                    style={{
                      background: st.background,
                      border: `1px solid ${st.border}`,
                      color: st.color,
                      boxShadow: st.shadow,
                    }}
                  >
                    <AchievementIcon achievementKey={t.key} size={18} />
                  </Link>
                );
              })}
              {/* Один «+», пока есть свободный слот (правка владельца: ряд из
                  пустых кружков занимал место). Пустая витрина — с подписью:
                  что делать, а если наград ещё нет — откуда они берутся. */}
              {showcase.length < SHOWCASE_SLOTS && (
                <Link
                  href="/achievements"
                  aria-label="Добавить награду в шапку"
                  className="flex items-center gap-2 min-w-0 transition-transform active:scale-95"
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-muted"
                    style={{
                      background: 'rgba(174,171,187,0.12)',
                      border: '1px solid rgba(174,171,187,0.25)',
                    }}
                  >
                    <Plus size={16} aria-hidden />
                  </span>
                  {showcase.length === 0 && awards && (
                    <span className="text-muted text-xs font-overpass truncate">
                      {awards.streakUnlocked + awards.skillUnlocked > 0
                        ? 'Добавь награду в шапку'
                        : 'Награды — за тренировки'}
                    </span>
                  )}
                </Link>
              )}
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
                отсчёт). Тап — объяснялка правила ×2 (правка владельца «Начало
                сентября»: раньше уводило на ачивки, и что такое «ударный темп»
                было непонятно). В родительском кабинете — статика. */}
            <div className="mb-3">
              <TempoBadgeButton streak={gamification.streak ?? 0} tempoActive={!!gamification.tempoActive} />
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{
                  width: `${Math.min(100, Math.round((gamification.xpIntoLevel / gamification.xpForNext) * 100))}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 mt-2">
              <span className="text-muted text-xs">
                XP: {gamification.xpIntoLevel}/{gamification.xpForNext} · до следующего уровня
              </span>
              {/* Откуда опыт: тренировки / модули / чек-ины / темп ×2 (правка владельца) */}
              <Link href="/profile/xp" className="text-brand text-xs font-bold font-overpass shrink-0">
                История XP
              </Link>
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

        {/* Награды: две категории (правка владельца) — «Ачивки» (серии,
            выходные, ранняя пташка) и «Достижения» (древо навыков).
            Обе ведут на /achievements с нужной вкладкой. */}
        <div className="mb-6">
          <h2 className="text-muted text-xs font-medium font-overpass uppercase tracking-wide mb-2 px-1">
            Награды
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/achievements?tab=streaks"
              className="rounded-2xl p-4 bg-night border border-[#26252F] flex flex-col items-center text-center transition-transform active:scale-95"
            >
              <Flame size={24} className="text-brand" aria-hidden />
              <span className="text-ink font-overpass font-bold text-sm mt-2">Ачивки</span>
              <span className="text-muted text-[11px] mt-0.5">
                {awards ? `${awards.streakUnlocked} из ${awards.streakTotal}` : 'серии и вехи'}
              </span>
            </Link>
            <Link
              href="/achievements?tab=skills"
              className="rounded-2xl p-4 bg-night border border-[#26252F] flex flex-col items-center text-center transition-transform active:scale-95"
            >
              <Sparkles size={24} className="text-brand" aria-hidden />
              <span className="text-ink font-overpass font-bold text-sm mt-2">Достижения</span>
              <span className="text-muted text-[11px] mt-0.5">
                {awards ? `${awards.skillUnlocked} из ${awards.skillTotal}` : 'древо навыков'}
              </span>
            </Link>
          </div>
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
            hint="Треньки, занятия и тренировки от ИИ"
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
          {!installed && (
            <ActionRow
              icon={Smartphone}
              label="Установить на телефон"
              hint="Иконка на экране «Домой» и напоминания"
              onClick={() => setInstallOpen(true)}
            />
          )}
        </SettingsGroup>
        <InstallGuideSheet open={installOpen} onClose={() => setInstallOpen(false)} />
      </div>

      {/* Тапбар */}
      <BottomNavigation activeTab="profile" />
    </div>
  );
};

export default ProfilePage;
