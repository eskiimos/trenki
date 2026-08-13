'use client';

// Границы ошибок сегмента /admin: без этого файла любая ошибка RSC (упавший
// запрос в layout, отвал БД) показывала стандартный краш-экран Next. Здесь —
// экран на токенах с возможностью повторить рендер (reset) или уйти в админку.

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AdminPage, AdminCard, AdminButton } from '@/components/admin/ui';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin segment error:', error);
  }, [error]);

  return (
    <AdminPage width="narrow">
      <div className="flex flex-col justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <AdminCard tone="danger" style={{ padding: 24 }}>
          <div className="flex flex-col items-center text-center">
            <AlertTriangle size={24} style={{ color: 'var(--color-danger)' }} aria-hidden />
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 12 }}>Что-то пошло не так</div>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '4px 0 0' }}>
              Раздел админки не удалось отрисовать. Попробуйте ещё раз — если повторяется, смотрите
              логи сервера.
            </p>
            {error.digest && (
              <p
                className="font-mono"
                style={{ fontSize: 11, color: 'var(--color-muted)', margin: '8px 0 0' }}
              >
                digest: {error.digest}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2" style={{ marginTop: 24 }}>
              <AdminButton icon={RefreshCw} onClick={() => reset()}>
                Повторить
              </AdminButton>
              <Link href="/admin">
                <AdminButton tone="secondary">В админку</AdminButton>
              </Link>
            </div>
          </div>
        </AdminCard>
      </div>
    </AdminPage>
  );
}
