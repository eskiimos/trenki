'use client';

// Экраны-превью приложения для лендинга. Это РЕАЛЬНЫЕ UI-компоненты с демо-
// данными (кольцо потенциала и график-волна — настоящие компоненты приложения).
// Рендерятся на публичных роутах /preview/[screen] и встраиваются в телефон-
// фреймы лендинга через iframe (живой превью, обновляется вместе с приложением).

import React from 'react';
import MicrocycleWave from '@/components/MicrocycleWave';
import PotentialSection from '@/components/PotentialSection';

const LIME = '#A1FF4A';
const BLUE = '#445CFF';

function ScreenHeader({ title }: { title: string }) {
  return (
    <div className="px-4 pb-2 pt-1" style={{ borderBottom: '1px solid #101530' }}>
      <div className="font-overpass uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', color: '#F9F8FE' }}>{title}</div>
    </div>
  );
}

function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className="font-overpass uppercase" style={{
      display: 'inline-block', padding: '7px 12px', borderRadius: 32, fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
      background: active ? LIME : 'rgba(174,171,187,0.18)', color: active ? '#060919' : '#F9F8FE',
      border: active ? 'none' : '1px solid rgba(174,171,187,0.2)', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

const DAY_MOCK = [
  { d: 'Пн', emoji: '⚡️', label: 'Стандарт' },
  { d: 'Вт', emoji: '🏃', label: 'Зарядка' },
  { d: 'Ср', emoji: '🔋', label: 'Овертайм' },
  { d: 'Чт', emoji: '🧘', label: 'Раскисление' },
  { d: 'Пт', emoji: '😴', label: 'Лёгкая нагрузка' },
];

export function MockAssessment() {
  return (
    <div style={{ paddingTop: 8 }}>
      <ScreenHeader title="ИИ-тренер" />
      <div className="px-4 pt-4">
        <div className="font-overpass uppercase" style={{ fontSize: 10, fontWeight: 700, color: '#F9F8FE', marginBottom: 10 }}>цель тренировки</div>
        <div className="flex flex-wrap gap-2" style={{ marginBottom: 18 }}>
          <Chip active>Мощный бросок</Chip><Chip>Убегаем от соперника</Chip><Chip>Силовая борьба</Chip><Chip>Мягкие ручки</Chip><Chip>Выносливость</Chip>
        </div>
        <div className="font-overpass uppercase" style={{ fontSize: 10, fontWeight: 700, color: '#F9F8FE', marginBottom: 10 }}>твоё состояние</div>
        <div className="flex gap-2"><Chip>Заряжен</Chip><Chip active>В тонусе</Chip><Chip>Устал</Chip></div>
      </div>
      <div className="px-4" style={{ position: 'absolute', bottom: 14, left: 0, right: 0 }}>
        <div className="font-overpass uppercase text-center" style={{ background: LIME, color: '#060919', borderRadius: 32, padding: '12px', fontWeight: 800, fontSize: 13 }}>Вперёд</div>
      </div>
    </div>
  );
}

export function MockCalendar() {
  return (
    <div style={{ paddingTop: 8 }}>
      <ScreenHeader title="Календарь" />
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2" style={{ background: 'linear-gradient(135deg, rgba(161,255,74,0.14) 0%, rgba(68,92,255,0.22) 100%)', border: '1px solid rgba(161,255,74,0.3)', borderRadius: 14, padding: 10, marginBottom: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(161,255,74,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🔋</div>
          <div>
            <div className="font-overpass uppercase" style={{ color: LIME, fontSize: 8, fontWeight: 800, letterSpacing: 0.5 }}>ИИ-тренер</div>
            <div className="font-overpass" style={{ color: '#F9F8FE', fontSize: 11, fontWeight: 700 }}>Неделя готова · Пн-Пт</div>
          </div>
        </div>
        <div style={{ transform: 'scale(0.82)', transformOrigin: 'center', margin: '0 -6px 2px' }}>
          <MicrocycleWave animate={false} />
        </div>
        <div className="flex flex-col gap-2" style={{ marginTop: 2 }}>
          {DAY_MOCK.map((x) => (
            <div key={x.d} className="flex items-center gap-2" style={{ background: 'rgba(68,92,255,0.16)', borderRadius: 12, padding: '8px 10px' }}>
              <div style={{ fontSize: 16 }}>{x.emoji}</div>
              <div className="flex-1">
                <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 9 }}>{x.d}</div>
                <div className="font-overpass uppercase" style={{ color: '#F9F8FE', fontSize: 11, fontWeight: 700 }}>{x.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MockProfile() {
  return (
    <div style={{ paddingTop: 8 }}>
      <ScreenHeader title="Профиль" />
      <div className="px-2 pt-3">
        <div className="flex items-center gap-3 px-1" style={{ marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: `linear-gradient(135deg, ${BLUE} 0%, #1a1f3a 100%)`, flexShrink: 0 }} />
          <div>
            <div className="font-overpass uppercase" style={{ color: '#F9F8FE', fontSize: 13, fontWeight: 900 }}>Бахтияр</div>
            <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 10 }}>Нападающий · №10</div>
          </div>
        </div>
        <PotentialSection ratingEndurance={5.2} ratingTechnique={5.8} ratingPower={6.1} ratingSpeed={4.7} ratingFlexibility={4.3} potential={54} gains={{ endurance: 0.4, power: 0.3 }} />
      </div>
    </div>
  );
}

export interface WorkoutMod {
  title: string;
  duration: number; // минуты
  thumbnail?: string | null;
}

const WORKOUT_DEMO: WorkoutMod[] = [
  { title: 'Разминка', duration: 4 },
  { title: 'Сила ног', duration: 12 },
  { title: 'Техника', duration: 8 },
  { title: 'Заминка', duration: 4 },
];

// modules приходят с сервера (реальные видео). Если пусто — демо.
export function MockWorkout({ modules }: { modules?: WorkoutMod[] }) {
  const mods = modules && modules.length > 0 ? modules.slice(0, 4) : WORKOUT_DEMO;
  const totalMin = mods.reduce((s, m) => s + (m.duration || 0), 0);
  const colors = ['rgba(161,255,74,0.16)', 'rgba(68,92,255,0.22)'];
  return (
    <div style={{ paddingTop: 8 }}>
      <ScreenHeader title="Тренировка" />
      <div className="px-3 pt-3">
        <div className="font-overpass uppercase" style={{ color: LIME, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, marginBottom: 2 }}>цель · мощный бросок</div>
        <div className="font-overpass uppercase" style={{ color: '#F9F8FE', fontSize: 13, fontWeight: 900, marginBottom: 12 }}>{mods.length} модул{mods.length === 1 ? 'ь' : mods.length < 5 ? 'я' : 'ей'} · {totalMin} мин</div>
        <div className="grid grid-cols-2 gap-2">
          {mods.map((m, i) => (
            <div key={i} style={{ background: colors[i % 2], borderRadius: 12, padding: 12, aspectRatio: '1 / 0.9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
              {m.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.32 }} />
              )}
              <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 9, position: 'relative' }}>0{i + 1}</div>
              <div style={{ position: 'relative' }}>
                <div className="font-overpass uppercase" style={{ color: '#F9F8FE', fontSize: 11, fontWeight: 700, lineHeight: '110%', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{m.title}</div>
                <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 9, marginTop: 2 }}>{m.duration} мин</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface CatalogItem {
  title: string;
  trainer: string;
  duration: number; // минуты
  thumbnail?: string | null;
}

const CATALOG_DEMO: CatalogItem[] = [
  { title: 'Кистевой бросок: техника', trainer: 'Марк Ковалевкий', duration: 6 },
  { title: 'Взрывная сила ног', trainer: 'Анна П.', duration: 11 },
  { title: 'Катание: работа рёбер', trainer: 'Сергей Е.', duration: 9 },
  { title: 'Дриблинг под давлением', trainer: 'Игорь М.', duration: 7 },
];

// items приходят с сервера (реальные опубликованные видео). Если пусто — демо.
export function MockCatalog({ items }: { items?: CatalogItem[] }) {
  const list = items && items.length > 0 ? items : CATALOG_DEMO;
  const colors = ['rgba(68,92,255,0.22)', 'rgba(161,255,74,0.16)'];
  return (
    <div style={{ paddingTop: 8 }}>
      <ScreenHeader title="Каталог" />
      <div className="px-3 pt-3 flex flex-col gap-2">
        {list.map((v, i) => (
          <div key={i} className="flex items-center gap-2" style={{ background: 'rgba(16,21,48,0.6)', borderRadius: 12, padding: 8 }}>
            <div style={{ width: 54, height: 36, borderRadius: 8, background: colors[i % 2], flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
              {v.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F9F8FE', fontSize: 12 }}>▶</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-overpass" style={{ color: '#F9F8FE', fontSize: 11, fontWeight: 700, lineHeight: '115%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
              <div className="flex items-center gap-1" style={{ marginTop: 3 }}>
                <div style={{ width: 12, height: 12, borderRadius: 999, background: `linear-gradient(135deg, ${BLUE}, #1a1f3a)`, flexShrink: 0 }} />
                <span className="font-overpass" style={{ color: '#AEABBB', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.trainer} · {v.duration} мин</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type PreviewScreen = 'assessment' | 'calendar' | 'profile' | 'workout' | 'catalog';
