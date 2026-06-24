import { notFound } from 'next/navigation';
import {
  MockAssessment,
  MockCalendar,
  MockProfile,
  MockWorkout,
  MockCatalog,
} from '@/components/preview/screens';

// Публичные превью-экраны приложения (без авторизации) — встраиваются в
// телефон-фреймы лендинга через iframe. См. middleware publicRoutes ('/preview').

export function generateStaticParams() {
  return ['assessment', 'calendar', 'profile', 'workout', 'catalog'].map((screen) => ({ screen }));
}

export default async function PreviewScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  // Карту строим ЛОКАЛЬНО из JSX (импорт компонентов-клиентов — ок; импорт
  // объекта из 'use client'-модуля в сервер-компонент дал бы client-reference).
  const screens = {
    assessment: <MockAssessment />,
    calendar: <MockCalendar />,
    profile: <MockProfile />,
    workout: <MockWorkout />,
    catalog: <MockCatalog />,
  };
  const content = screens[screen as keyof typeof screens];
  if (!content) notFound();
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#060919', color: '#F9F8FE', overflow: 'hidden' }}>
      {content}
    </div>
  );
}
