'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AdaptiveHomePage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#060919] text-white flex flex-col">
      {/* Шапка */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">А</div>
          <span className="font-bold text-lg tracking-wide">АДАПТИВ</span>
        </div>
        <Link
          href="/adaptive/login"
          className="px-4 py-1.5 text-sm rounded-full border border-white/30 hover:border-white/60 transition-colors"
        >
          Войти
        </Link>
      </header>

      {/* Hero */}
      <main className={`flex-1 flex flex-col items-center justify-center px-6 text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="mb-6">
          <span className="inline-block px-3 py-1 text-xs rounded-full bg-blue-600/20 text-blue-400 border border-blue-600/30 mb-4">
            Адаптивный спорт
          </span>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Тренировки для<br />
            <span className="text-blue-400">каждого</span>
          </h1>
          <p className="text-gray-400 max-w-sm mx-auto text-base leading-relaxed">
            Специализированные программы, шкалы FIM/CARS и персональная аналитика для атлетов адаптивного спорта.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
          <Link
            href="/adaptive/login"
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-center transition-colors"
          >
            Начать тренировки
          </Link>
          <Link
            href="/adaptive/about"
            className="w-full py-3 rounded-xl border border-white/20 hover:border-white/40 font-semibold text-center transition-colors"
          >
            Узнать больше
          </Link>
        </div>

        {/* Ключевые модули */}
        <div className="grid grid-cols-2 gap-3 mt-12 w-full max-w-sm">
          {[
            { icon: '🏋️', title: 'Тренировки', desc: 'Специальные программы' },
            { icon: '📊', title: 'Аналитика', desc: 'FIM / CARS шкалы' },
            { icon: '👤', title: 'Профиль', desc: 'Личный прогресс' },
            { icon: '🤝', title: 'Тренер', desc: 'Связь с командой' },
          ].map((item) => (
            <div key={item.title} className="bg-white/5 rounded-xl p-4 text-left border border-white/10">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-semibold text-sm">{item.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Футер */}
      <footer className="px-5 py-4 text-center text-xs text-gray-600 border-t border-white/5">
        adaptive.trenki.app · Проект ТРЕНЬКИ
      </footer>
    </div>
  );
}
