'use client';

import React, { useState, useEffect } from 'react';
import {
  AdminPage,
  PageHeader,
  AdminCard,
  AdminButton,
  Kpi,
  EmptyState,
  inputStyle,
} from '@/components/admin/ui';
import {
  Ticket,
  Search,
  ChevronDown,
  ChevronUp,
  Power,
  PowerOff,
  Trash2,
  Users,
  CheckCircle2,
  CircleSlash,
} from 'lucide-react';

interface User {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  createdAt: string;
}

interface InviteCode {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
  description: string | null;
  users: User[];
}

interface Stats {
  total: number;
  active: number;
  used: number;
  fullyUsed: number;
}

/** Статусный бейдж карточки кода — pill + токены вместо red/orange-500/20. */
function StatusBadge({ tone, children }: { tone: 'danger' | 'muted'; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 'var(--radius-pill)',
        whiteSpace: 'nowrap',
        background: tone === 'danger' ? 'rgba(255,140,74,0.15)' : 'rgba(174,171,187,0.18)',
        color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-muted)',
      }}
    >
      {children}
    </span>
  );
}

export default function InviteCodesAdminPage() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, used: 0, fullyUsed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'used' | 'unused'>('all');
  const [selectedCode, setSelectedCode] = useState<InviteCode | null>(null);

  useEffect(() => {
    loadInviteCodes();
  }, []);

  const loadInviteCodes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/invite-codes');
      const data = await response.json();
      setCodes(data.codes);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading invite codes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCodeStatus = async (codeId: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/invite-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, isActive: !currentStatus }),
      });

      if (response.ok) {
        loadInviteCodes();
      }
    } catch (error) {
      console.error('Error toggling code status:', error);
    }
  };

  const deleteCode = async (codeId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот код?')) return;

    try {
      const response = await fetch(`/api/admin/invite-codes?id=${codeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadInviteCodes();
        setSelectedCode(null);
      }
    } catch (error) {
      console.error('Error deleting code:', error);
    }
  };

  const filteredCodes = codes.filter((code) => {
    const matchesSearch =
      code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.users.some(
        (user) =>
          user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.username?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'active' && code.isActive) ||
      (filterStatus === 'used' && code.usedCount > 0) ||
      (filterStatus === 'unused' && code.usedCount === 0);

    return matchesSearch && matchesFilter;
  });

  // Пустой список: различаем «ничего не создано» и «ничего не нашлось по фильтру»
  const filtersApplied = searchTerm.trim() !== '' || filterStatus !== 'all';

  return (
    <AdminPage>
      <PageHeader
        title="Инвайт-коды"
        icon={Ticket}
        subtitle="Управление кодами доступа"
        backHref="/admin"
      />

      {/* Статистика */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginBottom: 24 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 96,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--border-hairline)',
              }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginBottom: 24 }}>
          <Kpi icon={Ticket} label="Всего кодов" value={stats.total} />
          <Kpi icon={Power} label="Активных" value={stats.active} accent />
          <Kpi icon={Users} label="Использовано" value={stats.used} />
          <Kpi icon={CircleSlash} label="Исчерпано" value={stats.fullyUsed} />
        </div>
      )}

      {/* Поиск и фильтры */}
      <AdminCard style={{ marginBottom: 24 }}>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              aria-hidden
              className="absolute pointer-events-none"
              style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }}
            />
            <input
              type="text"
              placeholder="Поиск по коду, описанию или пользователю..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Поиск по кодам"
              style={{ ...inputStyle, paddingLeft: 40 }}
            />
          </div>
          <div className="relative md:w-64">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              aria-label="Фильтр по статусу"
              className="appearance-none"
              style={{ ...inputStyle, paddingRight: 40 }}
            >
              <option value="all">Все коды</option>
              <option value="active">Активные</option>
              <option value="used">Использованные</option>
              <option value="unused">Неиспользованные</option>
            </select>
            <ChevronDown
              size={16}
              aria-hidden
              className="absolute pointer-events-none"
              style={{ right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }}
            />
          </div>
        </div>
      </AdminCard>

      {/* Список кодов */}
      {isLoading ? (
        <div className="flex flex-col" style={{ gap: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 140,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--border-hairline)',
              }}
            />
          ))}
        </div>
      ) : filteredCodes.length === 0 ? (
        filtersApplied ? (
          <EmptyState
            icon={Search}
            title="Коды не найдены"
            hint="Попробуйте изменить поиск или сбросить фильтр"
          />
        ) : (
          <EmptyState icon={Ticket} title="Кодов пока нет" hint="Ни одного инвайт-кода не создано" />
        )
      ) : (
        <div className="flex flex-col" style={{ gap: 16 }}>
          {filteredCodes.map((code) => {
            const open = selectedCode?.id === code.id;
            return (
              <AdminCard key={code.id} style={{ padding: 24 }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 8 }}>
                      <span
                        className="font-mono"
                        style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-brand)' }}
                      >
                        {code.code}
                      </span>
                      {!code.isActive && <StatusBadge tone="danger">Деактивирован</StatusBadge>}
                      {code.usedCount >= code.maxUses && (
                        <StatusBadge tone="muted">Исчерпан</StatusBadge>
                      )}
                    </div>
                    {code.description && (
                      <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 8px' }}>
                        {code.description}
                      </p>
                    )}
                    <div
                      className="flex flex-wrap gap-4"
                      style={{ fontSize: 12, color: 'var(--color-muted)' }}
                    >
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 size={16} aria-hidden />
                        Использовано: {code.usedCount} / {code.maxUses}
                      </span>
                      <span>Создан: {new Date(code.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap shrink-0">
                    <AdminButton
                      size="sm"
                      tone="secondary"
                      icon={code.isActive ? PowerOff : Power}
                      onClick={() => toggleCodeStatus(code.id, code.isActive)}
                    >
                      {code.isActive ? 'Деактивировать' : 'Активировать'}
                    </AdminButton>
                    <AdminButton
                      size="sm"
                      tone="secondary"
                      icon={open ? ChevronUp : ChevronDown}
                      onClick={() => setSelectedCode(open ? null : code)}
                    >
                      {open ? 'Скрыть' : 'Подробнее'}
                    </AdminButton>
                    <AdminButton
                      size="sm"
                      tone="danger"
                      icon={Trash2}
                      onClick={() => deleteCode(code.id)}
                    >
                      Удалить
                    </AdminButton>
                  </div>
                </div>

                {/* Пользователи, использовавшие код */}
                {open && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: '1px solid var(--border-hairline)',
                    }}
                  >
                    <h3
                      className="flex items-center gap-2"
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--color-muted)',
                        margin: '0 0 12px',
                      }}
                    >
                      <Users size={16} aria-hidden />
                      Пользователи ({code.users.length})
                    </h3>
                    {code.users.length === 0 ? (
                      <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
                        Код ещё не использовался
                      </p>
                    ) : (
                      <div className="flex flex-col" style={{ gap: 8 }}>
                        {code.users.map((user) => (
                          <div
                            key={user.id}
                            style={{
                              background: 'var(--color-night)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-hairline)',
                              padding: 16,
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div style={{ fontSize: 14, fontWeight: 700 }} className="truncate">
                                  {user.firstName || user.username || 'Без имени'}{' '}
                                  {user.lastName || ''}
                                </div>
                                {/* Идентификаторы для поиска юзера: username и
                                    telegramId (по ним же работает поиск выше),
                                    внутренний id — как фолбэк. */}
                                <div
                                  className="font-mono truncate"
                                  style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}
                                >
                                  {user.username ? `@${user.username} · ` : ''}
                                  {user.telegramId ? `ID: ${user.telegramId}` : user.id}
                                </div>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--color-muted)', flexShrink: 0 }}>
                                {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </AdminCard>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}
