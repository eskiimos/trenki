'use client';

// Экран результатов микроцикла. Открывается после ответа в
// MicrocycleFeedbackModal, либо прямой ссылкой из истории.
//
// Показывает:
//   - заголовок цикла + статус
//   - общий прирост потенциала за неделю
//   - 5 дней с галочками/статусами (что сделал / что пропустил)
//   - кнопку «Готово» → /calendar (для запуска следующего цикла подождём
//     Sprint 4 — там будет логика адаптации)

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { EnergyIcon } from '@/components/training/icons';

type Intent = 'IN_TONE' | 'WARMUP' | 'CHARGED' | 'STRETCH' | 'TIRED';

// «Крутые» названия нагрузок (таблица методиста).
const INTENT_LABEL: Record<Intent, string> = {
  IN_TONE: 'База/стандарт',
  WARMUP: 'Зарядка',
  CHARGED: 'Овертайм',
  STRETCH: 'Раскисление',
  TIRED: 'Лёгкая нагрузка',
};

// Иконки интентов — в @/components/training/icons (<EnergyIcon state={…} />).

// Календарный день недели для относительного dayOfWeek (1..N от даты старта).
// dayOfWeek в микроцикле — ПОРЯДКОВЫЙ день цикла, НЕ календарный (Пн=1): цикл
// может стартовать с любого дня (вводная неделя). Поэтому считаем от weekStartDate.
const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
function weekdayLabel(weekStartISO: string, dayOfWeek: number): string {
  const s = new Date(weekStartISO);
  const d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + (dayOfWeek - 1)));
  return WD[d.getUTCDay()];
}

interface MicrocycleResponse {
  microcycle: {
    id: string;
    cycleNumber: number;
    feedback: 'EASY' | 'NORMAL' | 'HARD' | null;
    weekStartDate: string;
    effectiveStatus: 'ACTIVE' | 'AWAITING_FEEDBACK' | 'ARCHIVED';
    introNoSurvey?: boolean;
    days: Array<{
      dayOfWeek: number;
      intent: Intent;
      workoutSession: { id: string; status: string; totalVideos: number } | null;
    }>;
  };
  stats: {
    plannedCount: number;
    completedCount: number;
    inProgressCount: number;
    skippedCount: number;
    totalGain: {
      potential: number;
      power: number;
      speed: number;
      endurance: number;
      technique: number;
      flexibility: number;
    };
  };
}

