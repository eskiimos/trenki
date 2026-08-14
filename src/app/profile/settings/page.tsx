'use client';

/**
 * «Настройки» — всё, что не про личность и прогресс атлета, вынесено сюда из
 * профиля (решение босса). Профиль остаётся витриной: аватар, потенциал,
 * уровень, лига, история/задания. Здесь — конфигурация, помощь, аккаунт и
 * админ-инструменты.
 *
 * UI — по киту (/admin/ui-kit): .safe-top у шапки, .pb-nav у контента,
 * строки из @/components/profile/SettingsList, иконки только lucide.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Bell,
  Compass,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import AccountSwitcher from '@/components/AccountSwitcher';
import { Button, Input } from '@/components/ui';
import {
  ActionRow,
  FaqRow,
  NavRow,
  SettingsGroup,
  ToggleRow,
} from '@/components/profile/SettingsList';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTour } from '@/components/tour/TourProvider';
import { clearAuth } from '@/lib/auth';

const FAQ: Array<{ question: string; answer: string }> = [
  {
    question: 'Как часто можно тренироваться?',
    answer:
      'Рекомендуется тренироваться 3-5 раз в неделю с днями отдыха для восстановления. В приложении доступно до 2 тренировок в день.',
  },
  {
    question: 'Как растёт мой потенциал?',
    answer:
      'Потенциал растёт по мере выполнения тренировок и модулей. Система анализирует твой прогресс и автоматически обновляет характеристики: силу, выносливость, скорость, технику и гибкость.',
  },
  {
    question: 'Что такое модули тренировок?',
    answer:
      'Модули — это короткие тренировочные блоки по 10-15 минут, сфокусированные на конкретных навыках. Можно выполнить до 4 модулей в день.',
  },
  {
    question: 'Можно ли тренироваться без инвентаря?',
    answer:
      'Да! В приложении есть тренировки с собственным весом и минимальным инвентарём. Фильтруй тренировки по доступному оборудованию.',
  },
];

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { startTour } = useTour();
  const {
    isSupported,
    isSubscribed,
    isLoading: pushLoading,
    error: pushError,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  // Профиль нужен ровно ради двух полей: авто-генерации и роли (для
  // переключателя аккаунтов). Источник истины — сессионная cookie, поэтому
  // никаких telegramId в запросе.
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [autoGenError, setAutoGenError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  // Членство берём из атлетского /api/teams/my: /api/teams — тренерский
  // (requireCoach + команды, СОЗДАННЫЕ тренером), атлету он всегда отдавал 403.
  const [team, setTeam] = useState<{ id: string; name: string } | null>(null);
  const [teamStatus, setTeamStatus] = useState<'ACTIVE' | 'PENDING' | null>(null);
  const [teamLoaded, setTeamLoaded] = useState(false);

  // Инлайн-подтверждения вместо нативных confirm()/prompt(): те выглядят
  // чужеродно в PWA, а на iOS ещё и блокируются в standalone-режиме.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.user) {
          setRole(d.user.role ?? null);
          setHasProfile(!!d.user.profile);
          setAutoGenerate(!!d.user.profile?.autoGenerateMicrocycle);
        }
        setProfileLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setProfileLoaded(true);
      });

    fetch('/api/user/is-admin')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setIsAdmin(d?.isAdmin === true);
      })
      .catch(() => {});

    fetch('/api/teams/my', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.team) {
          setTeam({ id: d.team.id, name: d.team.name });
          setTeamStatus(d.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING');
        }
        setTeamLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setTeamLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAutoGenerate = async (next: boolean) => {
    setAutoGenError(null);
    setAutoGenerate(next); // оптимистично, при ошибке откатываем
    try {
      const res = await fetch('/api/profile/microcycle-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoGenerate: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setAutoGenerate(!next);
      setAutoGenError('Не удалось сохранить. Проверь связь и попробуй ещё раз.');
    }
  };

  // Работает и для отмены заявки: leave делает deleteMany по членству,
  // независимо от статуса (ACTIVE или PENDING).
  const leaveTeam = async () => {
    if (!team) return;
    setTeamBusy(true);
    setTeamError(null);
    try {
      const res = await fetch(`/api/teams/${team.id}/leave`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setTeam(null);
      setTeamStatus(null);
      setConfirmLeave(false);
    } catch {
      setTeamError('Не удалось покинуть команду. Попробуй ещё раз.');
    } finally {
      setTeamBusy(false);
    }
  };

  const logout = async () => {
    await clearAuth();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="bg-surface min-h-screen text-white pb-nav">
      {/* Шапка */}
      <div className="flex items-center gap-4 p-4 safe-top max-w-3xl md:mx-auto md:px-8">
        <Link href="/profile" aria-label="Назад в профиль" className="inline-flex">
          <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
        </Link>
        <h1 className="text-white text-xs font-bold font-overpass uppercase tracking-[0.5px]">
          Настройки
        </h1>
      </div>

      <div className="px-4 max-w-3xl md:mx-auto md:px-8">
        {/* ─── Тренировки ─── */}
        {(hasProfile || isSupported || !profileLoaded) && (
          <SettingsGroup
            title="Тренировки"
            hint={autoGenError ?? undefined}
            hintTone="danger"
          >
            {!profileLoaded ? (
              <div className="py-4 flex items-center gap-3" aria-hidden>
                <span className="h-5 w-5 rounded bg-white/10 animate-pulse shrink-0" />
                <span className="h-4 flex-1 rounded bg-white/10 animate-pulse" />
                <span className="h-6 w-11 rounded-full bg-white/10 animate-pulse shrink-0" />
              </div>
            ) : (
              hasProfile && (
                <ToggleRow
                  icon={RefreshCw}
                  label="Авто-генерация цикла"
                  hint="Новый недельный цикл собирается сам, без твоего участия"
                  checked={autoGenerate}
                  onChange={toggleAutoGenerate}
                />
              )
            )}

            {isSupported && (
              <ToggleRow
                icon={Bell}
                label={pushLoading ? 'Загрузка…' : 'Push-уведомления'}
                hint="Напоминания о тренировке и о том, что серия вот-вот сгорит"
                checked={isSubscribed}
                disabled={pushLoading}
                onChange={(next) => (next ? subscribe() : unsubscribe())}
              />
            )}
          </SettingsGroup>
        )}
        {pushError && (
          <p className="text-danger text-xs -mt-4 mb-6 px-1">{pushError}</p>
        )}

        {/* ─── Близкие ─── */}
        <SettingsGroup title="Близкие">
          <NavRow
            href="/profile/parents"
            icon={Users}
            label="Родителям"
            hint="Пригласи родителя — он увидит твой прогресс в своём кабинете"
          />
        </SettingsGroup>

        {/* ─── Команда ─── Тренеру не показываем: он команды создаёт, а не
             вступает в них (и его членства в TeamMember нет). */}
        {teamLoaded && role !== 'COACH' && (
          <SettingsGroup title="Команда" hint={teamError ?? undefined} hintTone="danger">
            {team ? (
              confirmLeave ? (
                <div className="py-4">
                  <p className="text-white text-sm leading-snug">
                    {teamStatus === 'PENDING'
                      ? `Отменить заявку в «${team.name}»?`
                      : `Покинуть команду «${team.name}»? Тренер перестанет видеть твой прогресс и присылать задания.`}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" onClick={leaveTeam} disabled={teamBusy}>
                      {teamBusy ? 'Секунду…' : teamStatus === 'PENDING' ? 'Отменить' : 'Покинуть'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmLeave(false)}>
                      Назад
                    </Button>
                  </div>
                </div>
              ) : (
                <ActionRow
                  icon={Shield}
                  label={teamStatus === 'PENDING' ? 'Отменить заявку' : 'Покинуть команду'}
                  hint={
                    teamStatus === 'PENDING'
                      ? `Заявка в «${team.name}» ждёт подтверждения тренера`
                      : `Ты в составе «${team.name}»`
                  }
                  onClick={() => setConfirmLeave(true)}
                  danger
                />
              )
            ) : (
              <>
                <ActionRow
                  icon={Shield}
                  label="Вступить в команду"
                  hint="Нужен код приглашения от тренера"
                  onClick={() => setJoinOpen((v) => !v)}
                />
                {joinOpen && (
                  <div className="pb-4">
                    {/* grid, а не flex: у <input> min-width:auto, и на 320px
                        флекс-строка вылезала за карточку вместе с кнопкой */}
                    <form
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const code = joinCode.trim().toUpperCase();
                        if (code) router.push(`/join/${encodeURIComponent(code)}`);
                      }}
                    >
                      <Input
                        className="min-w-0"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="Код приглашения"
                        autoCapitalize="characters"
                        autoComplete="off"
                        aria-label="Код приглашения"
                      />
                      <Button size="sm" type="submit" disabled={!joinCode.trim()}>
                        Войти
                      </Button>
                    </form>
                  </div>
                )}
              </>
            )}
          </SettingsGroup>
        )}

        {/* ─── Помощь ─── */}
        <SettingsGroup title="Помощь">
          {FAQ.map((f) => (
            <FaqRow key={f.question} question={f.question} answer={f.answer} />
          ))}
          <NavRow
            href="https://t.me/trenki_support"
            icon={MessageCircle}
            label="Поддержка в Telegram"
            hint="Ответим на вопрос, если ответа нет выше"
            external
          />
          <NavRow
            href="https://vk.com/mark_kovalevskiy"
            icon={Megaphone}
            label="Мы во ВКонтакте"
            external
          />
        </SettingsGroup>

        {/* ─── Аккаунт ─── */}
        <section className="mb-6">
          <h2 className="text-muted text-xs font-medium font-overpass uppercase tracking-wide mb-2 px-1">
            Аккаунт
          </h2>
          <div className="space-y-2">
            {/* Мульти-аккаунт: для админа/тренера показываем всегда (там же
                «+ Добавить»), обычному — только если аккаунтов уже несколько */}
            <AccountSwitcher hideWhenSingle={!(isAdmin || role === 'COACH')} />

            <div className="bg-night rounded-lg px-4">
              {confirmLogout ? (
                <div className="py-4">
                  <p className="text-white text-sm leading-snug">
                    Выйти из аккаунта? Чтобы вернуться, понадобится код из письма.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={logout}>
                      Выйти
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmLogout(false)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <ActionRow
                  icon={LogOut}
                  label="Выйти"
                  onClick={() => setConfirmLogout(true)}
                  danger
                />
              )}
            </div>
          </div>
        </section>

        {/* ─── Администратор ─── */}
        {isAdmin && (
          <SettingsGroup title="Администратор">
            <ActionRow
              icon={LayoutDashboard}
              label="Панель администратора"
              onClick={() => router.push('/admin')}
            />
            <ActionRow
              icon={Compass}
              label="Тур по приложению"
              hint="Пройти онбординг заново — начнётся с главной"
              onClick={() => {
                router.push('/');
                // даём главной смонтироваться, затем стартуем тур
                setTimeout(() => startTour(), 400);
              }}
            />
          </SettingsGroup>
        )}

        {/* Версия/помощь-подвал: сюда же лёгкая подсказка, где искать остальное */}
        <p className="text-muted/70 text-xs leading-snug px-1 flex items-start gap-2">
          <HelpCircle size={16} aria-hidden className="shrink-0 mt-0.5" />
          Личные данные, номер и клуб меняются в профиле — кнопка карандаша в шапке.
        </p>
      </div>

      <BottomNavigation activeTab="profile" />
    </div>
  );
}
