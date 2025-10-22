'use client';

import { useEffect, useState } from 'react';

export default function AppLoader() {
  const [isLoading, setIsLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Запускаем анимацию через небольшую задержку
    const activateTimer = setTimeout(() => {
      setIsActive(true);
    }, 100);

    // Начинаем fade-out через 1.2 секунды
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 1200);

    // Полностью скрываем через 1.7 секунды
    const hideTimer = setTimeout(() => {
      setIsLoading(false);
    }, 1700);

    return () => {
      clearTimeout(activateTimer);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-[#445CFF] via-[#5B6FFF] to-[#7284FF] transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-8">
        {/* SVG Анимация */}
        <svg 
          width="187" 
          height="93" 
          viewBox="0 0 374 186" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className={`logo-animation ${isActive ? 'active' : ''}`}
        >
          <path 
            d="M369.064 93.1631C365.343 102.475 360.988 111.429 354.406 119.843C352.615 122.132 350.44 125.064 347.716 126.624C342.452 129.64 335.215 129.19 330.15 128.31C316.446 125.93 304.542 118.56 294.151 111.419C275.871 98.8584 260.363 83.5756 244.607 68.6482C232.759 57.4228 220.771 46.399 208.066 35.9463C195.248 25.4001 182.142 13.9531 166.775 6.12331C159.536 2.43487 154.323 3.17646 149.265 11.3573C139.56 27.0527 137.761 45.654 137.722 61.7406C137.679 79.3924 140.364 96.6482 145.91 112.71C151.956 130.22 162.009 145.567 174.026 159.56C179.642 166.099 186.314 171.929 191.576 178.733C193.096 180.699 192.199 181.705 189.274 181.807C184.177 181.986 179.215 180.512 174.925 178.859C158.937 172.7 141.465 164.947 128.241 155.387C107.829 140.629 101.289 135.919 74.5483 104.863C67.9587 96.26 66.3816 92.7906 61.6302 85.2906C61.1882 84.5929 44.3464 59.8821 41.9968 69.2441C40.314 69.6121 69.2764 121.667 47.6875 128.377C30.7664 133.637 33.7727 109.079 16.48 110.496C-3.81084 112.159 6.74403 146.125 6.74403 156.198" 
            stroke="#F9F8FE" 
            strokeWidth="8" 
            strokeLinecap="round" 
            className="svg-elem-1"
          />
        </svg>

        {/* Текст загрузки */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-white text-3xl font-bold tracking-tight">Треньки</h1>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .logo-animation .svg-elem-1 {
          stroke-dashoffset: 827.2099609375px;
          stroke-dasharray: 827.2099609375px;
          transition: stroke-dashoffset 1s cubic-bezier(0.47, 0, 0.745, 0.715) 0s;
        }

        .logo-animation.active .svg-elem-1 {
          stroke-dashoffset: 0;
        }
      `}</style>
    </div>
  );
}
