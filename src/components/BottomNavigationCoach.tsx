'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface BottomNavigationCoachProps {
  activeTab?: 'team' | 'assignments' | 'profile';
}

/**
 * Таббар для тренерского кабинета.
 * MVP: 3 активные вкладки (Команда / Задания / Профиль).
 * Будут добавлены позже: Статистика, Тренерская доска.
 */
const BottomNavigationCoach: React.FC<BottomNavigationCoachProps> = ({ activeTab = 'team' }) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#060919] border-t border-[#101530] px-4 z-40"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', paddingTop: 12 }}
    >
      <div className="flex justify-between items-center max-w-md mx-auto md:max-w-2xl">
        <Link href="/coach/team" className="flex items-center justify-center p-2">
          <Image
            src={activeTab === 'team'
              ? '/icons/tapbar/new_active/Type_hockey.svg'
              : '/icons/tapbar/icon-type-hockey-active-no.svg'}
            alt="Команда"
            width={32}
            height={32}
          />
        </Link>

        <Link href="/coach/assignments" className="flex items-center justify-center p-2">
          <Image
            src={activeTab === 'assignments'
              ? '/icons/tapbar/new_active/Type_calendar.svg'
              : '/icons/tapbar/icon-type-calendar-active-no.svg'}
            alt="Задания"
            width={32}
            height={32}
          />
        </Link>

        {/* Заглушка: Статистика — скоро */}
        <div className="flex items-center justify-center p-2 opacity-30 cursor-not-allowed" title="Скоро">
          <Image
            src="/icons/tapbar/icon-type-play-active-no.svg"
            alt="Статистика (скоро)"
            width={32}
            height={32}
          />
        </div>

        {/* Заглушка: Доска — скоро */}
        <div className="flex items-center justify-center p-2 opacity-30 cursor-not-allowed" title="Скоро">
          <Image
            src="/icons/tapbar/icon-type-home-active-no.svg"
            alt="Доска (скоро)"
            width={32}
            height={32}
          />
        </div>

        <Link href="/coach/profile" className="flex items-center justify-center p-2">
          <Image
            src={activeTab === 'profile'
              ? '/icons/tapbar/new_active/Type_hockey-mask.svg'
              : '/icons/tapbar/icon-type-hockey-mask-active-no.svg'}
            alt="Профиль"
            width={32}
            height={32}
          />
        </Link>
      </div>
    </nav>
  );
};

export default BottomNavigationCoach;
