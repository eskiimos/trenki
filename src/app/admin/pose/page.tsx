'use client';

import { useState } from 'react';
import { AdminPage, PageHeader, AdminButton, SectionTitle } from '@/components/admin/ui';
import { Activity, Plus, PersonStanding } from 'lucide-react';
import PlatformVideos from '@/components/admin/pose/PlatformVideos';

export default function PoseReferencesPage() {
  const [scope, setScope] = useState<'references' | 'library'>('references');

  return (
    <AdminPage width="narrow">
      <PageHeader title="Эталоны движений" icon={PersonStanding} backHref="/admin" />
      <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px' }}>
        Выберите готовое видео из платформы — загружать файл повторно не нужно. Анализ распознает движения тренера
        и сохранит эталон. Обработка идёт в вашем браузере — лучше с компьютера.
      </p>

      <div className="flex flex-wrap gap-2" style={{ marginBottom: 24 }}>
        <AdminButton
          type="button"
          tone={scope === 'references' ? 'primary' : 'secondary'}
          icon={Activity}
          aria-pressed={scope === 'references'}
          onClick={() => setScope('references')}
        >
          Эталоны
        </AdminButton>
        <AdminButton
          type="button"
          tone={scope === 'library' ? 'primary' : 'secondary'}
          icon={Plus}
          aria-pressed={scope === 'library'}
          onClick={() => setScope('library')}
        >
          Добавить видео из платформы
        </AdminButton>
      </div>

      <SectionTitle>{scope === 'library' ? 'Видео платформы в S3' : 'Сохранённые эталоны'}</SectionTitle>
      {scope === 'library' && (
        <p style={{ color: 'var(--color-muted)', fontSize: 13, lineHeight: 1.5, margin: '0 0 16px' }}>
          Выберите видео, затем нажмите «Запустить анализ». После обработки результат появится в разделе «Эталоны».
          Здесь доступны и неопубликованные видео. Файлы, которые ещё обрабатываются, и Kinescope в список не входят.
        </p>
      )}
      <PlatformVideos key={scope} scope={scope} />
    </AdminPage>
  );
}
