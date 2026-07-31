'use client';

import React from 'react';
import Link from 'next/link';
import { House, SquarePlay, Swords, Calendar, CircleUserRound } from 'lucide-react';

interface BottomNavigationCoachProps {
  activeTab?: 'team' | 'assignments' | 'profile';
}

// Цвета иконок таббара: активная — лаймовый акцент, неактивная — приглушённый серый
const ACTIVE_COLOR = '#A1FF4A';
const INACTIVE_COLOR = '#AEABBB';

const iconColor = (isActive: boolean) => (isActive ? ACTIVE_COLOR : INACTIVE_COLOR);

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
        <Link href="/coach/team" className="flex items-center justify-center p-2" aria-label="Команда">
          <Swords size={32} color={iconColor(activeTab === 'team')} aria-hidden="true" />
        </Link>

        <Link href="/coach/assignments" className="flex items-center justify-center p-2" aria-label="Задания">
          <Calendar size={32} color={iconColor(activeTab === 'assignments')} aria-hidden="true" />
        </Link>

        {/* Заглушка: Статистика — скоро */}
        <div className="flex items-center justify-center p-2 opacity-30 cursor-not-allowed" title="Скоро">
          <SquarePlay size={32} color={INACTIVE_COLOR} aria-label="Статистика (скоро)" />
        </div>

        {/* Заглушка: Доска — скоро */}
        <div className="flex items-center justify-center p-2 opacity-30 cursor-not-allowed" title="Скоро">
          <House size={32} color={INACTIVE_COLOR} aria-label="Доска (скоро)" />
        </div>

        <Link href="/coach/profile" className="flex items-center justify-center p-2" aria-label="Профиль">
          <CircleUserRound size={32} color={iconColor(activeTab === 'profile')} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
};

export default BottomNavigationCoach;
