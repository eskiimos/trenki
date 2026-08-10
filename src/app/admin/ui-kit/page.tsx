'use client';

// UI-кит «Треньки» — единая витрина дизайн-токенов и переиспользуемых
// компонентов. Цель: команда перестаёт гадать — здесь ЖИВЫЕ компоненты
// (импортируются реальные из src/components), а не их копии, поэтому кит
// всегда отражает продакшн. Доступ только админам: /admin/* уже закрыт
// middleware (admin_session) + серверной проверкой в src/app/admin/layout.tsx —
// дополнительный код авторизации на странице не нужен.

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// ── Живые UI-примитивы (единственный источник правды по вариантам) ──────────
import { Button, Card, Badge, Chip, Banner, Input } from '@/components/ui';

// ── Живые продуктовые/геймификейшн-компоненты ───────────────────────────────
import TempoBadge from '@/components/TempoBadge';
import PotentialRing from '@/components/PotentialRing';
import StatusPathModal from '@/components/StatusPathModal';
import EvolutionModal from '@/components/EvolutionModal';
import StreakChip from '@/components/StreakChip';
import LeagueTable from '@/components/LeagueTable';

// ── Наборы-справочники (документируем целиком, без живых данных юзера) ────────
import { STATUSES } from '@/lib/gamification';
import { ACHIEVEMENT_DEFS } from '@/lib/achievements';
import { StatusIcon, AchievementIcon } from '@/components/gamification/icons';

// ─────────────────────────────────────────────────────────────────────────────
// Токены цвета — hex взяты 1:1 из @theme в src/app/globals.css.
// ─────────────────────────────────────────────────────────────────────────────
const COLOR_TOKENS: Array<{ name: string; varName: string; hex: string; note: string }> = [
  { name: 'night', varName: '--color-night', hex: '#060919', note: 'фон страниц' },
  { name: 'surface', varName: '--color-surface', hex: '#101530', note: 'карточки/секции' },
  { name: 'elevated', varName: '--color-elevated', hex: '#0a0e1a', note: 'модалки / mobile-layout' },
  { name: 'brand', varName: '--color-brand', hex: '#A1FF4A', note: 'лайм-акцент: CTA, чипы, успех' },
  { name: 'brand-blue', varName: '--color-brand-blue', hex: '#445CFF', note: 'синий: тренеры, ссылки' },
  { name: 'ink', varName: '--color-ink', hex: '#F9F8FE', note: 'основной текст' },
  { name: 'muted', varName: '--color-muted', hex: '#AEABBB', note: 'вторичный текст / disabled' },
  { name: 'danger', varName: '--color-danger', hex: '#FF8C4A', note: 'ошибки/валидация' },
];

// Разделы для якорной навигации (sticky-бар сверху).
const NAV = [
  { id: 'colors', label: 'Цвета' },
  { id: 'type', label: 'Типографика' },
  { id: 'buttons', label: 'Кнопки' },
  { id: 'cards', label: 'Карточки' },
  { id: 'badges', label: 'Бейджи/чипы' },
  { id: 'banner', label: 'Баннер' },
  { id: 'inputs', label: 'Поля' },
  { id: 'gamification', label: 'Геймификация' },
];

// ── Мелкие хелперы витрины ──────────────────────────────────────────────────

// Заголовок раздела в стиле админ-дашборда (uppercase, tracking).
function SectionHeader({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-lg font-bold text-white uppercase tracking-wider mb-4 pt-2 border-t border-white/5"
    >
      {children}
    </h2>
  );
}

// Подпись раздела/подраздела.
function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-3">
      {children}
    </h3>
  );
}

// Моноширинная подпись «как использовать» под каждым блоком.
function Caption({ children }: { children: React.ReactNode }) {
  return (
    <code className="block mt-2 font-mono text-[11px] text-gray-500 break-words">{children}</code>
  );
}

