'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Eye, Flame, Gamepad2, RefreshCw, RotateCcw } from 'lucide-react';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  AdminButton,
  inputStyle,
  labelStyle,
} from '@/components/admin/ui';
import { StatusIcon } from '@/components/gamification/icons';
import {
  computeXp,
  levelFromXp,
  xpForLevel,
  statusFromLevel,
  STATUSES,
} from '@/lib/gamification';

// Админ-песочница геймификации: быстрый прогон XP/уровней/эволюций/стрика БЕЗ
// реальных тренировок. Библиотека чистая — вся математика гоняется на клиенте,
// прод-данные не трогаются. Доступ гейтит middleware (/admin → admin_session).

/** Кумулятивный XP, нужный чтобы ДОСТИЧЬ уровня level. */
const cumulativeXp = (level: number): number => {
  let sum = 0;
  for (let i = 1; i < level; i++) sum += xpForLevel(i);
  return sum;
};

interface RealSummary {
  xp: number;
  level: number;
  status: { key: string; title: string };
  streak: number;
}

/** Числовое поле симулятора: подпись сверху, поле — на общих токенах админки. */
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        style={{ ...inputStyle, width: 120 }}
      />
    </label>
  );
}

export default function AdminGamificationPage() {
  // Симулятор: вход — счётчики, как в реальном API
  const [workouts, setWorkouts] = useState(10);
  const [modules, setModules] = useState(40);
  const [streak, setStreak] = useState(3);
  // Реальные значения текущего админа
  const [real, setReal] = useState<RealSummary | null>(null);
  // Раньше ошибка глушилась пустым catch → блок навсегда висел в «Загрузка…»
  const [realState, setRealState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [flagsMsg, setFlagsMsg] = useState<string | null>(null);
  // Превью модалки эволюции (локальный стейт, НЕ localStorage-механика)
  const [previewStatus, setPreviewStatus] = useState<(typeof STATUSES)[number] | null>(null);

  const loadReal = useCallback(() => {
    setRealState('loading');
    fetch('/api/gamification/summary')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('summary'))))
      .then((d) => {
        setReal(d);
        setRealState('ready');
      })
      .catch(() => setRealState('error'));
  }, []);

  useEffect(() => {
    loadReal();
  }, [loadReal]);

  // Модалка превью: Escape закрывает, фон не скроллится (фокус на кнопку —
  // через autoFocus на «Дальше»).
  useEffect(() => {
    if (!previewStatus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewStatus(null);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [previewStatus]);

  const xp = computeXp({ completedWorkouts: workouts, completedModules: modules });
  const info = levelFromXp(xp);
  const status = statusFromLevel(info.level);
  // Защита от NaN (xpForNext = 0) и от выезда полоски за контейнер (>100%)
  const progressPct = Math.min(100, Math.max(0, (info.xpIntoLevel / (info.xpForNext || 1)) * 100));

  // Сброс локальных «показано один раз» флагов — чтобы повторно затестить
  // модалку эволюции, предложение цикла и install-плашку на этом устройстве.
  const resetLocalFlags = () => {
    try {
      localStorage.removeItem('trenki_status_seen');
      localStorage.removeItem('trenki_cycle_offer_shown');
      localStorage.removeItem('trenki_a2hs_seen');
      setFlagsMsg('Флаги сброшены: эволюция, предложение цикла, install-плашка покажутся снова');
    } catch {
      setFlagsMsg('localStorage недоступен');
    }
  };

  return (
    <AdminPage width="narrow">
      <PageHeader
        title="Геймификация — песочница"
        icon={Gamepad2}
        subtitle="Прогон XP, уровней, званий и стрика без реальных тренировок"
      />

      {/* ───────── Мои реальные значения ───────── */}
      <AdminCard style={{ marginBottom: 24 }}>
        <SectionTitle>Мои реальные значения (из API)</SectionTitle>
        {realState === 'loading' && (
          <div style={{ fontSize: 14, color: 'var(--color-muted)' }}>Загрузка…</div>
        )}
        {realState === 'error' && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2" style={{ fontSize: 14, color: 'var(--color-danger)' }}>
              <AlertTriangle size={20} aria-hidden />
              Не удалось загрузить сводку
            </span>
            <AdminButton tone="secondary" size="sm" icon={RefreshCw} onClick={loadReal}>
              Повторить
            </AdminButton>
          </div>
        )}
        {realState === 'ready' && real && (
          <div className="flex flex-wrap items-center gap-3" style={{ fontSize: 14 }}>
            <span
              className="inline-flex items-center gap-2"
              style={{ color: 'var(--color-brand)', fontWeight: 700 }}
            >
              <StatusIcon statusKey={real.status.key} size={20} />
              {real.status.title}
            </span>
            <span style={{ color: 'var(--color-muted)' }}>Уровень {real.level}</span>
            <span style={{ color: 'var(--color-muted)' }}>XP {real.xp}</span>
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
              <Flame size={16} aria-hidden />
              стрик {real.streak}
            </span>
          </div>
        )}
      </AdminCard>

      {/* ───────── Симулятор ───────── */}
      <AdminCard style={{ marginBottom: 24 }}>
        <SectionTitle>Симулятор</SectionTitle>
        <div className="flex flex-wrap gap-4" style={{ marginBottom: 16 }}>
          <NumberField label="Тренировок" value={workouts} onChange={setWorkouts} />
          <NumberField label="Модулей" value={modules} onChange={setModules} />
          <NumberField label="Стрик, дней" value={streak} onChange={setStreak} />
        </div>

        {/* Рендер «как в профиле» */}
        <div
          style={{
            background: 'var(--color-night)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
          }}
        >
          <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 8 }}>
            <span
              className="inline-flex items-center gap-2"
              style={{
                background: 'rgba(161,255,74,0.15)',
                color: 'var(--color-brand)',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 'var(--radius-pill)',
                padding: '4px 12px',
              }}
            >
              <StatusIcon statusKey={status.key} size={16} />
              {status.title}
            </span>
            <span style={{ fontWeight: 700 }}>Уровень {info.level}</span>
            {streak >= 2 && (
              <span
                className="inline-flex items-center gap-1"
                style={{ fontSize: 12, color: 'var(--color-danger)' }}
              >
                <Flame size={16} aria-hidden />
                {streak} дн.
              </span>
            )}
          </div>
          <div
            style={{
              height: 8,
              background: 'rgba(174,171,187,0.20)',
              borderRadius: 'var(--radius-pill)',
              overflow: 'hidden',
              marginBottom: 4,
            }}
          >
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--color-brand)' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            XP: {info.xpIntoLevel}/{info.xpForNext} · всего {info.xpTotal}
            {status.nextStatus && (
              <> · следующее звание: {status.nextStatus.title} (ур. {status.nextStatus.minLevel})</>
            )}
          </div>
        </div>
      </AdminCard>

      {/* ───────── Таблица званий ───────── */}
      <AdminCard style={{ marginBottom: 24 }}>
        <SectionTitle>Звания и пороги</SectionTitle>
        {/* Скролл-контейнер: 5 колонок не влезают в телефон и рвали карточку */}
        <div className="overflow-x-auto -mx-4 px-4">
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr style={{ color: 'var(--color-muted)', fontSize: 12, textAlign: 'left' }}>
                <th style={{ padding: '4px 8px 4px 0', fontWeight: 700 }}>Звание</th>
                <th style={{ padding: '4px 8px', fontWeight: 700 }}>С уровня</th>
                <th style={{ padding: '4px 8px', fontWeight: 700 }}>Нужно XP всего</th>
                <th style={{ padding: '4px 8px', fontWeight: 700 }}>≈ тренировок*</th>
                <th style={{ padding: '4px 0 4px 8px' }}>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {STATUSES.map((s) => {
                const needXp = cumulativeXp(s.minLevel);
                return (
                  <tr key={s.key} style={{ borderTop: '1px solid var(--border-hairline)' }}>
                    <td style={{ padding: '8px 8px 8px 0', whiteSpace: 'nowrap' }}>
                      <span className="inline-flex items-center gap-2">
                        <StatusIcon statusKey={s.key} size={20} />
                        {s.title}
                      </span>
                    </td>
                    <td style={{ padding: '8px' }}>{s.minLevel}</td>
                    <td style={{ padding: '8px' }}>{needXp}</td>
                    <td style={{ padding: '8px' }}>{Math.ceil(needXp / 180)}</td>
                    <td style={{ padding: '8px 0 8px 8px' }}>
                      <AdminButton
                        tone="secondary"
                        size="sm"
                        icon={Eye}
                        onClick={() => setPreviewStatus(s)}
                        aria-label={`Показать модалку эволюции: ${s.title}`}
                      >
                        модалка
                      </AdminButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}>
          * при тренировке из 4 модулей (100 + 4×20 = 180 XP)
        </div>
      </AdminCard>

      {/* ───────── Сброс локальных флагов ───────── */}
      <AdminCard>
        <SectionTitle>Повторный тест на этом устройстве</SectionTitle>
        <AdminButton icon={RotateCcw} onClick={resetLocalFlags}>
          Сбросить локальные флаги
        </AdminButton>
        {flagsMsg && (
          <div style={{ fontSize: 12, color: 'var(--color-brand)', marginTop: 8 }}>{flagsMsg}</div>
        )}
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}>
          Сбрасывает «уже показано»: модалка эволюции (профиль), предложение собрать цикл, плашка «на
          экран домой».
        </div>
      </AdminCard>

      {/* ───────── Превью модалки эволюции (копия вёрстки EvolutionModal) ───────── */}
      {previewStatus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Превью эволюции: ${previewStatus.title}`}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'var(--scrim)' }}
            onClick={() => setPreviewStatus(null)}
          />
          <div
            className="relative w-full max-w-sm text-center animate-popIn"
            style={{
              background: 'var(--color-elevated)',
              border: '1px solid var(--border-lime)',
              borderRadius: 'var(--radius-xl)',
              padding: 24,
            }}
          >
            {/* Декоративный тайл 64 с глифом 28 — как в UI-ките */}
            <div className="flex justify-center">
              <span
                className="flex items-center justify-center"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 999,
                  background: 'rgba(161,255,74,0.12)',
                  color: 'var(--color-brand)',
                }}
              >
                <StatusIcon statusKey={previewStatus.key} size={28} />
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 12 }}>Эволюция!</div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>
              Ты теперь{' '}
              <span style={{ color: 'var(--color-brand)', fontWeight: 700 }}>{previewStatus.title}</span>
            </div>
            <AdminButton
              autoFocus
              onClick={() => setPreviewStatus(null)}
              style={{ width: '100%', marginTop: 24 }}
            >
              Дальше
            </AdminButton>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
