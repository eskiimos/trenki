'use client';

import { useState, useRef, useEffect } from 'react';

interface CircularSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export default function CircularSlider({ value, min, max, onChange }: CircularSliderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Тексты для каждого уровня энергии
  const energyLabels: { [key: number]: string } = {
    0: 'ВЫБЕРИ УРОВЕНЬ',
    1: 'ЕЛЕ ДВИГАЮСЬ',
    2: 'ОЧЕНЬ УСТАЛ',
    3: 'УСТАВШИЙ',
    4: 'НЕМНОГО УСТАЛ',
    5: 'НОРМАЛЬНО',
    6: 'ХОРОШО',
    7: 'ОТЛИЧНО 👍🏻',
    8: 'СУПЕР',
    9: 'ОГОНЬ',
    10: 'ЗАРЯЖЕН 100%',
  };

  const currentLabel = energyLabels[Math.round(value)] || energyLabels[0];

  // Рисуем круг
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 300;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = 120;
    const lineWidth = 24;

    // Очищаем canvas
    ctx.clearRect(0, 0, size, size);

    // Вычисляем угол
    const percentage = ((value - min) / (max - min)) * 100;
    const angle = (percentage / 100) * 2 * Math.PI;

    // Рисуем фоновый круг (серый)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#2D3748';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Рисуем активную часть (синий)
    if (angle > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + angle);
      ctx.strokeStyle = '#445CFF';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Рисуем ручку
    const handleAngle = -Math.PI / 2 + angle;
    const handleX = centerX + radius * Math.cos(handleAngle);
    const handleY = centerY + radius * Math.sin(handleAngle);

    // Тень ручки
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    // Внешний круг ручки (белый)
    ctx.beginPath();
    ctx.arc(handleX, handleY, 16, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Сбрасываем тень
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Внутренний круг ручки (синий)
    ctx.beginPath();
    ctx.arc(handleX, handleY, 13, 0, 2 * Math.PI);
    ctx.fillStyle = '#667EEA';
    ctx.fill();

  }, [value, min, max]);

  const handleMove = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    let angle = Math.atan2(dy, dx);
    angle = angle + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;

    const percentage = (angle / (2 * Math.PI)) * 100;
    const newValue = Math.round(min + (percentage / 100) * (max - min));

    onChange(Math.max(min, Math.min(max, newValue)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMove(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
      }
    };

    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging]);

  return (
    <div ref={containerRef} className="relative flex items-center justify-center" style={{ width: '300px', height: '300px', margin: '0 auto' }}>
      {/* Canvas для круга */}
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />

      {/* Центральный текст поверх canvas */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div style={{
          fontFamily: 'Overpass',
          fontWeight: 700,
          fontSize: '56px',
          color: '#F9F8FE',
          lineHeight: '1',
        }}>
          {Math.round(value)}/{max}
        </div>
        <div style={{
          fontFamily: 'Overpass',
          fontWeight: 700,
          fontSize: '12px',
          color: '#F9F8FE',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginTop: '12px',
          textAlign: 'center',
          maxWidth: '180px',
        }}>
          {currentLabel}
        </div>
      </div>
    </div>
  );
}
