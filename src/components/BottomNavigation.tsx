'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface BottomNavigationProps {
  activeTab?: 'home' | 'video' | 'shorts' | 'hockey' | 'calendar' | 'profile';
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab = 'home' }) => {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/assignments?role=athlete', { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled) return;
        const list = (d.assignments ?? []) as Array<{ status: string }>;
        setPendingCount(list.filter((a) => a.status !== 'COMPLETED').length);
      } catch {}
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#060919] border-t border-[#101530] px-4 z-40"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', paddingTop: 12 }}
    >
      <div className="flex justify-between items-center max-w-md mx-auto">
        <Link href="/" className="flex items-center justify-center p-2">
          <Image 
            src={activeTab === 'home'
              ? '/icons/tapbar/new_active/Type_home.svg'
              : '/icons/tapbar/icon-type-home-active-no.svg'}
            alt="Главная" 
            width={32} 
            height={32} 
          />
        </Link>
        
        <Link href="/shorts-catalog" className="flex items-center justify-center p-2">
          <Image 
            src={activeTab === 'shorts'
              ? '/icons/tapbar/new_active/Type_play.svg'
              : '/icons/tapbar/icon-type-play-active-no.svg'}
            alt="Треньки" 
            width={32} 
            height={32} 
          />
        </Link>
        
        <Link href="/video" className="flex items-center justify-center p-2">
          <Image 
            src={activeTab === 'video'
              ? '/icons/tapbar/new_active/Type_hockey.svg'
              : '/icons/tapbar/icon-type-hockey-active-no.svg'}
            alt="Видео" 
            width={32} 
            height={32} 
          />
        </Link>
        
        <Link href="/calendar" className="flex items-center justify-center p-2">
          <Image 
            src={activeTab === 'calendar'
              ? '/icons/tapbar/new_active/Type_calendar.svg'
              : '/icons/tapbar/icon-type-calendar-active-no.svg'}
            alt="Расписание" 
            width={32} 
            height={32} 
          />
        </Link>
        
        <Link href="/profile" className="flex items-center justify-center p-2 relative">
          <Image 
            src={activeTab === 'profile'
              ? '/icons/tapbar/new_active/Type_hockey-mask.svg'
              : '/icons/tapbar/icon-type-hockey-mask-active-no.svg'}
            alt="Профиль" 
            width={32} 
            height={32} 
          />
          {pendingCount > 0 && (
            <span
              className="font-overpass"
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                background: '#A1FF4A',
                color: '#101530',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 900,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
};

export default BottomNavigation;