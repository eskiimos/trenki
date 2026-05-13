'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Assignment {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
  assignedAt: string;
  completedAt: string | null;
  notes: string | null;
  coach: { id: string; firstName: string; lastName: string };
  video: { id: string; title: string; thumbnail: string | null; duration: number };
  team: { id: string; name: string } | null;
}

export default function MyAssignmentsPage() {
  const router = useRouter();
  const [list, setList] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleStart = async (assignmentId: string, videoId: string) => {
    await fetch(`/api/assignments/${assignmentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    router.push(`/video/${videoId}`);
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
      <div className="px-5 py-6 max-w-3xl md:mx-auto md:px-8">
        <button onClick={() => router.back()} className="font-overpass mb-3" style={{ color: '#AEABBB', fontSize: 13 }}>
          ← Назад
        </button>
        <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 22 }}>
          Задания от тренера
        </h1>

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
          {list.map((a) => (
            <div key={a.id} style={{ background: '#060919', border: '1px solid #26252F', borderRadius: 14, padding: '14px 16px' }}>
              <div className="flex items-center justify-between">
                <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 12 }}>
                  От {a.coach.firstName} {a.coach.lastName}
                </div>
                <StatusBadge status={a.status} />
              </div>
              <div className="font-overpass mt-2" style={{ fontWeight: 800, fontSize: 14 }}>{a.video.title}</div>
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
                    onClick={() => handleStart(a.id, a.video.id)}
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
