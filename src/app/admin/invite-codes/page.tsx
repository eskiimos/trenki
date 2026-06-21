'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101530] text-white p-8 flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">🎫 Инвайт-коды</h1>
            <p className="text-gray-400">Управление кодами доступа</p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            ← Назад
          </Link>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1a1f3a] rounded-lg p-4 border border-white/5">
            <div className="text-gray-400 text-sm mb-1">Всего кодов</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-[#1a1f3a] rounded-lg p-4 border border-white/5">
            <div className="text-gray-400 text-sm mb-1">Активных</div>
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
          </div>
          <div className="bg-[#1a1f3a] rounded-lg p-4 border border-white/5">
            <div className="text-gray-400 text-sm mb-1">Использовано</div>
            <div className="text-2xl font-bold text-blue-400">{stats.used}</div>
          </div>
          <div className="bg-[#1a1f3a] rounded-lg p-4 border border-white/5">
            <div className="text-gray-400 text-sm mb-1">Исчерпано</div>
            <div className="text-2xl font-bold text-orange-400">{stats.fullyUsed}</div>
          </div>
        </div>

        {/* Поиск и фильтры */}
        <div className="bg-[#1a1f3a] rounded-lg p-4 mb-6 border border-white/5">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Поиск по коду, описанию или пользователю..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 bg-[#0D1425] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 bg-[#0D1425] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">Все коды</option>
              <option value="active">Активные</option>
              <option value="used">Использованные</option>
              <option value="unused">Неиспользованные</option>
            </select>
          </div>
        </div>

        {/* Список кодов */}
        <div className="space-y-4">
          {filteredCodes.map((code) => (
            <div
              key={code.id}
              className="bg-[#1a1f3a] rounded-lg p-6 border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl font-mono font-bold text-blue-400">
                      {code.code}
                    </span>
                    {!code.isActive && (
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                        Деактивирован
                      </span>
                    )}
                    {code.usedCount >= code.maxUses && (
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded">
                        Исчерпан
                      </span>
                    )}
                  </div>
                  {code.description && (
                    <p className="text-gray-400 text-sm mb-2">{code.description}</p>
                  )}
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>
                      Использовано: {code.usedCount} / {code.maxUses}
                    </span>
                    <span>
                      Создан: {new Date(code.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleCodeStatus(code.id, code.isActive)}
                    className={`px-3 py-1 rounded text-sm ${
                      code.isActive
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    }`}
                  >
                    {code.isActive ? 'Деактивировать' : 'Активировать'}
                  </button>
                  <button
                    onClick={() => setSelectedCode(selectedCode?.id === code.id ? null : code)}
                    className="px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-sm"
                  >
                    {selectedCode?.id === code.id ? 'Скрыть' : 'Подробнее'}
                  </button>
                </div>
              </div>

              {/* Пользователи, использовавшие код */}
              {selectedCode?.id === code.id && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h3 className="text-lg font-semibold mb-3">
                    Пользователи ({code.users.length})
                  </h3>
                  {code.users.length === 0 ? (
                    <p className="text-gray-500">Код ещё не использовался</p>
                  ) : (
                    <div className="space-y-2">
                      {code.users.map((user) => (
                        <div
                          key={user.id}
                          className="bg-[#0D1425] rounded-lg p-4 border border-gray-700"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">
                                {user.firstName || user.username || 'Без имени'}{' '}
                                {user.lastName || ''}
                              </div>
                              <div className="text-sm text-gray-400">
                                @{user.username || 'no_username'} • ID: {user.telegramId}
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => deleteCode(code.id)}
                    className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-sm"
                  >
                    Удалить код
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredCodes.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Коды не найдены
          </div>
        )}
      </div>
    </div>
  );
}
