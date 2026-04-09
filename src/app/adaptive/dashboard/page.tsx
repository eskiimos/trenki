'use client';

import Link from 'next/link';

export default function AdaptiveDashboardPage() {
  const modules = [
    { icon: '🏋️', title: 'Тренировки', href: '/adaptive/training', desc: 'Персональные программы', color: 'blue' },
    { icon: '📊', title: 'Шкала FIM', href: '/adaptive/fim', desc: 'Оценка функциональности', color: 'purple' },
    { icon: '📋', title: 'Шкала CARS', href: '/adaptive/cars', desc: 'Оценка прогресса', color: 'green' },
    { icon: '👤', title: 'Профиль', href: '/adaptive/profile', desc: 'Личные данные', color: 'orange' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600/20 border-blue-600/30 text-blue-400',
    purple: 'bg-purple-600/20 border-purple-600/30 text-purple-400',
    green: 'bg-green-600/20 border-green-600/30 text-green-400',
    orange: 'bg-orange-600/20 border-orange-600/30 text-orange-400',
  };

  return (
    <div className="min-h-screen bg-[#060919] text-white">
      {/* Шапка */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">А</div>
          <span className="font-bold text-lg tracking-wide">АДАПТИВ</span>
        </div>
        <Link href="/adaptive/profile" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">
          👤
        </Link>
      </header>

      <main className="px-5 py-6">
        {/* Приветствие */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Главная</h1>
          <p className="text-gray-400 text-sm mt-1">Добро пожаловать в адаптивный модуль</p>
        </div>

        {/* Модули */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {modules.map((mod) => (
            <Link
              key={mod.title}
              href={mod.href}
              className={`rounded-2xl p-4 border flex flex-col gap-2 transition-opacity hover:opacity-80 ${colorMap[mod.color]}`}
            >
              <span className="text-3xl">{mod.icon}</span>
              <div>
                <div className="font-semibold text-white text-sm">{mod.title}</div>
                <div className="text-xs opacity-70 mt-0.5">{mod.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Последние активности — заглушка */}
        <div>
          <h2 className="font-semibold text-base mb-3">Последние тренировки</h2>
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="flex-1">
                  <div className="h-3 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
            <p className="text-center text-xs text-gray-600 mt-2">Тренировки появятся после первого занятия</p>
          </div>
        </div>
      </main>
    </div>
  );
}