export default function MicrocycleResultPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const cycleId = params?.id;

  const [data, setData] = useState<MicrocycleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cycleId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/microcycle/${cycleId}`, { cache: 'no-store' });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.error || 'Не удалось загрузить результаты');
        }
        if (cancelled) return;
        setData(await res.json());
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Ошибка');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cycleId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060919] flex items-center justify-center">
        <div className="text-white text-sm">Считаем твою неделю…</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#060919] flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-[#FF8C4A] text-sm">{error || 'Цикл не найден'}</div>
        <button
          onClick={() => router.push('/calendar')}
          className="px-6 py-3 rounded-full bg-[#A1FF4A] text-[#060919] font-bold text-sm uppercase"
        >
          В календарь
        </button>
      </div>
    );
  }

  const { microcycle, stats } = data;
  const gain = stats.totalGain;
  const formatGain = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

  return (
    <div className="min-h-screen bg-[#060919] text-white pb-24">
      {/* Header */}
      <header className="flex items-center p-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <button onClick={() => router.back()} className="mr-4">
          <Image src="/icons/icon-action-back.svg" alt="" width={24} height={24} />
        </button>
        <h1
          className="text-white uppercase"
          style={{
            fontFamily: 'Overpass',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.5px',
          }}
        >
          Микроцикл №{microcycle.cycleNumber}
        </h1>
      </header>

      <div className="px-4 max-w-2xl mx-auto">
        {/* Карточка общего прироста */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            background: 'var(--grad-accent)',
            border: '1px solid var(--border-lime)',
          }}
        >
          <div
            style={{
              color: '#A1FF4A',
              fontSize: 11,
              fontFamily: 'Overpass',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Прирост потенциала за неделю
          </div>
          <div
            style={{
              color: '#A1FF4A',
              fontSize: 48,
              fontFamily: 'Overpass',
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {formatGain(gain.potential)}
          </div>
          <div className="text-[#AEABBB] text-xs mt-2">
            Выполнено {stats.completedCount} из {stats.plannedCount} тренировок
            {stats.skippedCount > 0 && ` · ${stats.skippedCount} дн. без модулей в каталоге`}
          </div>
        </div>

        {/* Короткий вводный заход (Пт-Вс) — без опроса, со след. недели полный цикл */}
        {microcycle.introNoSurvey && (
          <div
            className="rounded-2xl p-4 mb-6"
            style={{ background: 'var(--blue-medium)', border: '1px solid rgba(68,92,255,0.3)' }}
          >
            <div className="text-white text-sm font-semibold">Это был короткий вводный заход</div>
            <div className="text-[#AEABBB] text-xs mt-1">
              Со следующей недели — полный цикл с понедельника по пятницу.
            </div>
          </div>
        )}

        {/* Дельты по характеристикам */}
        <div className="mb-6">
          <div
            className="uppercase mb-3"
            style={{
              color: '#AEABBB',
              fontSize: 11,
              fontFamily: 'Overpass',
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            По характеристикам
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Сила', gain.power],
              ['Скорость', gain.speed],
              ['Выносливость', gain.endurance],
              ['Техника', gain.technique],
              ['Гибкость', gain.flexibility],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="rounded-xl p-3"
                style={{ background: 'rgba(174, 171, 187, 0.06)' }}
              >
                <div style={{ color: '#AEABBB', fontSize: 11 }}>{label}</div>
                <div
                  style={{
                    color: (value as number) > 0 ? '#A1FF4A' : '#AEABBB',
                    fontSize: 18,
                    fontWeight: 800,
                    marginTop: 4,
                  }}
                >
                  {formatGain(value as number)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5 дней с отметками */}
        <div className="mb-6">
          <div
            className="uppercase mb-3"
            style={{
              color: '#AEABBB',
              fontSize: 11,
              fontFamily: 'Overpass',
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            По дням
          </div>
          <div className="flex flex-col gap-2">
            {microcycle.days.map((d) => {
              const ws = d.workoutSession;
              const completed = ws?.status === 'COMPLETED';
              const inProgress = ws?.status === 'IN_PROGRESS';
              return (
                <div
                  key={d.dayOfWeek}
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{
                    background: completed
                      ? 'rgba(161, 255, 74, 0.08)'
                      : 'rgba(174, 171, 187, 0.06)',
                    border: `1px solid ${completed ? 'rgba(161, 255, 74, 0.25)' : 'transparent'}`,
                  }}
                >
                  <div className="text-[#AEABBB] text-xs font-bold w-6">
                    {weekdayLabel(microcycle.weekStartDate, d.dayOfWeek)}
                  </div>
                  <EnergyIcon
                    state={d.intent}
                    size={20}
                    color={completed ? '#A1FF4A' : '#AEABBB'}
                    className="shrink-0"
                  />
                  <div className="flex-1">
                    <div className="text-white text-sm font-semibold">
                      {INTENT_LABEL[d.intent]}
                    </div>
                    <div className="text-[#AEABBB] text-xs mt-0.5">
                      {!ws && 'нет модулей в каталоге'}
                      {ws && completed && 'выполнено'}
                      {ws && inProgress && 'начато'}
                      {ws && !completed && !inProgress && 'не приступал'}
                    </div>
                  </div>
                  {completed && <Check size={20} color="#A1FF4A" className="shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push('/calendar')}
          className="w-full mt-2 rounded-full font-bold uppercase"
          style={{
            background: '#A1FF4A',
            color: '#060919',
            padding: '16px 24px',
            fontSize: 14,
            letterSpacing: '0.05em',
            border: 'none',
          }}
        >
          Готово
        </button>
      </div>
    </div>
  );
}
