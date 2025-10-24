'use client';

import React from 'react';
import Link from 'next/link';

const AdminPage = () => {
  return (
    <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8">Админ-панель</h1>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {/* Управление видео */}
          <Link href="/admin/videos">
            <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
              <h2 className="text-xl md:text-2xl font-bold mb-2">Видео</h2>
              <p className="text-sm md:text-base text-gray-400">Управление видеоконтентом</p>
            </div>
          </Link>

          {/* Управление тренерами */}
          <Link href="/admin/trainers">
            <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
              <h2 className="text-xl md:text-2xl font-bold mb-2">Тренеры</h2>
              <p className="text-sm md:text-base text-gray-400">Управление тренерами</p>
            </div>
          </Link>

          {/* Управление Shorts */}
          <Link href="/admin/shorts">
            <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
              <h2 className="text-xl md:text-2xl font-bold mb-2">Shorts</h2>
              <p className="text-sm md:text-base text-gray-400">Управление короткими видео</p>
            </div>
          </Link>

          {/* Управление пользователями */}
          <Link href="/admin/users">
            <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
              <h2 className="text-xl md:text-2xl font-bold mb-2">Пользователи</h2>
              <p className="text-sm md:text-base text-gray-400">Управление пользователями</p>
            </div>
          </Link>

          {/* Статистика */}
          <Link href="/admin/stats">
            <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
              <h2 className="text-xl md:text-2xl font-bold mb-2">Статистика</h2>
              <p className="text-sm md:text-base text-gray-400">Просмотр аналитики</p>
            </div>
          </Link>

          {/* Push-уведомления */}
          <Link href="/admin/notifications">
            <div className="bg-[#1a1f3a] rounded-lg p-5 md:p-6 hover:bg-[#2d3448] transition-colors cursor-pointer h-full border border-white/5">
              <h2 className="text-xl md:text-2xl font-bold mb-2">📬 Уведомления</h2>
              <p className="text-sm md:text-base text-gray-400">Push-уведомления пользователям</p>
            </div>
          </Link>

          {/* Управление тренировочными модулями */}
          <Link href="/admin/training-modules">
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg p-5 md:p-6 hover:opacity-90 transition-opacity cursor-pointer h-full border border-white/10">
              <h2 className="text-xl md:text-2xl font-bold mb-2">⚙️ Тренировочные модули</h2>
              <p className="text-sm md:text-base text-gray-200">Управление модулями для алгоритма</p>
            </div>
          </Link>
        </div>

        <div className="mt-6 md:mt-8">
          <Link href="/" className="inline-block text-blue-400 hover:text-blue-300 text-sm md:text-base">
            ← Вернуться на главную
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
