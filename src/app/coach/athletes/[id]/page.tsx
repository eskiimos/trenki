'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import CoachPoseSessionsSection from '@/components/CoachPoseSessionsSection';

interface Assignment {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
  assignedAt: string;
  completedAt: string | null;
  notes: string | null;
  video: { id: string; title: string; thumbnail: string | null; duration: number };
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

  const { athlete, assignments } = data;
  const p = athlete.profile;

  const ratings = p ? [
    { label: 'Сила', value: p.ratingPower },
    { label: 'Скорость', value: p.ratingSpeed },
    { label: 'Выносливость', value: p.ratingEndurance },
    { label: 'Техника', value: p.ratingTechnique },
    { label: 'Гибкость', value: p.ratingFlexibility },
  ] : [];

  return (
    <div className="min-h-screen bg-[#101530] text-white pb-16">
      <div
        className="px-5 pb-6 max-w-3xl md:mx-auto md:px-8"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
      >
        <button onClick={() => router.back()} className="font-overpass mb-4" style={{ color: '#AEABBB', fontSize: 13 }}>
          ← К команде
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

        {/* Потенциал */}
        {p && (
          <div className="mt-5" style={{ background: '#060919', border: '1px solid #26252F', borderRadius: 14, padding: '16px 18px' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-overpass uppercase" style={{ color: '#9B99AA', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px' }}>
                Потенциал
              </div>
              <div className="font-overpass" style={{ color: '#A1FF4A', fontSize: 22, fontWeight: 900 }}>
                {Math.round(p.potential)}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {ratings.map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between font-overpass" style={{ fontSize: 12 }}>
                    <span style={{ color: '#AEABBB' }}>{r.label}</span>
                    <span style={{ color: '#F9F8FE', fontWeight: 800 }}>{Math.round(r.value)}</span>
                  </div>
                  <div style={{ background: '#1a1f3a', borderRadius: 999, height: 6, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, r.value)}%`, height: '100%', background: '#A1FF4A' }} />
                  </div>
                </div>
              ))}
            </div>
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
                <div className="font-overpass" style={{ fontWeight: 700, fontSize: 13 }}>{a.video.title}</div>
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
