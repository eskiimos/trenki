'use client';

import React from 'react';
import TourProvider from '@/components/tour/TourProvider';

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

export default function OnboardingWrapper({ children }: OnboardingWrapperProps) {
  // TourProvider живёт здесь (выше BottomNavigation) — переживает смену
  // маршрутов, поэтому продуктовый тур может вести пользователя между
  // экранами. Запуск — через useTour().startTour() (кнопка в /profile).
  return <TourProvider>{children}</TourProvider>;
}
