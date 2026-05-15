'use client';

import { useEffect, useState } from 'react';

interface SessionItem {
  id: string;
  videoId: string;
  durationSec: number;
  framesCount: number;
  avgConfidence: number | null;
  coachRating: number | null;
  coachComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  video: { id: string; title: string; thumbnail: string | null };
}

interface Props {
  athleteId: string;
}

/**
 * Список сессий трекинга движений атлета + форма оценки (тренер).
 * Используется на странице /coach/athletes/[id].
 */
export default function CoachPoseSessionsSection({ athleteId }: Props) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/pose-sessions?athleteId=${encodeURIComponent(athleteId)}`, {
        cache: 'no-store',
      });
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  return (
    <>
      <h2
        className="font-overpass uppercase mt-6 mb-3"
        style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.05em' }}
      >
        Сессии трекинга движений
      </h2>
      <div className="flex flex-col gap-2">
        {loading && (
          <div
            className="text-center py-4 font-overpass"
            style={{ color: '#AEABBB', fontSize: 13, background: '#060919', borderRadius: 14, border: '1px solid #26252F' }}
          >
            Загрузка…
          </div>
        )}
        {!loading && sessions.length === 0 && (
          <div
            className="text-center py-6 font-overpass"
            style={{ color: '#AEABBB', fontSize: 13, background: '#060919', borderRadius: 14, border: '1px dashed #26252F' }}
          >
            Атлет ещё не записывал сессий с камерой
          </div>
        )}
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            onUpdated={(updated) =>
              setSessions((list) => list.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
            }
          />
        ))}
      </div>
    </>
  );
}

function SessionRow({
  session,
  onUpdated,
}: {
  session: SessionItem;
  onUpdated: (s: Partial<SessionItem> & { id: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number>(session.coachRating ?? 0);
  const [comment, setComment] = useState<string>(session.coachComment ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (rating < 1 || rating > 5) return;
    setSaving(true);
    const res = await fetch(`/api/pose-sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment }),
    });
    setSaving(false);
    if (res.ok) {
      onUpdated({ id: session.id, coachRating: rating, coachComment: comment, reviewedAt: new Date().toISOString() });
      setOpen(false);
    }
  };

  return (
    <div
      style={{ background: '#060919', border: '1px solid #26252F', borderRadius: 12, padding: '12px 14px' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center justify-between">
          <div className="font-overpass" style={{ fontWeight: 700, fontSize: 13 }}>
            {session.video?.title || 'Без названия'}
          </div>
          {session.coachRating ? (
            <span
              className="font-overpass uppercase"
              style={{ background: '#A1FF4A', color: '#101530', padding: '3px 9px', borderRadius: 999, fontSize: 9, fontWeight: 900 }}
            >
              Оценка {session.coachRating}/5
            </span>
          ) : (
            <span
              className="font-overpass uppercase"
              style={{ background: '#1a1f3a', color: '#AEABBB', padding: '3px 9px', borderRadius: 999, fontSize: 9, fontWeight: 900 }}
            >
              Без оценки
            </span>
          )}
        </div>
        <div className="font-overpass mt-1" style={{ color: '#AEABBB', fontSize: 11 }}>
          {new Date(session.createdAt).toLocaleString('ru-RU')} · {session.durationSec}s · {session.framesCount} кадров
          {session.avgConfidence !== null && session.avgConfidence !== undefined && (
            <> · уверенность {(session.avgConfidence * 100).toFixed(0)}%</>
          )}
        </div>
        {session.coachComment && !open && (
          <div className="font-overpass mt-1" style={{ color: '#F9F8FE', fontSize: 12, fontStyle: 'italic' }}>
            «{session.coachComment}»
          </div>
        )}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="font-overpass"
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  border: '1px solid #26252F',
                  background: rating >= n ? '#A1FF4A' : 'transparent',
                  color: rating >= n ? '#101530' : '#AEABBB',
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            placeholder="Комментарий тренера…"
            rows={3}
            style={{
              background: '#1a1f3a',
              border: '1px solid #26252F',
              borderRadius: 8,
              padding: '10px 12px',
              color: '#F9F8FE',
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={saving || rating < 1}
            className="font-overpass uppercase"
            style={{
              background: rating >= 1 ? '#A1FF4A' : '#26252F',
              color: rating >= 1 ? '#101530' : '#AEABBB',
              fontWeight: 900,
              fontSize: 12,
              padding: '10px 16px',
              borderRadius: 999,
              border: 'none',
              cursor: rating >= 1 ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Сохранение…' : 'Сохранить оценку'}
          </button>
        </div>
      )}
    </div>
  );
}
