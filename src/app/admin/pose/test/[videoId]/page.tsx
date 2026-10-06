'use client';

import { use } from 'react';
import { Camera } from 'lucide-react';
import { AdminPage, PageHeader } from '@/components/admin/ui';
import LiveAssessment from '@/components/admin/pose/LiveAssessment';

export default function PoseAssessmentPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = use(params);
  return <AdminPage>
    <PageHeader title="Тренировка с оценкой" icon={Camera} backHref="/admin/pose/test" backLabel="Выбрать другое видео" />
    <LiveAssessment key={videoId} videoId={videoId} />
  </AdminPage>;
}
