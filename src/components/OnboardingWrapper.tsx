'use client';

import React from 'react';

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

export default function OnboardingWrapper({ children }: OnboardingWrapperProps) {
  // Просто рендерим детей без проверок авторизации
  return <>{children}</>;
}
