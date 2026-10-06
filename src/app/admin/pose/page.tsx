'use client';

import { useCallback, useState } from 'react';
import { AdminPage, PageHeader, AdminButton, SectionTitle } from '@/components/admin/ui';
import Link from 'next/link';
import { Activity, Plus, PersonStanding, Camera } from 'lucide-react';
import PlatformVideos from '@/components/admin/pose/PlatformVideos';
import BackgroundQueue from '@/components/admin/pose/BackgroundQueue';

export default function PoseReferencesPage() {
  const [scope, setScope] = useState<'references' | 'library'>('references');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  return (
    <AdminPage width="narrow">
      <PageHeader title="Эталоны движений" icon={PersonStanding} backHref="/admin" />
      <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px' }}>
        Выберите готовое видео из платформы — загружать файл повторно не нужно. Анализ распознает движения тренера
        и сохранит эталон. Запустите фоновую обработку — она продолжится после закрытия страницы.
      </p>
      <div style={{ marginBottom: 24 }}><BackgroundQueue onDone={refresh} /></div>

      <div className="flex flex-wrap gap-2" style={{ marginBottom: 24 }}>
        <Link href="/admin/pose/test" className="inline-flex items-center gap-2" style={{ border: '1px solid var(--border-lime)', borderRadius: 999, padding: '10px 16px', color: 'var(--color-brand)', fontSize: 14, fontWeight: 700 }}>
          <Camera size={18} aria-hidden /> Тест оценки с камерой
        </Link>
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
      <PlatformVideos key={`${scope}-${revision}`} scope={scope} />
    </AdminPage>
  );
}
