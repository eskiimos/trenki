'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Member {
  userId: string;
  firstName: string;
  lastName: string;
  position: string | null;
}

interface VideoItem {
  id: string;
  title: string;
  thumbnail?: string | null;
  duration: number;
}

export default function CoachAssignmentNewPage() {
  const router = useRouter();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set());
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const teamsRes = await fetch('/api/teams', { cache: 'no-store' });
      if (!teamsRes.ok) return;
      const teamsData = await teamsRes.json();
      const first = teamsData.teams?.[0];
      if (!first) return;
      setTeamId(first.id);

      const [mRes, vRes] = await Promise.all([
        fetch(`/api/teams/${first.id}/members`, { cache: 'no-store' }),
        fetch('/api/videos/all', { cache: 'no-store' }),
      ]);
      if (mRes.ok) {
        const d = await mRes.json();
        setMembers(d.members ?? []);
      }
      if (vRes.ok) {
        const d = await vRes.json();
        const list: VideoItem[] = (d.videos ?? d ?? []).map((v: { id: string; title: string; thumbnail?: string | null; duration: number }) => ({
          id: v.id,
          title: v.title,
          thumbnail: v.thumbnail ?? null,
          duration: v.duration,
        }));
        setVideos(list);
      }
    })();
  }, []);

  // По умолчанию — дата на 3 дня вперёд
  useEffect(() => {
    if (!dueDate) {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      setDueDate(d.toISOString().slice(0, 10));
    }
  }, [dueDate]);

  const toggleAthlete = (id: string) => {
    setSelectedAthletes((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  const canSubmit =
    teamId && selectedVideoId && selectedAthletes.size > 0 && dueDate && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          videoId: selectedVideoId,
          dueDate: new Date(dueDate).toISOString(),
          notes: notes.trim() || null,
          athleteIds: Array.from(selectedAthletes),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || 'Ошибка');
        return;
      }
      router.push('/coach/assignments');
    } catch {
      setError('Сетевая ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white pb-32">
      <div
        className="px-5 pb-6 max-w-3xl md:mx-auto md:px-8"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
      >
        <button onClick={() => router.back()} className="font-overpass mb-3" style={{ color: '#AEABBB', fontSize: 13 }}>
          ← Назад
        </button>
        <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 22 }}>
          Новое задание
        </h1>

        {/* Игроки */}
        <Section title="Кому">
          <div className="flex flex-col gap-2">
            {members.length === 0 && (
              <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 13 }}>В команде пока никого нет</div>
            )}
            {members.map((m) => {
              const checked = selectedAthletes.has(m.userId);
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => toggleAthlete(m.userId)}
                  className="w-full text-left flex items-center justify-between"
                  style={{
                    background: '#060919',
                    border: checked ? '1px solid #A1FF4A' : '1px solid #26252F',
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <div>
                    <div className="font-overpass" style={{ fontWeight: 800, fontSize: 14 }}>
                      {m.firstName} {m.lastName}
                    </div>
                    {m.position && (
                      <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 12, marginTop: 2 }}>
                        {m.position}
                      </div>
                    )}
                  </div>
                  <Checkbox checked={checked} />
                </button>
              );
            })}
          </div>
        </Section>

        {/* Видео */}
        <Section title="Тренировка">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="w-full font-overpass mb-3"
            style={{
              background: '#060919',
              border: '1px solid #26252F',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#F9F8FE',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {filteredVideos.slice(0, 30).map((v) => {
              const sel = selectedVideoId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVideoId(v.id)}
                  className="text-left"
                  style={{
                    background: '#060919',
                    border: sel ? '1px solid #A1FF4A' : '1px solid #26252F',
                    borderRadius: 12,
                    padding: '10px 12px',
                  }}
                >
                  <div className="font-overpass truncate" style={{ fontWeight: 700, fontSize: 13 }}>
                    {v.title}
                  </div>
                  <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 11, marginTop: 2 }}>
                    {Math.round(v.duration / 60)} мин
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Дата */}
        <Section title="Сроки">
          <div className="flex gap-2 mb-3 flex-wrap">
            {([
              { label: '3 дня', days: 3 },
              { label: '1 неделя', days: 7 },
              { label: '2 недели', days: 14 },
            ]).map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + p.days);
                  setDueDate(d.toISOString().slice(0, 10));
                }}
                className="font-overpass uppercase"
                style={{
                  background: 'transparent',
                  color: '#AEABBB',
                  border: '1px solid #26252F',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontWeight: 800,
                  fontSize: 10,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full font-overpass"
            style={{
              background: '#060919',
              border: '1px solid #26252F',
              borderRadius: 10,
              padding: '12px 14px',
              color: '#F9F8FE',
              fontSize: 14,
              outline: 'none',
              colorScheme: 'dark',
            }}
          />
        </Section>

        {/* Заметка */}
        <Section title="Комментарий">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Необязательно..."
            className="w-full font-overpass"
            style={{
              background: '#060919',
              border: '1px solid #26252F',
              borderRadius: 10,
              padding: '12px 14px',
              color: '#F9F8FE',
              fontSize: 13,
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </Section>

        {error && (
          <div className="mt-3 p-3 bg-red-500/20 border border-red-500 rounded-lg">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full font-overpass uppercase mt-6"
          style={{
            background: canSubmit ? '#A1FF4A' : '#4a4f6a',
            color: canSubmit ? '#101530' : '#AEABBB',
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: '0.02em',
            padding: '16px 24px',
            borderRadius: 999,
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Отправляю...' : `Назначить (${selectedAthletes.size})`}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="font-overpass uppercase mb-3" style={{ fontWeight: 900, fontSize: 13, letterSpacing: '0.05em', color: '#F9F8FE' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        border: checked ? 'none' : '2px solid #445CFF',
        background: checked ? '#A1FF4A' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {checked && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#101530" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
