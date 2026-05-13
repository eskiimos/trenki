'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNavigationCoach from '@/components/BottomNavigationCoach';

interface Assignment {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
  assignedAt: string;
  athlete: { id: string; firstName: string; lastName: string };
  video: { id: string; title: string; thumbnail: string | null; duration: number };
  team: { id: string; name: string } | null;
}

export default function CoachAssignmentsPage() {
  const router = useRouter();
  const [list, setList] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/assignments?role=coach', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setList(data.assignments ?? []);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#101530] text-white pb-24">
      <div className="px-5 py-6 max-w-3xl md:mx-auto md:px-8">
        <div className="flex items-center justify-between">
          <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 22 }}>
            Задания
          </h1>
          <button
            onClick={() => router.push('/coach/assignments/new')}
            className="font-overpass uppercase"
            style={{
              background: '#A1FF4A',
              color: '#101530',
              borderRadius: 999,
              border: 'none',
              padding: '10px 16px',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            + Новое
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {loading && <div className="text-center py-6" style={{ color: '#AEABBB' }}>Загрузка...</div>}
          {!loading && list.length === 0 && (
            <div
              className="text-center py-10 font-overpass"
              style={{ color: '#AEABBB', fontSize: 14, background: '#060919', borderRadius: 14, border: '1px dashed #26252F' }}
            >
              Пока нет заданий.<br />
              Назначь первую тренировку игроку.
            </div>
          )}
          {list.map((a) => (
            <div
              key={a.id}
              style={{
                background: '#060919',
                border: '1px solid #26252F',
                borderRadius: 14,
                padding: '14px 16px',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="font-overpass" style={{ fontWeight: 800, fontSize: 14 }}>
                  {a.athlete.firstName} {a.athlete.lastName}
                </div>
                <StatusBadge status={a.status} />
              </div>
              <div className="font-overpass mt-2" style={{ color: '#AEABBB', fontSize: 13 }}>
                {a.video.title}
              </div>
              <div className="font-overpass mt-2" style={{ color: '#9B99AA', fontSize: 11 }}>
                Срок: {new Date(a.dueDate).toLocaleDateString('ru-RU')}
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNavigationCoach activeTab="assignments" />
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
    <span
      className="font-overpass uppercase"
      style={{
        background: s.bg,
        color: s.fg,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: '0.05em',
      }}
    >
      {s.label}
    </span>
  );
}
