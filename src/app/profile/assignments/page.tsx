'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface Assignment {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
  assignedAt: string;
  completedAt: string | null;
  notes: string | null;
  videoId: string | null;
  workoutSessionId: string | null;
  coach: { id: string; firstName: string; lastName: string };
  video: { id: string; title: string; thumbnail: string | null; duration: number } | null;
  team: { id: string; name: string } | null;
}

export default function MyAssignmentsPage() {
  const router = useRouter();
  const [list, setList] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/assignments?role=athlete', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setList(d.assignments ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const handleStart = async (a: Assignment) => {
    await fetch(`/api/assignments/${a.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    if (a.workoutSessionId) {
      // Полноценное 4-модульное задание — открываем сессию в стандартном плеере тренировки
      router.push(`/training/workout?id=${a.workoutSessionId}`);
    } else if (a.video) {
      router.push(`/video/${a.video.id}`);
    }
  };

  const handleComplete = async (assignmentId: string) => {
    const res = await fetch(`/api/assignments/${assignmentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    if (res.ok) {
      setList((prev) => prev.map((a) => a.id === assignmentId ? { ...a, status: 'COMPLETED', completedAt: new Date().toISOString() } : a));
    }
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white pb-16">
      <div className="px-5 py-6 max-w-3xl md:mx-auto md:px-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <button
          onClick={() => router.back()}
          className="font-overpass mb-3 inline-flex items-center gap-2"
          style={{ color: '#AEABBB', fontSize: 13 }}
        >
          <Image src="/icons/icon-action-back.svg" alt="" width={24} height={24} aria-hidden />
          Назад
        </button>
        <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 22 }}>
          Задания от тренера
        </h1>

        <div className="mt-4 flex gap-2">
          {([
            { key: 'active' as const, label: 'Активные' },
            { key: 'completed' as const, label: 'Выполненные' },
            { key: 'all' as const, label: 'Все' },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="font-overpass uppercase"
              style={{
                background: filter === f.key ? '#445CFF' : 'transparent',
                color: filter === f.key ? '#F9F8FE' : '#AEABBB',
                border: filter === f.key ? 'none' : '1px solid #26252F',
                borderRadius: 999,
                padding: '6px 12px',
                fontWeight: 800,
                fontSize: 10,
                letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {loading && <div className="text-center py-6" style={{ color: '#AEABBB' }}>Загрузка...</div>}
          {!loading && list.length === 0 && (
            <div
              className="text-center py-10 font-overpass"
              style={{ color: '#AEABBB', fontSize: 14, background: '#060919', borderRadius: 14, border: '1px dashed #26252F' }}
            >
              Заданий пока нет
            </div>
          )}
          {!loading && list.length > 0 && list.filter((a) => filter === 'all' ? true : filter === 'completed' ? a.status === 'COMPLETED' : a.status !== 'COMPLETED').length === 0 && (
            <div
              className="text-center py-10 font-overpass"
              style={{ color: '#AEABBB', fontSize: 14, background: '#060919', borderRadius: 14, border: '1px dashed #26252F' }}
            >
              Нет заданий в этой категории
            </div>
          )}
          {list.filter((a) => filter === 'all' ? true : filter === 'completed' ? a.status === 'COMPLETED' : a.status !== 'COMPLETED').map((a) => (
            <div key={a.id} style={{ background: '#060919', border: '1px solid #26252F', borderRadius: 14, padding: '14px 16px' }}>
              <div className="flex items-center justify-between">
                <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 12 }}>
                  От {a.coach.firstName} {a.coach.lastName}
                </div>
                <StatusBadge status={a.status} />
              </div>
              <div className="font-overpass mt-2" style={{ fontWeight: 800, fontSize: 14 }}>
                {a.workoutSessionId
                  ? 'Полноценное занятие · 4 модуля'
                  : (a.video?.title ?? 'Задание')}
              </div>
              {a.notes && (
                <div className="font-overpass mt-2" style={{ color: '#AEABBB', fontSize: 12, fontStyle: 'italic' }}>
                  «{a.notes}»
                </div>
              )}
              <div className="font-overpass mt-2" style={{ color: '#9B99AA', fontSize: 11 }}>
                Срок: {new Date(a.dueDate).toLocaleDateString('ru-RU')}
              </div>
              {a.status !== 'COMPLETED' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleStart(a)}
                    className="flex-1 font-overpass uppercase"
                    style={{
                      background: '#A1FF4A',
                      color: '#101530',
                      fontWeight: 900,
                      fontSize: 12,
                      padding: '10px 16px',
                      borderRadius: 999,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {a.status === 'PENDING' ? 'Начать' : 'Продолжить'}
                  </button>
                  {a.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => handleComplete(a.id)}
                      className="font-overpass uppercase"
                      style={{
                        background: 'transparent',
                        color: '#F9F8FE',
                        border: '1px solid #445CFF',
                        fontWeight: 800,
                        fontSize: 11,
                        padding: '10px 14px',
                        borderRadius: 999,
                        cursor: 'pointer',
                      }}
                    >
                      Готово
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' }) {
  const map = {
    PENDING:     { label: 'Новое',    bg: '#445CFF', fg: '#F9F8FE' },
    IN_PROGRESS: { label: 'В работе', bg: '#1a1f3a', fg: '#A1FF4A' },
    COMPLETED:   { label: 'Готово',   bg: '#A1FF4A', fg: '#101530' },
  } as const;
  const s = map[status];
  return (
    <span className="font-overpass uppercase" style={{ background: s.bg, color: s.fg, padding: '3px 9px', borderRadius: 999, fontSize: 9, fontWeight: 900, letterSpacing: '0.05em' }}>
      {s.label}
    </span>
  );
}
