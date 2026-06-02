'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNavigationCoach from '@/components/BottomNavigationCoach';

type SortKey = 'name' | 'potential' | 'status';

interface Team {
  id: string;
  name: string;
  clubName: string | null;
  inviteCode: string;
  membersCount: number;
}

interface TeamStats {
  membersCount: number;
  averagePotential: number;
  totalWeek: number;
  completedWeek: number;
}

interface Member {
  memberId: string;
  userId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  number: number | null;
  avatarUrl: string | null;
  potential: number;
  assignmentStatus: 'pending' | 'in_progress' | 'completed' | 'none';
}

export default function CoachTeamPage() {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('potential');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const teamsRes = await fetch('/api/teams', { cache: 'no-store' });
      if (!teamsRes.ok) {
        throw new Error(`Не удалось загрузить команды (${teamsRes.status})`);
      }
      const teamsData = await teamsRes.json();
      const first = teamsData.teams?.[0];
      if (!first) return; // пустое состояние — это не ошибка
      setTeam(first);

      const [statsRes, membersRes] = await Promise.all([
        fetch(`/api/teams/${first.id}/stats`, { cache: 'no-store' }),
        fetch(`/api/teams/${first.id}/members`, { cache: 'no-store' }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members ?? []);
      }
    } catch (e) {
      console.error('coach/team load failed:', e);
      setLoadError(e instanceof Error ? e.message : 'Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sortedMembers = [...members].sort((a, b) => {
    if (sortKey === 'name') return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
    if (sortKey === 'potential') return b.potential - a.potential;
    const rank = (s: Member['assignmentStatus']) => s === 'in_progress' ? 0 : s === 'pending' ? 1 : 2;
    return rank(a.assignmentStatus) - rank(b.assignmentStatus);
  });

  return (
    <div className="min-h-screen bg-[#101530] text-white pb-24">
      <div
        className="px-5 pb-6 max-w-3xl md:mx-auto md:px-8"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
      >
        <h1
          className="font-overpass uppercase"
          style={{ fontWeight: 900, fontSize: 22, letterSpacing: '0.02em' }}
        >
          {team?.name ?? 'Командная комната'}
        </h1>
        {team?.clubName && (
          <p className="font-overpass mt-1" style={{ color: '#AEABBB', fontSize: 13 }}>
            {team.clubName}
          </p>
        )}

        {/* Блок «Код приглашения» переехал в /coach/profile.
            Заявки на вступление — здесь. */}
        {team && <PendingRequestsSection teamId={team.id} />}

        {/* Статистика */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard label="Игроков" value={stats?.membersCount ?? 0} />
          <StatCard label="Потенциал" value={stats?.averagePotential ?? 0} suffix="" />
          <StatCard label="Неделя" value={`${stats?.completedWeek ?? 0}/${stats?.totalWeek ?? 0}`} />
        </div>

        {/* Список игроков */}
        <div className="mt-7 flex items-center justify-between">
          <h2 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 14, letterSpacing: '0.05em' }}>
            Игроки
          </h2>
          <button
            onClick={() => router.push('/coach/assignments/new')}
            className="font-overpass uppercase"
            style={{
              background: '#A1FF4A',
              color: '#101530',
              borderRadius: 999,
              border: 'none',
              padding: '8px 14px',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.02em',
              cursor: 'pointer',
            }}
          >
            + Задание
          </button>
        </div>

        {/* Сортировка */}
        {members.length > 1 && (
          <div className="mt-3 flex gap-2">
            {(['potential', 'name', 'status'] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className="font-overpass uppercase"
                style={{
                  background: sortKey === key ? '#445CFF' : 'transparent',
                  color: sortKey === key ? '#F9F8FE' : '#AEABBB',
                  border: sortKey === key ? 'none' : '1px solid #26252F',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontWeight: 800,
                  fontSize: 10,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
              >
                {key === 'potential' ? 'Потенциал' : key === 'name' ? 'Имя' : 'Статус'}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {loadError && (
            <ErrorBanner message={loadError} onRetry={load} />
          )}
          {isLoading && !loadError && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}
          {!isLoading && !loadError && members.length === 0 && (
            <div
              className="text-center py-8 font-overpass"
              style={{ color: '#AEABBB', fontSize: 14, background: '#060919', borderRadius: 14, border: '1px dashed #26252F' }}
            >
              Пока никто не присоединился.<br />
              Поделись кодом <span style={{ color: '#A1FF4A', fontWeight: 800 }}>{team?.inviteCode}</span> с командой.
            </div>
          )}
          {!isLoading && sortedMembers.map((m) => (
            <PlayerRow key={m.memberId} member={m} onClick={() => router.push(`/coach/athletes/${m.userId}`)} />
          ))}
        </div>

      </div>

      <BottomNavigationCoach activeTab="team" />
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div
      style={{
        background: '#060919',
        border: '1px solid #26252F',
        borderRadius: 14,
        padding: '14px 12px',
      }}
    >
      <div
        className="font-overpass uppercase"
        style={{ color: '#9B99AA', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}
      >
        {label}
      </div>
      <div
        className="font-overpass mt-1"
        style={{ color: '#F9F8FE', fontSize: 20, fontWeight: 900 }}
      >
        {value}{suffix ?? ''}
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
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
      <div
        className="font-overpass"
        style={{ color: '#F9F8FE', fontSize: 13, fontWeight: 600 }}
      >
        {message}
      </div>
      <button
        type="button"
        onClick={onRetry}
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
  );
}

function SkeletonRow() {
  return (
    <div
      style={{
        background: '#060919',
        border: '1px solid #26252F',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div className="skeleton-loading" style={{ width: 42, height: 42, borderRadius: '50%' }} />
      <div className="flex-1 flex flex-col gap-2">
        <div className="skeleton-loading" style={{ height: 12, width: '60%', borderRadius: 4 }} />
        <div className="skeleton-loading" style={{ height: 10, width: '40%', borderRadius: 4 }} />
      </div>
    </div>
  );
}

function PlayerRow({ member, onClick }: { member: Member; onClick: () => void }) {
  const statusColor =
    member.assignmentStatus === 'in_progress' ? '#A1FF4A'
    : member.assignmentStatus === 'pending' ? '#445CFF'
    : 'transparent';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left"
      style={{
        background: '#060919',
        border: '1px solid #26252F',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: '#1a1f3a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontFamily: 'Overpass',
          fontSize: 15,
          color: '#F9F8FE',
          flexShrink: 0,
          backgroundImage: member.avatarUrl ? `url(${member.avatarUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!member.avatarUrl && `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-overpass truncate"
          style={{ fontWeight: 800, fontSize: 14, color: '#F9F8FE' }}
        >
          {member.firstName} {member.lastName}
        </div>
        <div
          className="font-overpass truncate"
          style={{ color: '#AEABBB', fontSize: 12, marginTop: 2 }}
        >
          {member.position ?? '—'}{member.number ? ` · №${member.number}` : ''}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div
          className="font-overpass uppercase"
          style={{ color: '#A1FF4A', fontSize: 11, fontWeight: 900, letterSpacing: '0.05em' }}
        >
          {Math.round(member.potential)}
        </div>
        {statusColor !== 'transparent' && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
        )}
      </div>
    </button>
  );
}

interface PendingItem {
  memberId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  position: string | null;
  requestedAt: string;
}

function PendingRequestsSection({ teamId }: { teamId: string }) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members?status=PENDING`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.pending ?? []);
    } catch (e) {
      console.error('pending load failed', e);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (memberId: string) => {
    setActing(memberId);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}/approve`, { method: 'POST' });
      if (res.ok) setItems((prev) => prev.filter((i) => i.memberId !== memberId));
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (memberId: string) => {
    if (!confirm('Отклонить заявку?')) return;
    setActing(memberId);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}/reject`, { method: 'POST' });
      if (res.ok) setItems((prev) => prev.filter((i) => i.memberId !== memberId));
    } finally {
      setActing(null);
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div
      className="mt-5"
      style={{
        background: '#060919',
        border: '1px solid rgba(161, 255, 74, 0.30)',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="font-overpass uppercase"
          style={{ color: '#A1FF4A', fontWeight: 900, fontSize: 11, letterSpacing: '0.5px' }}
        >
          Заявки на вступление · {items.length}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((it) => {
          const name = `${it.firstName ?? ''} ${it.lastName ?? ''}`.trim() || it.email || 'Игрок';
          return (
            <div
              key={it.memberId}
              style={{
                background: '#101530',
                border: '1px solid #26252F',
                borderRadius: 12,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div className="flex-1 min-w-0">
                <div
                  className="font-overpass truncate"
                  style={{ color: '#F9F8FE', fontSize: 13, fontWeight: 800 }}
                >
                  {name}
                </div>
                {it.email && (
                  <div
                    className="font-overpass truncate"
                    style={{ color: '#AEABBB', fontSize: 11, marginTop: 2 }}
                  >
                    {it.email}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleReject(it.memberId)}
                disabled={acting === it.memberId}
                className="font-overpass uppercase transition-transform duration-100 active:scale-95"
                style={{
                  background: 'transparent',
                  color: '#FF6B6B',
                  border: '1px solid rgba(255, 107, 107, 0.4)',
                  borderRadius: 999,
                  padding: '6px 10px',
                  fontWeight: 800,
                  fontSize: 10,
                  letterSpacing: '0.05em',
                  cursor: acting === it.memberId ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >
                Отклонить
              </button>
              <button
                type="button"
                onClick={() => handleApprove(it.memberId)}
                disabled={acting === it.memberId}
                className="font-overpass uppercase transition-transform duration-100 active:scale-95"
                style={{
                  background: '#A1FF4A',
                  color: '#101530',
                  border: 'none',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontWeight: 900,
                  fontSize: 10,
                  letterSpacing: '0.05em',
                  cursor: acting === it.memberId ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {acting === it.memberId ? '...' : 'Принять'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
