'use client';

import { useCallback, useEffect, useState, use } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import CoachPoseSessionsSection from '@/components/CoachPoseSessionsSection';
import PotentialSection from '@/components/PotentialSection';

interface Assignment {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
  assignedAt: string;
  completedAt: string | null;
  notes: string | null;
  videoId: string | null;
  workoutSessionId: string | null;
  video: { id: string; title: string; thumbnail: string | null; duration: number } | null;
}

interface AthleteData {
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    profile: {
      position?: string;
      number?: number;
      avatarUrl?: string;
      potential: number;
      ratingPower: number;
      ratingSpeed: number;
      ratingEndurance: number;
      ratingTechnique: number;
      ratingFlexibility: number;
    } | null;
  };
  assignments: Assignment[];
  recentGains?: {
    gainPower: number;
    gainSpeed: number;
    gainEndurance: number;
    gainTechnique: number;
    gainFlexibility: number;
  } | null;
}

export default function CoachAthleteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [data, setData] = useState<AthleteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/athletes/${id}/coach-view`, { cache: 'no-store' });
      if (res.status === 403 || res.status === 404) {
        // намеренно: нет доступа / не найден — не считаем сетевой ошибкой,
        // показываем «не найден» экран ниже (data остаётся null)
        return;
      }
      if (!res.ok) {
        throw new Error(`Не удалось загрузить игрока (${res.status})`);
      }
      setData(await res.json());
    } catch (e) {
      console.error('coach/athletes/[id] load failed:', e);
      setLoadError(e instanceof Error ? e.message : 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading && !loadError) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A1FF4A]" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#101530] text-white flex flex-col items-center justify-center px-6 gap-4">
        <p className="font-overpass text-center" style={{ color: '#F9F8FE', fontSize: 14 }}>{loadError}</p>
        <div className="flex gap-3">
          <button
            onClick={load}
            className="font-overpass uppercase"
            style={{ background: '#A1FF4A', color: '#101530', padding: '12px 24px', borderRadius: 999, fontWeight: 900, fontSize: 12, border: 'none', cursor: 'pointer' }}
          >
            Повторить
          </button>
          <button
            onClick={() => router.back()}
            className="font-overpass uppercase"
            style={{ background: 'transparent', color: '#AEABBB', padding: '12px 24px', borderRadius: 999, fontWeight: 900, fontSize: 12, border: '1px solid #26252F', cursor: 'pointer' }}
          >
            Назад
          </button>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-[#101530] text-white flex flex-col items-center justify-center px-6">
        <p className="font-overpass text-center" style={{ color: '#AEABBB' }}>Игрок не найден или нет доступа</p>
        <button onClick={() => router.back()} className="mt-6 font-overpass uppercase" style={{ background: '#A1FF4A', color: '#101530', padding: '12px 24px', borderRadius: 999, fontWeight: 900, fontSize: 12, border: 'none' }}>
          Назад
        </button>
      </div>
    );
  }

  const { athlete, assignments, recentGains } = data;
  const p = athlete.profile;

  return (
    <div className="min-h-screen bg-[#101530] text-white pb-16">
      <div
        className="px-5 pb-6 max-w-3xl md:mx-auto md:px-8"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
      >
        <button
          onClick={() => router.back()}
          className="font-overpass mb-4 inline-flex items-center gap-2"
          style={{ color: '#AEABBB', fontSize: 13 }}
        >
          <Image src="/icons/icon-action-back.svg" alt="" width={24} height={24} aria-hidden />
          К команде
        </button>

        <div className="flex items-center gap-4">
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#1a1f3a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontFamily: 'Overpass',
              fontSize: 22,
              backgroundImage: p?.avatarUrl ? `url(${p.avatarUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!p?.avatarUrl && `${athlete.firstName?.[0] ?? ''}${athlete.lastName?.[0] ?? ''}`}
          </div>
          <div>
            <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 20 }}>
              {athlete.firstName} {athlete.lastName}
            </h1>
            <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 13, marginTop: 2 }}>
              {p?.position ?? '—'}{p?.number ? ` · №${p.number}` : ''}
            </p>
          </div>
        </div>

        {/* Потенциал — единый компонент с /profile (с десятыми + прирост) */}
        {p && (
          <div className="mt-5">
            <PotentialSection
              ratingEndurance={p.ratingEndurance}
              ratingTechnique={p.ratingTechnique}
              ratingPower={p.ratingPower}
              ratingSpeed={p.ratingSpeed}
              ratingFlexibility={p.ratingFlexibility}
              potential={p.potential}
              gains={recentGains ? {
                endurance:   recentGains.gainEndurance,
                technique:   recentGains.gainTechnique,
                power:       recentGains.gainPower,
                speed:       recentGains.gainSpeed,
                flexibility: recentGains.gainFlexibility,
              } : undefined}
            />
          </div>
        )}

        {/* Задания */}
        <h2 className="font-overpass uppercase mt-6 mb-3" style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.05em' }}>
          История заданий
        </h2>
        <div className="flex flex-col gap-2">
          {assignments.length === 0 && (
            <div className="text-center py-6 font-overpass" style={{ color: '#AEABBB', fontSize: 13, background: '#060919', borderRadius: 14, border: '1px dashed #26252F' }}>
              Заданий пока не было
            </div>
          )}
          {assignments.map((a) => (
            <div key={a.id} style={{ background: '#060919', border: '1px solid #26252F', borderRadius: 12, padding: '12px 14px' }}>
              <div className="flex items-center justify-between">
                <div className="font-overpass" style={{ fontWeight: 700, fontSize: 13 }}>
                  {a.workoutSessionId
                    ? 'Полноценное занятие · 4 модуля'
                    : (a.video?.title ?? '—')}
                </div>
                <StatusBadge status={a.status} />
              </div>
              <div className="font-overpass mt-1" style={{ color: '#AEABBB', fontSize: 11 }}>
                Срок: {new Date(a.dueDate).toLocaleDateString('ru-RU')}
                {a.completedAt && ` · выполнено ${new Date(a.completedAt).toLocaleDateString('ru-RU')}`}
              </div>
              {a.notes && (
                <div
                  className="font-overpass mt-2"
                  style={{
                    color: '#F9F8FE',
                    fontSize: 11,
                    background: 'rgba(161, 255, 74, 0.06)',
                    border: '1px solid rgba(161, 255, 74, 0.20)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <span style={{ color: '#A1FF4A', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 6 }}>
                    Заметка
                  </span>
                  {a.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Сессии трекинга движений с камеры */}
        <CoachPoseSessionsSection athleteId={athlete.id} />

        <button
          onClick={() => router.push('/coach/assignments/new')}
          className="w-full font-overpass uppercase mt-6"
          style={{
            background: '#A1FF4A',
            color: '#101530',
            fontWeight: 900,
            fontSize: 13,
            padding: '14px 20px',
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Назначить новую тренировку
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' }) {
  const map = {
    PENDING:     { label: 'Ожидает',  bg: '#1a1f3a', fg: '#AEABBB' },
    IN_PROGRESS: { label: 'В работе', bg: '#445CFF', fg: '#F9F8FE' },
    COMPLETED:   { label: 'Готово',   bg: '#A1FF4A', fg: '#101530' },
  } as const;
  const s = map[status];
  return (
    <span className="font-overpass uppercase" style={{ background: s.bg, color: s.fg, padding: '3px 9px', borderRadius: 999, fontSize: 9, fontWeight: 900, letterSpacing: '0.05em' }}>
      {s.label}
    </span>
  );
}
