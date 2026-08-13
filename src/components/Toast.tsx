'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose: () => void;
}

export default function Toast({ 
  message, 
  type = 'info', 
  duration = 3000,
  onClose 
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Анимация появления
    setTimeout(() => setIsVisible(true), 10);

    // Автоматическое скрытие
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Даём время на анимацию исчезновения
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    success: 'from-green-500 to-green-600',
    error: 'from-red-500 to-red-600',
    warning: 'from-yellow-500 to-yellow-600',
    info: 'from-blue-500 to-blue-600',
  };

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const Icon = icons[type];

  return (
    <div
      className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
      style={{ maxWidth: 'calc(100% - 32px)' }}
    >
      <div
        className={`bg-gradient-to-r ${colors[type]} rounded-lg shadow-2xl px-6 py-4 flex items-center gap-3 min-w-[280px] backdrop-blur-sm`}
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
      >
        <Icon size={24} className="text-white shrink-0" aria-hidden />
        <p className="text-white text-sm font-medium font-overpass flex-1">
          {message}
        </p>
      </div>
    </div>
  );
}
