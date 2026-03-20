'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface BottomNavigationProps {
  activeTab?: 'home' | 'video' | 'shorts' | 'hockey' | 'calendar' | 'profile';
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab = 'home' }) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#060919] border-t border-[#101530] px-4 z-40"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', paddingTop: 12 }}
    >
      <div className="flex justify-around items-center max-w-md mx-auto">
        <Link href="/" className="flex items-center justify-center p-2">
          <Image 
            src={activeTab === 'home'
              ? '/icons/tapbar/new_active/Type=home, Active=Yes.svg'
              : '/icons/tapbar/icon-type-home-active-no.svg'}
            alt="Главная" 
            width={32} 
            height={32} 
          />
        </Link>
        
        <Link href="/shorts-catalog" className="flex items-center justify-center p-2">
          <Image 
            src={activeTab === 'shorts'
              ? '/icons/tapbar/new_active/Type=play, Active=Yes.svg'
              : '/icons/tapbar/icon-type-play-active-no.svg'}
            alt="Треньки" 
            width={32} 
            height={32} 
          />
        </Link>
        
        <Link href="/video" className="flex items-center justify-center p-2">
          <Image 
            src={activeTab === 'video'
              ? '/icons/tapbar/new_active/Type=hockey, Active=Yes.svg'
              : '/icons/tapbar/icon-type-hockey-active-no.svg'}
            alt="Видео" 
            width={32} 
            height={32} 
          />
        </Link>
        
        <Link href="/calendar" className="flex items-center justify-center p-2">
          <Image 
            src={activeTab === 'calendar'
              ? '/icons/tapbar/new_active/Type=calendar, Active=Yes.svg'
              : '/icons/tapbar/icon-type-calendar-active-no.svg'}
            alt="Расписание" 
            width={32} 
            height={32} 
          />
        </Link>
        
        <Link href="/profile" className="flex items-center justify-center p-2">
          <Image 
            src={activeTab === 'profile'
              ? '/icons/tapbar/new_active/Type=hockey-mask, Active=Yes.svg'
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

export default BottomNavigation;