'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getTelegramId } from '@/lib/auth';

interface BottomNavigationProps {
  activeTab?: 'home' | 'video' | 'shorts' | 'hockey' | 'calendar' | 'profile';
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab = 'home' }) => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const telegramId = getTelegramId();
    if (!telegramId) return;
    fetch(`/api/user/is-admin?telegramId=${telegramId}`)
      .then(r => r.json())
      .then(d => setIsAdmin(d.isAdmin === true))
      .catch(() => {});
  }, []);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#101530] border-t border-[#2d3448] px-4 z-40"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', paddingTop: 12 }}
    >
      <div className="flex justify-around items-center max-w-md mx-auto">
        <Link href="/" className="flex items-center justify-center p-2">
          <Image 
            src={`/icons/tapbar/icon-type-home-active-${activeTab === 'home' ? 'yes' : 'no'}.svg`}
            alt="Главная" 
            width={28} 
            height={28} 
          />
        </Link>
        
        <Link href="/shorts-catalog" className="flex items-center justify-center p-2">
          <Image 
            src={`/icons/tapbar/icon-type-play-active-${activeTab === 'shorts' ? 'yes' : 'no'}.svg`}
            alt="Треньки" 
            width={28} 
            height={28} 
          />
        </Link>
        
        <Link href="/video" className="flex items-center justify-center p-2">
          <Image 
            src={`/icons/tapbar/icon-type-hockey-active-${activeTab === 'video' ? 'yes' : 'no'}.svg`}
            alt="Видео" 
            width={28} 
            height={28} 
          />
        </Link>
        
        <Link href="/calendar" className="flex items-center justify-center p-2">
          <Image 
            src={`/icons/tapbar/icon-type-calendar-active-${activeTab === 'calendar' ? 'yes' : 'no'}.svg`}
            alt="Расписание" 
            width={28} 
            height={28} 
          />
        </Link>
        
        <Link href="/profile" className="flex items-center justify-center p-2">
          <Image 
            src={`/icons/tapbar/icon-type-hockey-mask-active-${activeTab === 'profile' ? 'yes' : 'no'}.svg`}
            alt="Профиль" 
            width={28} 
            height={28} 
          />
        </Link>

        {isAdmin && (
          <Link href="/admin" className="flex items-center justify-center p-2">
            <span className="text-[10px] font-bold text-[#A1FF4A] leading-none text-center">
              АД<br />МИН
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default BottomNavigation;