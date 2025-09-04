import { useEffect, useRef } from 'react';

export const usePreventTelegramCollapse = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      isDragging = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      // Если скроллим быстро вниз, предотвращаем стандартное поведение
      if (deltaY > 50 && Math.abs(deltaY) > 10) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleTouchEnd = () => {
      isDragging = false;
      startY = 0;
      currentY = 0;
    };

    // Предотвращаем контекстное меню
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('contextmenu', handleContextMenu);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return containerRef;
};
