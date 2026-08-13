'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CornerDownRight,
  Loader2,
  MessageSquare,
  MessageSquareOff,
  RefreshCw,
  Trash2,
  Video,
  Zap,
} from 'lucide-react';
import { Chip } from '@/components/ui';
import {
  AdminPage,
  PageHeader,
  AdminCard,
  AdminButton,
  EmptyState,
} from '@/components/admin/ui';

interface Comment {
  id: string;
  type: 'video' | 'short';
  text: string;
  createdAt: string;
  author: string;
  target: { id: string; title: string };
}

const FILTERS = [
  ['all', 'Все'],
  ['video', 'К видео'],
  ['short', 'К тренькам'],
] as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}

/** Бейдж типа комментария: видео / тренька. */
function TypeBadge({ type }: { type: Comment['type'] }) {
  const Icon = type === 'video' ? Video : Zap;
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        padding: '2px 8px',
        borderRadius: 'var(--radius-pill)',
        background: 'rgba(174,171,187,0.12)',
        color: 'var(--color-muted)',
      }}
    >
      <Icon size={16} aria-hidden />
      {type === 'video' ? 'видео' : 'тренька'}
    </span>
  );
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  // Раньше ошибки загрузки не было вовсе — при 500 список оставался пустым и
  // пользователь видел «Комментариев нет» вместо сообщения о сбое.
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<'all' | 'video' | 'short'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Подтверждение удаления и ошибка удаления — на токенах вместо confirm()/alert()
  const [pendingDelete, setPendingDelete] = useState<Comment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/admin/comments');
      if (!res.ok) throw new Error('comments');
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Модалка подтверждения: Escape закрывает, фон не скроллится.
  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingDelete(null);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [pendingDelete]);

  const handleDelete = async (c: Comment) => {
    setPendingDelete(null);
    setDeleteError(null);
    setDeletingId(c.id);
    try {
      const res = await fetch('/api/admin/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: c.type, id: c.id }),
      });
      if (res.ok) {
        setComments((prev) => prev.filter((x) => x.id !== c.id));
      } else {
        setDeleteError('Не удалось удалить комментарий');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const visible = comments.filter((c) => filter === 'all' || c.type === filter);

  return (
    <AdminPage>
      <PageHeader
        title="Комментарии"
        icon={MessageSquare}
        subtitle="Постмодерация: комментарии публикуются сразу, здесь можно удалить неуместные."
        actions={
          !loading && !loadError ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(174,171,187,0.12)',
                color: 'var(--color-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {visible.length} шт.
            </span>
          ) : undefined
        }
      />

      {/* Фильтр по типу */}
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
        {FILTERS.map(([key, label]) => (
          <Chip key={key} active={filter === key} onClick={() => setFilter(key)}>
            {label}
          </Chip>
        ))}
      </div>

      {deleteError && (
        <div style={{ marginBottom: 16 }}>
          <AdminCard tone="danger">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2" style={{ fontSize: 14 }}>
                <AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} aria-hidden />
                {deleteError}
              </span>
              <AdminButton tone="secondary" size="sm" onClick={() => setDeleteError(null)}>
                Ок
              </AdminButton>
            </div>
          </AdminCard>
        </div>
      )}

      {loading ? (
        // Скелетон той же высоты, что карточки — список не прыгает при загрузке
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 108,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--border-hairline)',
              }}
            />
          ))}
        </div>
      ) : loadError ? (
        <div>
          <EmptyState
            icon={AlertTriangle}
            tone="danger"
            title="Не удалось загрузить комментарии"
            hint="Проверьте соединение и попробуйте ещё раз."
          />
          <div className="flex justify-center">
            <AdminButton tone="secondary" icon={RefreshCw} onClick={fetchComments}>
              Повторить
            </AdminButton>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div>
          <EmptyState
            icon={MessageSquareOff}
            title={filter === 'all' ? 'Комментариев нет' : 'В этом фильтре ничего нет'}
            hint={
              filter === 'all'
                ? 'Как только пользователи начнут комментировать, записи появятся здесь.'
                : `Комментариев к ${filter === 'video' ? 'видео' : 'тренькам'} пока нет — всего в базе ${comments.length}.`
            }
          />
          {filter !== 'all' && (
            <div className="flex justify-center">
              <AdminButton tone="secondary" onClick={() => setFilter('all')}>
                Показать все
              </AdminButton>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <AdminCard key={`${c.type}-${c.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{c.author}</span>
                    <TypeBadge type={c.type} />
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <p
                    className="break-words whitespace-pre-wrap"
                    style={{ fontSize: 14, margin: '8px 0 0' }}
                  >
                    {c.text}
                  </p>
                  <div
                    className="flex items-center gap-2 min-w-0"
                    style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}
                  >
                    <CornerDownRight size={16} className="shrink-0" aria-hidden />
                    <span className="truncate">{c.target.title}</span>
                  </div>
                </div>
                <AdminButton
                  tone="danger"
                  size="sm"
                  onClick={() => setPendingDelete(c)}
                  disabled={deletingId === c.id}
                  aria-label={`Удалить комментарий от ${c.author}`}
                  // min-width, чтобы строка не дёргалась при подмене иконки спиннером
                  style={{ flexShrink: 0, minWidth: 116 }}
                >
                  {deletingId === c.id ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Trash2 size={16} aria-hidden />
                  )}
                  Удалить
                </AdminButton>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {/* Подтверждение удаления */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Подтверждение удаления комментария"
        >
          <div
            className="absolute inset-0"
            style={{ background: 'var(--scrim)' }}
            onClick={() => setPendingDelete(null)}
          />
          <div
            className="relative w-full max-w-sm animate-popIn"
            style={{
              background: 'var(--color-elevated)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-xl)',
              padding: 24,
            }}
          >
            <div className="flex items-center gap-3">
              <Trash2 size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} aria-hidden />
              <div style={{ fontSize: 16, fontWeight: 800 }}>Удалить комментарий?</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 8 }}>
              Автор: {pendingDelete.author}
            </div>
            <p
              className="break-words whitespace-pre-wrap"
              style={{
                fontSize: 13,
                marginTop: 12,
                padding: 12,
                maxHeight: 160,
                overflowY: 'auto',
                background: 'var(--color-night)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {pendingDelete.text}
            </p>
            <div className="flex gap-2" style={{ marginTop: 24 }}>
              <AdminButton
                tone="secondary"
                autoFocus
                onClick={() => setPendingDelete(null)}
                style={{ flex: 1 }}
              >
                Отмена
              </AdminButton>
              <AdminButton
                tone="danger"
                icon={Trash2}
                onClick={() => handleDelete(pendingDelete)}
                style={{ flex: 1 }}
              >
                Удалить
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
