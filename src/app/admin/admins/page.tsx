'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
    <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-white hover:text-gray-300">
            <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
          </Link>
          <h1 className="text-2xl font-bold">Управление администраторами</h1>
        </div>

        {/* Добавить admin */}
        <div className="bg-[#1a1f3a] rounded-xl p-5 mb-6 border border-white/5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Добавить администратора</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Email или User ID"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAdmin()}
              className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-[#A1FF4A]"
            />
            <button
              onClick={addAdmin}
              disabled={adding || !identifier.trim()}
              className="px-5 py-2 rounded-full text-sm font-bold bg-[#A1FF4A] text-[#0A0E1A] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adding ? '...' : 'Добавить'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Пользователь должен быть уже зарегистрирован. Введи email
            (для email-юзеров) или User ID (cuid из БД).
          </p>
        </div>

        {error && <div className="bg-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-500/20 text-green-400 rounded-xl px-4 py-3 mb-4 text-sm">{success}</div>}

        {/* Список админов */}
        <div className="bg-[#1a1f3a] rounded-xl border border-white/5">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Текущие администраторы ({admins.length})
            </h2>
          </div>
          {loading ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">Загрузка...</div>
          ) : admins.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">Нет администраторов</div>
          ) : (
            <ul>
              {admins.map((admin, i) => (
                <li key={admin.id} className={`flex items-center justify-between px-5 py-4 ${i < admins.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div>
                    <div className="font-semibold">
                      {admin.firstName} {admin.lastName}
                      {admin.username && <span className="text-gray-400 text-sm ml-1">@{admin.username}</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">
                      {admin.email ?? admin.id}
                    </div>
                  </div>
                  <button
                    onClick={() => removeAdmin(admin.email ?? admin.id)}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded-full px-3 py-1 transition-colors ml-4 flex-shrink-0"
                  >
                    Снять права
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
