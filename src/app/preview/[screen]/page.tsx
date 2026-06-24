import type { CSSProperties, ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  MockAssessment,
  MockCalendar,
  MockProfile,
  MockWorkout,
  MockCatalog,
  type CatalogItem,
  type WorkoutMod,
} from '@/components/preview/screens';

// Публичные превью-экраны приложения (без авторизации) — встраиваются в
// телефон-фреймы лендинга через iframe (см. middleware publicRoutes '/preview').
// Каталог/тренировка тянут РЕАЛЬНЫЕ опубликованные видео (с обложками) с сервера;
// при недоступности БД — демо-фолбэк в самих компонентах. ISR 10 минут.
export const revalidate = 600;

const WRAP: CSSProperties = {
  position: 'relative', minHeight: '100vh', background: '#060919', color: '#F9F8FE', overflow: 'hidden',
};

async function getCatalogItems(): Promise<CatalogItem[]> {
  try {
    const videos = await prisma.video.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { title: true, duration: true, thumbnail: true, trainer: { select: { name: true, lastName: true } } },
    });
    return videos.map((v) => ({
      title: v.title,
      trainer: `${v.trainer.name} ${v.trainer.lastName}`.trim(),
      duration: Math.max(1, Math.round((v.duration || 0) / 60)),
      thumbnail: v.thumbnail,
    }));
  } catch {
    return [];
  }
}

async function getWorkoutModules(): Promise<WorkoutMod[]> {
  try {
    const videos = await prisma.video.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: { title: true, duration: true, thumbnail: true },
    });
    return videos.map((v) => ({
      title: v.title,
      duration: Math.max(1, Math.round((v.duration || 0) / 60)),
      thumbnail: v.thumbnail,
    }));
  } catch {
    return [];
  }
}

export default async function PreviewScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  let content: ReactNode;
  if (screen === 'catalog') content = <MockCatalog items={await getCatalogItems()} />;
  else if (screen === 'workout') content = <MockWorkout modules={await getWorkoutModules()} />;
  else if (screen === 'calendar') content = <MockCalendar />;
  else if (screen === 'profile') content = <MockProfile />;
  else if (screen === 'assessment') content = <MockAssessment />;
  else notFound();
  return <div style={WRAP}>{content}</div>;
}
