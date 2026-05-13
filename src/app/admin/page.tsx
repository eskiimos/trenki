'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AccountSwitcher from '@/components/AccountSwitcher';

const AdminPage = () => {
  return (
    <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6 md:mb-8">
          <Link href="/" className="text-white hover:text-gray-300 transition-colors">
            <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold">Админ-панель</h1>
        </div>

        {/* Переключатель мульти-аккаунта (виден всегда для админа: чтобы можно было добавить второй) */}
        <div className="mb-6 max-w-md">
          <AccountSwitcher />
        </div>
        
        {/* КОНТЕНТ */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-300 uppercase tracking-wider">📹 Контент</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {/* Управление видео */}
            <Link href="/admin/videos">
              <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
                <h3 className="text-xl md:text-2xl font-bold">Видео</h3>
              </div>
            </Link>

            {/* Управление Shorts */}
            <Link href="/admin/shorts">
              <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
                <h3 className="text-xl md:text-2xl font-bold">Треньки</h3>
              </div>
            </Link>

            {/* Управление тренерами */}
            <Link href="/admin/trainers">
              <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
                <h3 className="text-xl md:text-2xl font-bold">Тренеры</h3>
              </div>
            </Link>
          </div>
        </div>

        {/* СИСТЕМА */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-300 uppercase tracking-wider">⚙️ Система</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {/* Проверка контента */}
            <Link href="/admin/content-check">
              <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
                <h3 className="text-xl md:text-2xl font-bold">Проверка контента</h3>
              </div>
            </Link>
          </div>
        </div>

        {/* ПОЛЬЗОВАТЕЛИ */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-300 uppercase tracking-wider">👥 Пользователи</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {/* Управление пользователями */}
            <Link href="/admin/users">
              <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
                <h3 className="text-xl md:text-2xl font-bold">Пользователи</h3>
              </div>
            </Link>

            {/* Инвайт-коды */}
            <Link href="/admin/invite-codes">
              <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
                <h3 className="text-xl md:text-2xl font-bold">Инвайт-коды</h3>
              </div>
            </Link>

            {/* Администраторы */}
            <Link href="/admin/admins">
              <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
                <h3 className="text-xl md:text-2xl font-bold">🔐 Администраторы</h3>
                <p className="text-gray-400 text-sm mt-1">Назначить или снять права</p>
              </div>
            </Link>

            {/* Модерация отзывов */}
            <Link href="/admin/reviews">
              <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
                <h3 className="text-xl md:text-2xl font-bold">Отзывы</h3>
              </div>
            </Link>
          </div>
        </div>

        {/* АНАЛИТИКА И КОММУНИКАЦИЯ */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-300 uppercase tracking-wider">📊 Аналитика и коммуникация</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {/* Статистика */}
            <Link href="/admin/stats">
              <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
                <h3 className="text-xl md:text-2xl font-bold">Статистика</h3>
              </div>
            </Link>

            {/* Push-уведомления */}
            <Link href="/admin/notifications">
              <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
                <h3 className="text-xl md:text-2xl font-bold">Уведомления</h3>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
