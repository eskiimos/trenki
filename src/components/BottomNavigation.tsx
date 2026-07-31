'use client';

import React from 'react';
import Link from 'next/link';
import { House, SquarePlay, Swords, Calendar, CircleUserRound } from 'lucide-react';

interface BottomNavigationProps {
  activeTab?: 'home' | 'video' | 'shorts' | 'hockey' | 'calendar' | 'profile';
}

// Цвета иконок таббара: активная — лаймовый акцент, неактивная — приглушённый серый
const ACTIVE_COLOR = '#A1FF4A';
const INACTIVE_COLOR = '#AEABBB';

const iconColor = (isActive: boolean) => (isActive ? ACTIVE_COLOR : INACTIVE_COLOR);

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab = 'home' }) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#060919] border-t border-[#101530] px-4 z-40"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', paddingTop: 12 }}
    >
      <div className="flex justify-between items-center max-w-md mx-auto">
        <Link href="/" className="flex items-center justify-center p-2" aria-label="Главная">
          <House size={32} color={iconColor(activeTab === 'home')} aria-hidden="true" />
        </Link>

        <Link href="/shorts-catalog" className="flex items-center justify-center p-2" aria-label="Треньки">
          <SquarePlay size={32} color={iconColor(activeTab === 'shorts')} aria-hidden="true" />
        </Link>

        <Link href="/video" className="flex items-center justify-center p-2" aria-label="Видео">
          <Swords size={32} color={iconColor(activeTab === 'video')} aria-hidden="true" />
        </Link>

        <Link href="/calendar" className="flex items-center justify-center p-2" aria-label="Расписание">
          <Calendar size={32} color={iconColor(activeTab === 'calendar')} aria-hidden="true" />
        </Link>

        <Link href="/profile" className="flex items-center justify-center p-2" aria-label="Профиль">
          <CircleUserRound size={32} color={iconColor(activeTab === 'profile')} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
};

export default BottomNavigation;
