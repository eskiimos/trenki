'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNavigationCoach from '@/components/BottomNavigationCoach';
import { useToast } from '@/lib/coach/use-toast';

interface Assignment {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
  assignedAt: string;
  athlete: { id: string; firstName: string; lastName: string };
  video: { id: string; title: string; thumbnail: string | null; duration: number };
  team: { id: string; name: string } | null;
}

type Filter = 'active' | 'completed' | 'all';

export default function CoachAssignmentsPage() {
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('active');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/assignments?role=coach', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setList(data.assignments ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить задание?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setList((prev) => prev.filter((a) => a.id !== id));
        toast.show('Задание удалено', 'success');
      } else {
        toast.show('Не удалось удалить', 'error');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = list.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return a.status === 'COMPLETED';
    return a.status !== 'COMPLETED';
  });

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

        {/* Фильтры */}
        <div className="mt-4 flex gap-2">
          {([
            { key: 'active' as Filter, label: 'Активные' },
            { key: 'completed' as Filter, label: 'Выполненные' },
            { key: 'all' as Filter, label: 'Все' },
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
          {loading && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}
          {!loading && filtered.length === 0 && (
            <div
              className="text-center py-10 font-overpass whitespace-pre-line"
              style={{ color: '#AEABBB', fontSize: 14, background: '#060919', borderRadius: 14, border: '1px dashed #26252F' }}
            >
              {filter === 'completed'
                ? 'Пока нет выполненных заданий.'
                : list.length === 0
                  ? 'Пока нет заданий.\nНазначь первую тренировку игроку.'
                  : 'Нет заданий в этой категории.'}
            </div>
          )}
          {filtered.map((a) => (
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
              <div className="flex items-center justify-between mt-2">
                <div className="font-overpass" style={{ color: '#9B99AA', fontSize: 11 }}>
                  Срок: {new Date(a.dueDate).toLocaleDateString('ru-RU')}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="font-overpass uppercase"
                  style={{
                    background: 'transparent',
                    color: '#FF6B6B',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: 10,
                    letterSpacing: '0.05em',
                    cursor: deletingId === a.id ? 'not-allowed' : 'pointer',
                    padding: 0,
                  }}
                >
                  {deletingId === a.id ? '...' : 'Удалить'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNavigationCoach activeTab="assignments" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: '#060919',
        border: '1px solid #26252F',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div className="skeleton-loading" style={{ height: 14, width: '50%', borderRadius: 4 }} />
      <div className="skeleton-loading" style={{ height: 12, width: '80%', borderRadius: 4 }} />
      <div className="skeleton-loading" style={{ height: 10, width: '30%', borderRadius: 4 }} />
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