// Ячейка-обёртка вокруг демо-элемента: рамка + подпись.
function Cell({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return (
    <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4">
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {caption && <Caption>{caption}</Caption>}
    </div>
  );
}

export default function UiKitPage() {
  // Баннер: демонстрация onDismiss — прячем и предлагаем показать снова.
  const [bannerVisible, setBannerVisible] = useState(true);

  // StatusPathModal управляется пропом open — держим его в локальном стейте.
  const [statusPathOpen, setStatusPathOpen] = useState(false);

  // EvolutionModal сам решает, показываться ли (сравнивает statusKey с
  // localStorage 'trenki_status_seen'), внешнего open-пропа НЕТ. Чтобы
  // продемонстрировать его по кнопке — «засеиваем» отличающийся seen-ключ и
  // МОНТИРУЕМ свежий экземпляр через key: на маунте его useEffect увидит, что
  // сохранённый ключ (__demo__) ≠ statusKey (pro), и откроется. Монтируем
  // только после нажатия, иначе модалка могла бы всплыть при загрузке страницы.
  const [evoNonce, setEvoNonce] = useState(0);
  const [evoMounted, setEvoMounted] = useState(false);
  const triggerEvolution = () => {
    try {
      localStorage.setItem('trenki_status_seen', '__demo__');
    } catch {}
    setEvoNonce((n) => n + 1);
    setEvoMounted(true);
  };

  // Пример характеристик для кольца потенциала (шкала 0–10; потенциал 0–100).
  const sampleRatings = { power: 7.2, speed: 6.5, endurance: 8.1, technique: 5.9, flexibility: 6.8 };

  return (
    <div
      className="min-h-screen bg-night text-white px-4 pb-16 md:px-8"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
    >
      <div className="max-w-5xl mx-auto">
        {/* ── Шапка: назад в админку + заголовок ── */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/admin" className="text-white hover:text-gray-300 transition-colors" aria-label="Назад в админку">
            <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">🎨 UI-кит</h1>
        </div>
        <p className="text-sm text-muted mb-4">
          Живые токены и компоненты «Треньки» — единый ориентир для команды. Всё ниже импортируется
          из реального кода (<code className="font-mono text-[11px]">src/components</code>).
        </p>

        {/* ── Sticky-навигация по разделам ── */}
        <nav className="sticky top-0 z-10 -mx-4 px-4 md:-mx-8 md:px-8 py-2 mb-8 bg-night/90 backdrop-blur border-b border-white/5 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 whitespace-nowrap">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-brand px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                {n.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="space-y-10">
          {/* ═══════════ 1. ЦВЕТА ═══════════ */}
          <section>
            <SectionHeader id="colors">Цвета</SectionHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {COLOR_TOKENS.map((t) => (
                <div key={t.name} className="rounded-xl bg-[#1a1f3a] border border-white/5 overflow-hidden">
                  <div className="h-20 w-full border-b border-white/5" style={{ background: t.hex }} />
                  <div className="p-3">
                    <div className="text-sm font-bold text-white">{t.name}</div>
                    <div className="font-mono text-xs text-brand">{t.hex}</div>
                    <div className="font-mono text-[10px] text-gray-500 mt-0.5">{t.varName}</div>
                    <div className="text-[11px] text-muted mt-1">{t.note}</div>
                  </div>
                </div>
              ))}
            </div>
            <Caption>{`bg-night · text-brand · style={{ background: 'var(--color-surface)' }}`}</Caption>
          </section>

          {/* ═══════════ 2. ТИПОГРАФИКА ═══════════ */}
          <section>
            <SectionHeader id="type">Типографика</SectionHeader>
            <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-5 space-y-5 font-overpass">
              <div>
                <div className="text-3xl font-bold text-ink">Заголовок H1 — Overpass Bold</div>
                <Caption>{`class="font-overpass text-3xl font-bold text-ink"`}</Caption>
              </div>
              <div>
                <div className="text-xl font-bold text-ink">Заголовок H2 — Overpass Bold</div>
                <Caption>{`class="font-overpass text-xl font-bold text-ink"`}</Caption>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-brand">Label · eyebrow · uppercase</div>
                <Caption>{`class="text-[11px] font-bold uppercase tracking-wider text-brand"`}</Caption>
              </div>
              <div>
                <div className="text-sm text-ink">
                  Основной текст (body). Быстрая лиса перепрыгнула через ленивого пса. 0123456789.
                </div>
                <Caption>{`class="text-sm text-ink"`}</Caption>
              </div>
              <div>
                <div className="text-sm text-muted">
                  Вторичный текст (muted) — подписи, подсказки, disabled-состояния.
                </div>
                <Caption>{`class="text-sm text-muted"`}</Caption>
              </div>
            </div>
          </section>

          {/* ═══════════ 3. КНОПКИ ═══════════ */}
          <section>
            <SectionHeader id="buttons">Кнопки</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Cell caption={`<Button>·<Button size="sm">`}>
                <Button>Primary MD</Button>
                <Button size="sm">Primary SM</Button>
              </Cell>
              <Cell caption={`<Button variant="ghost">·size="sm"`}>
                <Button variant="ghost">Ghost MD</Button>
                <Button variant="ghost" size="sm">Ghost SM</Button>
              </Cell>
              <Cell caption={`<Button disabled>·variant="ghost" disabled`}>
                <Button disabled>Disabled</Button>
                <Button variant="ghost" disabled>Ghost disabled</Button>
              </Cell>
              <Cell caption={`<Button fullWidth>`}>
                <div className="w-full space-y-2">
                  <Button fullWidth>Full width primary</Button>
                  <Button variant="ghost" fullWidth>Full width ghost</Button>
                </div>
              </Cell>
            </div>
          </section>

          {/* ═══════════ 4. КАРТОЧКИ ═══════════ */}
          <section>
            <SectionHeader id="cards">Карточки</SectionHeader>
            <SubHeader>Варианты (variant)</SubHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(['surface', 'outlined', 'accent', 'blue', 'stat'] as const).map((v) => (
                <div key={v}>
                  <Card variant={v} style={{ padding: 16 }}>
                    <div className="text-sm font-bold text-ink capitalize">{v}</div>
                    <div className="text-xs text-muted mt-1">Пример содержимого карточки.</div>
                  </Card>
                  <Caption>{`<Card variant="${v}">`}</Caption>
                </div>
              ))}
            </div>

            <SubHeader>Радиусы (radius: sm 8 · md 12 · lg 16 · xl 24)</SubHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['sm', 'md', 'lg', 'xl'] as const).map((r) => (
                <div key={r}>
                  <Card variant="outlined" radius={r} style={{ padding: 16, textAlign: 'center' }}>
                    <div className="text-sm font-bold text-ink uppercase">{r}</div>
                  </Card>
                  <Caption>{`radius="${r}"`}</Caption>
                </div>
              ))}
            </div>
          </section>

          {/* ═══════════ 5. БЕЙДЖИ / ЧИПЫ ═══════════ */}
          <section>
            <SectionHeader id="badges">Бейджи и чипы</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Cell caption={`<Badge variant="brand|solid|muted">`}>
                <Badge variant="brand">Brand</Badge>
                <Badge variant="solid">Solid</Badge>
                <Badge variant="muted">Muted</Badge>
              </Cell>
              <Cell caption={`<Chip active> · <Chip>`}>
                <Chip active>Активный</Chip>
                <Chip>Неактивный</Chip>
                <Chip active>Сила</Chip>
                <Chip>Скорость</Chip>
              </Cell>
            </div>
          </section>

          {/* ═══════════ 6. БАННЕР ═══════════ */}
          <section>
            <SectionHeader id="banner">Баннер</SectionHeader>
            {bannerVisible ? (
              <Banner
                icon={<span className="text-2xl">🔥</span>}
                title="Ударный темп активен"
                subtitle="Серия 3 дня подряд — весь опыт дня ×2"
                action={
                  <Button size="sm" onClick={() => alert('Действие баннера')}>
                    Ок
                  </Button>
                }
                onDismiss={() => setBannerVisible(false)}
              />
            ) : (
              <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4 text-sm text-muted flex items-center gap-3">
                Баннер скрыт (onDismiss).
                <Button variant="ghost" size="sm" onClick={() => setBannerVisible(true)}>
                  Показать снова
                </Button>
              </div>
            )}
            <Caption>{`<Banner icon title subtitle action onDismiss />`}</Caption>
          </section>

          {/* ═══════════ 7. ПОЛЯ ВВОДА ═══════════ */}
          {/* Реальные пропы Input: только pill?: boolean + нативные атрибуты
              <input>. Отдельных label/error нет — состояния показываем через
              placeholder / defaultValue / disabled и подписи рядом. */}
          <section>
            <SectionHeader id="inputs">Поля ввода</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted">Обычное (placeholder)</label>
                <div className="mt-1">
                  <Input placeholder="Введите текст…" />
                </div>
                <Caption>{`<Input placeholder="…" />`}</Caption>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted">С значением</label>
                <div className="mt-1">
                  <Input defaultValue="Артём Голубев" />
                </div>
                <Caption>{`<Input defaultValue="…" />`}</Caption>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted">Disabled</label>
                <div className="mt-1">
                  <Input disabled defaultValue="Недоступно" />
                </div>
                <Caption>{`<Input disabled />`}</Caption>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted">Pill (поиск)</label>
                <div className="mt-1">
                  <Input pill placeholder="Поиск…" />
                </div>
                <Caption>{`<Input pill placeholder="Поиск…" />`}</Caption>
              </div>
            </div>
            <p className="text-[11px] text-muted mt-3">
              Фокус — лайм-рамка (кликните в поле). Ошибок как отдельного пропа нет: валидацию
              рисуют вокруг поля через <code className="font-mono">--color-danger</code>.
            </p>
          </section>

          {/* ═══════════ 8. ГЕЙМИФИКАЦИЯ ═══════════ */}
          <section>
            <SectionHeader id="gamification">Геймификация</SectionHeader>

            <SubHeader>TempoBadge — оба состояния</SubHeader>
            <Cell caption={`<TempoBadge streak={n} tempoActive={bool} />`}>
              <TempoBadge streak={5} tempoActive />
              <TempoBadge streak={1} tempoActive={false} />
            </Cell>

            <SubHeader>PotentialRing — обычный и grayed (paywalled)</SubHeader>
            <div className="flex flex-wrap gap-6">
              <div style={{ width: 358, maxWidth: '100%' }}>
                <PotentialRing ratings={sampleRatings} potential={68} grayed={false} />
                <Caption>{`<PotentialRing ratings={…} potential={68} />`}</Caption>
              </div>
              <div style={{ width: 358, maxWidth: '100%' }}>
                <PotentialRing ratings={sampleRatings} potential={68} grayed />
                <Caption>{`<PotentialRing … grayed />  // FREE/paywalled`}</Caption>
              </div>
            </div>

            <SubHeader>Модалки</SubHeader>
            <Cell caption={`<StatusPathModal currentLevel open onClose /> · <EvolutionModal statusKey title />`}>
              <Button variant="ghost" size="sm" onClick={() => setStatusPathOpen(true)}>
                Открыть «Путь хоккеиста»
              </Button>
              <Button variant="ghost" size="sm" onClick={triggerEvolution}>
                Показать «Эволюцию!»
              </Button>
            </Cell>
            <StatusPathModal currentLevel={14} open={statusPathOpen} onClose={() => setStatusPathOpen(false)} />
            {evoMounted && (
              <EvolutionModal key={evoNonce} statusKey="pro" title="Про" />
            )}

            <SubHeader>Лестница статусов (STATUSES) — весь набор</SubHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {STATUSES.map((s) => (
                <div key={s.key} className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4 text-center">
                  <div className="flex justify-center text-brand" aria-hidden>
                    <StatusIcon statusKey={s.key} size={30} />
                  </div>
                  <div className="text-sm font-bold text-white mt-2">{s.title}</div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {s.minLevel === 1 ? 'старт' : `с ${s.minLevel} ур.`}
                  </div>
                  <div className="font-mono text-[10px] text-gray-600 mt-1">{s.key}</div>
                </div>
              ))}
            </div>
            <Caption>{`STATUSES из src/lib/gamification.ts`}</Caption>

            <SubHeader>Достижения (ACHIEVEMENT_DEFS) — весь набор</SubHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ACHIEVEMENT_DEFS.map((a) => (
                <div key={a.key} className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4 flex items-start gap-3">
                  <span className="text-brand leading-none mt-0.5 shrink-0" aria-hidden>
                    <AchievementIcon achievementKey={a.key} size={22} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">{a.title}</div>
                    <div className="text-xs text-muted mt-0.5">{a.description}</div>
                    <div className="font-mono text-[10px] text-gray-600 mt-1">{a.key}</div>
                  </div>
                </div>
              ))}
            </div>
            <Caption>{`ACHIEVEMENT_DEFS из src/lib/achievements.ts`}</Caption>

            {/* Самофетчащиеся компоненты — тянут данные текущего админа */}
            <SubHeader>Живые (тянут данные текущего админа)</SubHeader>
            <p className="text-[11px] text-muted mb-3">
              StreakChip и LeagueTable сами ходят в API и показывают реальные данные — у админа без
              истории тренировок могут быть пустыми (StreakChip при серии &lt; 1 не рендерится вовсе;
              LeagueTable раскрывается по клику и грузит таблицу).
            </p>
            <div className="space-y-3">
              <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-2">
                {/* StreakChip не принимает пропов — self-fetch /api/gamification/summary */}
                <StreakChip />
                <Caption>{`<StreakChip />  // self-fetch, пусто при streak < 1`}</Caption>
              </div>
              <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-3">
                {/* endpoint='/api/league' — «своя» лига атлета (профильный вариант) */}
                <LeagueTable endpoint="/api/league" noBirthYearText="Укажите дату рождения в профиле, чтобы участвовать в лиге." />
                <Caption>{`<LeagueTable endpoint="/api/league" />`}</Caption>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
