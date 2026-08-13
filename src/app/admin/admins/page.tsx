'use client';

import { useEffect, useState } from 'react';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  AdminButton,
  EmptyState,
  inputStyle,
} from '@/components/admin/ui';
import {
  ShieldCheck,
  UserPlus,
  UserMinus,
  Users,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface Admin {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
  createdAt: string;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/admins', { credentials: 'include' });
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch {
      setError('Ошибка загрузки списка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const addAdmin = async () => {
    if (!identifier.trim()) return;
    setAdding(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка');
      } else {
        setSuccess('Администратор добавлен');
        setIdentifier('');
        fetchAdmins();
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setAdding(false);
    }
  };

  const removeAdmin = async (userIdOrEmail: string) => {
    if (!confirm('Снять права администратора?')) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: userIdOrEmail }),
      });
      if (res.ok) {
        setSuccess('Права сняты');
        fetchAdmins();
      } else {
        const data = await res.json();
        setError(data.error || 'Ошибка');
      }
    } catch {
      setError('Ошибка сети');
    }
  };

  return (
    <AdminPage width="narrow">
      <PageHeader title="Администраторы" icon={ShieldCheck} backHref="/admin" />

      {/* Добавить админа */}
      <AdminCard style={{ marginBottom: 16 }}>
        <SectionTitle icon={UserPlus}>Добавить администратора</SectionTitle>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Email или User ID"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addAdmin()}
            style={inputStyle}
          />
          <AdminButton
            onClick={addAdmin}
            disabled={adding || !identifier.trim()}
            icon={adding ? undefined : UserPlus}
            style={{ minWidth: 148, flexShrink: 0 }}
          >
            {adding ? <Loader2 size={20} className="animate-spin" aria-hidden /> : 'Добавить'}
          </AdminButton>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8, lineHeight: 1.4 }}>
          Пользователь должен быть уже зарегистрирован. Введи email
          (для email-юзеров) или User ID (cuid из БД).
        </p>
      </AdminCard>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <AdminCard tone="danger">
            <div className="flex items-center gap-3" role="status" aria-live="polite">
              <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: 14 }}>{error}</span>
            </div>
          </AdminCard>
        </div>
      )}
      {success && (
        <div style={{ marginBottom: 16 }}>
          <AdminCard tone="accent">
            <div className="flex items-center gap-3" role="status" aria-live="polite">
              <Check size={20} style={{ color: 'var(--color-brand)', flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: 14 }}>{success}</span>
            </div>
          </AdminCard>
        </div>
      )}

      {/* Список админов */}
      <SectionTitle icon={Users}>Текущие администраторы ({admins.length})</SectionTitle>
      <AdminCard style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  height: 44,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-night)',
                  marginBottom: i < 2 ? 12 : 0,
                }}
              />
            ))}
          </div>
        ) : admins.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Нет администраторов"
            hint="Добавьте первого администратора по email"
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
            {admins.map((admin) => (
              <li key={admin.id} className="flex items-center justify-between gap-3" style={{ padding: 16 }}>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span style={{ fontSize: 14, fontWeight: 700 }} className="truncate">
                      {[admin.firstName, admin.lastName].filter(Boolean).join(' ') || 'Без имени'}
                    </span>
                    {admin.username && (
                      <span
                        className="truncate shrink-0"
                        style={{ fontSize: 12, color: 'var(--color-muted)' }}
                      >
                        @{admin.username}
                      </span>
                    )}
                  </div>
                  <div
                    className="font-mono truncate"
                    style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}
                  >
                    {admin.email ?? admin.id}
                  </div>
                </div>
                <AdminButton
                  tone="danger"
                  size="sm"
                  icon={UserMinus}
                  onClick={() => removeAdmin(admin.email ?? admin.id)}
                  style={{ flexShrink: 0 }}
                >
                  Снять права
                </AdminButton>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </AdminPage>
  );
}
