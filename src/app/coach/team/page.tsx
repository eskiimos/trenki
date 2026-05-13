'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNavigationCoach from '@/components/BottomNavigationCoach';
import AccountSwitcher from '@/components/AccountSwitcher';
import { useToast } from '@/lib/coach/use-toast';

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
  const toast = useToast();
  const [team, setTeam] = useState<Team | null>(null);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('potential');
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const teamsRes = await fetch('/api/teams', { cache: 'no-store' });
      if (!teamsRes.ok) return;
      const teamsData = await teamsRes.json();
      const first = teamsData.teams?.[0];
      if (!first) return;
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
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCopyCode = async () => {
    if (!team) return;
    try {
      await navigator.clipboard?.writeText(team.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.show('Код скопирован', 'success');
    } catch {
      toast.show('Не удалось скопировать', 'error');
    }
  };

  const handleShare = async () => {
    if (!team) return;
    const url = `${location.origin}/join/${team.inviteCode}`;
    const text = `Присоединяйся к команде «${team.name}» в Треньки! Код: ${team.inviteCode}`;
    type ShareNav = Navigator & { share?: (d: ShareData) => Promise<void> };
    const nav = navigator as ShareNav;
    if (nav.share) {
      try { await nav.share({ title: 'Команда', text, url }); } catch {}
    } else {
      handleCopyCode();
    }
  };

  const handleRegenerate = async () => {
    if (!team) return;
    if (!confirm('Сгенерировать новый код? Старый перестанет работать.')) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/regenerate-code`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTeam((prev) => prev ? { ...prev, inviteCode: data.team.inviteCode } : prev);
        toast.show('Новый код создан', 'success');
      } else {
        toast.show('Ошибка генерации', 'error');
      }
    } finally {
      setRegenerating(false);
    }
  };

  const sortedMembers = [...members].sort((a, b) => {
    if (sortKey === 'name') return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
    if (sortKey === 'potential') return b.potential - a.potential;
    const rank = (s: Member['assignmentStatus']) => s === 'in_progress' ? 0 : s === 'pending' ? 1 : 2;
    return rank(a.assignmentStatus) - rank(b.assignmentStatus);
  });

  return (
    <div className="min-h-screen bg-[#101530] text-white pb-24">
      <div className="px-5 py-6 max-w-3xl md:mx-auto md:px-8">
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

        {/* Invite-код */}
        {team && (
          <div
            className="mt-5"
            style={{
              background: '#060919',
              border: '1px solid #26252F',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div
                  className="font-overpass uppercase"
                  style={{ color: '#9B99AA', fontWeight: 700, fontSize: 10, letterSpacing: '0.5px' }}
                >
                  Код приглашения
                </div>
                <div
                  className="font-overpass"
                  style={{ color: '#A1FF4A', fontWeight: 900, fontSize: 22, letterSpacing: '0.25em', marginTop: 2 }}
                >
                  {team.inviteCode}
                </div>
              </div>
              <button
                type="button"
                onClick={handleShare}
                className="font-overpass uppercase"
                style={{
                  background: '#A1FF4A',
                  color: '#101530',
                  borderRadius: 999,
                  padding: '10px 14px',
                  fontWeight: 900,
                  fontSize: 11,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Поделиться
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex-1 font-overpass uppercase"
                style={{
                  background: copied ? '#A1FF4A' : 'transparent',
                  color: copied ? '#101530' : '#F9F8FE',
                  border: copied ? 'none' : '1px solid #26252F',
                  borderRadius: 999,
                  padding: '8px 12px',
                  fontWeight: 800,
                  fontSize: 10,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
              >
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="font-overpass uppercase"
                style={{
                  background: 'transparent',
                  color: '#AEABBB',
                  border: '1px solid #26252F',
                  borderRadius: 999,
                  padding: '8px 12px',
                  fontWeight: 800,
                  fontSize: 10,
                  letterSpacing: '0.05em',
                  cursor: regenerating ? 'not-allowed' : 'pointer',
                }}
              >
                {regenerating ? '...' : 'Новый код'}
              </button>
            </div>
          </div>
        )}

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
          {isLoading && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}
          {!isLoading && members.length === 0 && (
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

        {/* Переключатель аккаунтов (виден только когда сохранено >=2 аккаунта) */}
        <div className="mt-6">
          <AccountSwitcher />
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
