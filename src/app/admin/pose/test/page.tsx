'use client';

import { Camera } from 'lucide-react';
import { AdminPage, PageHeader, SectionTitle } from '@/components/admin/ui';
import PlatformVideos from '@/components/admin/pose/PlatformVideos';

export default function PoseAssessmentPicker() {
  return <AdminPage width="narrow">
    <PageHeader title="Тест оценки эталонов" icon={Camera} backHref="/admin/pose" backLabel="Эталоны" />
    <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
      Выберите занятие с готовым эталоном, включите камеру и повторяйте движения тренера.
      Во время тренировки появятся текущая оценка и подсказки, после завершения — итог.
    </p>
    <SectionTitle>Выберите видео для теста</SectionTitle>
    <PlatformVideos scope="references" purpose="assessment" />
  </AdminPage>;
}
