'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VideoSlotPicker from '@/components/coach/VideoSlotPicker';

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
  moduleType?: ModuleType | null;
  trainer?: { id: string; name: string; lastName?: string | null } | null;
}

type ModuleType = 'WARMUP' | 'FITNESS' | 'TECHNIQUE' | 'COOLDOWN';

const MODULE_LABELS: Record<ModuleType, string> = {
  WARMUP: 'Разминка',
  FITNESS: 'Физподготовка',
  TECHNIQUE: 'Техника',
  COOLDOWN: 'Заминка',
};

const FULL_SLOTS: { key: 'warmup' | 'fitness' | 'technique' | 'cooldown'; module: ModuleType }[] = [
  { key: 'warmup',    module: 'WARMUP' },
  { key: 'fitness',   module: 'FITNESS' },
  { key: 'technique', module: 'TECHNIQUE' },
  { key: 'cooldown',  module: 'COOLDOWN' },
];

type Mode = 'single' | 'full';
type SlotVideoIds = { warmup: string; fitness: string; technique: string; cooldown: string };

export default function CoachAssignmentNewPage() {
  const router = useRouter();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>('single');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [slotVideoIds, setSlotVideoIds] = useState<SlotVideoIds>({
    warmup: '', fitness: '', technique: '', cooldown: '',
  });
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Array<{ athleteId: string; athleteName: string; videoTitle: string }>>([]);

  const loadInitial = useCallback(async () => {
    setInitLoading(true);
    setInitError(null);
    try {
      const teamsRes = await fetch('/api/teams', { cache: 'no-store' });
      if (!teamsRes.ok) {
        throw new Error(`Не удалось загрузить команды (${teamsRes.status})`);
      }
      const teamsData = await teamsRes.json();
      const first = teamsData.teams?.[0];
      if (!first) return; // пустое состояние, не ошибка
      setTeamId(first.id);

      const [mRes, vRes] = await Promise.all([
        fetch(`/api/teams/${first.id}/members`, { cache: 'no-store' }),
        fetch('/api/videos/all', { cache: 'no-store' }),
      ]);
      if (!mRes.ok) throw new Error(`Не удалось загрузить игроков (${mRes.status})`);
      if (!vRes.ok) throw new Error(`Не удалось загрузить видео (${vRes.status})`);

      const mData = await mRes.json();
      setMembers(mData.members ?? []);

      const vData = await vRes.json();
      const list: VideoItem[] = (vData.videos ?? vData ?? []).map(
        (v: {
          id: string;
          title: string;
          thumbnail?: string | null;
          duration: number;
          moduleType?: ModuleType | null;
          trainer?: { id: string; name: string; lastName?: string | null } | null;
        }) => ({
          id: v.id,
          title: v.title,
          thumbnail: v.thumbnail ?? null,
          duration: v.duration,
          moduleType: v.moduleType ?? null,
          trainer: v.trainer ?? null,
        }),
      );
      setVideos(list);
    } catch (e) {
      console.error('coach/assignments/new init failed:', e);
      setInitError(e instanceof Error ? e.message : 'Ошибка сети');
    } finally {
      setInitLoading(false);
    }
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

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

  // Полноценное занятие: тренер может выбрать любые 2-4 модуля
  // (например, разминка + техника + заминка — без физподготовки).
  const fullSelectedCount = FULL_SLOTS.filter((s) => !!slotVideoIds[s.key]).length;
  const fullModeReady = fullSelectedCount >= 2 && fullSelectedCount <= 4;

  const canSubmit =
    teamId && selectedAthletes.size > 0 && dueDate && !submitting &&
    (mode === 'single' ? !!selectedVideoId : fullModeReady);

  const submitAssignment = async (force: boolean) => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        teamId,
        dueDate: new Date(dueDate).toISOString(),
        notes: notes.trim() || null,
        athleteIds: Array.from(selectedAthletes),
        force,
        mode,
      };
      if (mode === 'single') {
        payload.videoId = selectedVideoId;
      } else {
        payload.moduleVideos = slotVideoIds;
      }
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || 'Ошибка');
        return;
      }
      const data = await res.json();

      // Сервер вернул конфликты — у атлета на эту дату уже план Марка.
      // Тренер видит модал и решает: всё равно назначить (force=true) или отменить.
      if (Array.isArray(data.warnings) && data.warnings.length > 0 && !force) {
        setConflicts(data.warnings);
        return;
      }

      router.push('/coach/assignments');
    } catch {
      setError('Сетевая ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    submitAssignment(false);
  };

  const handleConfirmForce = () => {
    setConflicts([]);
    submitAssignment(true);
  };

  const handleCancelConflicts = () => {
    setConflicts([]);
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white pb-32">
      {conflicts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 9, 25, 0.85)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={handleCancelConflicts}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#060919',
              border: '1px solid rgba(161, 255, 74, 0.30)',
              borderRadius: 18,
              padding: '20px 22px',
              maxWidth: 420,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              className="font-overpass uppercase"
              style={{ color: '#A1FF4A', fontSize: 11, fontWeight: 900, letterSpacing: 0.5 }}
            >
              Конфликт с планом
            </div>
            <div className="font-overpass" style={{ color: '#F9F8FE', fontSize: 14, lineHeight: '1.4' }}>
              У {conflicts.length === 1 ? 'игрока' : 'игроков'} на эту дату уже{' '}
              {conflicts.length === 1 ? 'есть тренировка' : 'есть тренировки'} в плане. Если назначишь — атлет
              увидит в календаре только план, твоё задание останется в «От тренера».
            </div>
            <div
              className="font-overpass"
              style={{
                color: '#F9F8FE',
                fontSize: 13,
                background: 'rgba(161, 255, 74, 0.06)',
                border: '1px solid rgba(161, 255, 74, 0.20)',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {conflicts.map((c) => (
                <div key={`${c.athleteId}-${c.videoTitle}`}>
                  <span style={{ fontWeight: 800 }}>{c.athleteName}</span>
                  <span style={{ color: '#AEABBB' }}> · {c.videoTitle}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={handleCancelConflicts}
                className="font-overpass uppercase flex-1"
                style={{
                  background: 'transparent',
                  color: '#AEABBB',
                  border: '1px solid #26252F',
                  borderRadius: 999,
                  padding: '12px 16px',
                  fontWeight: 900,
                  fontSize: 12,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmForce}
                disabled={submitting}
                className="font-overpass uppercase flex-1"
                style={{
                  background: '#A1FF4A',
                  color: '#101530',
                  border: 'none',
                  borderRadius: 999,
                  padding: '12px 16px',
                  fontWeight: 900,
                  fontSize: 12,
                  letterSpacing: '0.05em',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? '...' : 'Всё равно назначить'}
              </button>
            </div>
          </div>
        </div>
      )}

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

        {initError && (
          <div
            className="mt-4"
            style={{
              background: 'rgba(255, 74, 74, 0.10)',
              border: '1px solid rgba(255, 74, 74, 0.30)',
              borderRadius: 14,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div className="font-overpass" style={{ color: '#F9F8FE', fontSize: 13, fontWeight: 600 }}>
              {initError}
            </div>
            <button
              type="button"
              onClick={loadInitial}
              className="font-overpass uppercase"
              style={{
                background: '#A1FF4A',
                color: '#101530',
                border: 'none',
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Повторить
            </button>
          </div>
        )}

        {initLoading && !initError && (
          <div
            className="mt-4 font-overpass"
            style={{ color: '#AEABBB', fontSize: 13 }}
          >
            Загружаем игроков и тренировки...
          </div>
        )}

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
          {/* Toggle режима */}
          <div className="flex gap-2 mb-4">
            {(['single', 'full'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="font-overpass uppercase flex-1"
                style={{
                  background: mode === m ? '#A1FF4A' : 'transparent',
                  color: mode === m ? '#101530' : '#AEABBB',
                  border: mode === m ? 'none' : '1px solid #26252F',
                  borderRadius: 999,
                  padding: '10px 12px',
                  fontWeight: 900,
                  fontSize: 11,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
              >
                {m === 'single' ? 'Одно видео' : 'Полноценное занятие'}
              </button>
            ))}
          </div>

          {mode === 'single' && (
            <>
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
              <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                {filteredVideos.map((v) => {
                  const sel = selectedVideoId === v.id;
                  const trainerName = v.trainer
                    ? `${v.trainer.name}${v.trainer.lastName ? ' ' + v.trainer.lastName : ''}`
                    : null;
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
                        {trainerName && (
                          <span style={{ color: '#A1FF4A', fontWeight: 700, marginLeft: 6 }}>
                            · {trainerName}
                          </span>
                        )}
                      </div>
                      <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 11, marginTop: 2 }}>
                        {Math.round(v.duration / 60)} мин
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {mode === 'full' && (
            <div className="flex flex-col gap-3">
              <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 12 }}>
                Собери занятие из 2–4 модулей. Можно пропустить любую часть —
                например, разминка + техника + заминка без физподготовки.
              </p>
              {FULL_SLOTS.map(({ key, module }) => {
                const candidates = videos.filter((v) => v.moduleType === module);
                const selectedId = slotVideoIds[key];
                return (
                  <div key={key} className="flex flex-col gap-2">
                    <div
                      className="font-overpass uppercase"
                      style={{
                        color: '#A1FF4A',
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: 0.5,
                      }}
                    >
                      {MODULE_LABELS[module]}
                    </div>
                    <VideoSlotPicker
                      slotLabel={MODULE_LABELS[module]}
                      value={selectedId}
                      options={candidates}
                      onChange={(videoId) =>
                        setSlotVideoIds((prev) => ({ ...prev, [key]: videoId }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Дата */}
        <Section title="Сроки">
          <div className="flex gap-2 mb-3 flex-wrap">
            {([
              { label: '3 дня', days: 3 },
              { label: '1 неделя', days: 7 },
              { label: '2 недели', days: 14 },
            ]).map((p) => {
              // Дата текущего пресета — сегодня + p.days
              const presetDate = new Date();
              presetDate.setDate(presetDate.getDate() + p.days);
              const presetIso = presetDate.toISOString().slice(0, 10);
              const isActive = dueDate === presetIso;
              return (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setDueDate(presetIso)}
                  className="font-overpass uppercase"
                  style={{
                    background: isActive ? '#A1FF4A' : 'transparent',
                    color: isActive ? '#101530' : '#AEABBB',
                    border: isActive ? 'none' : '1px solid #26252F',
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontWeight: 900,
                    fontSize: 10,
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
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
