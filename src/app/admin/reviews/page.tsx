'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  AdminPage,
  PageHeader,
  AdminCard,
  AdminButton,
  EmptyState,
} from '@/components/admin/ui';
import { Star, Check, EyeOff, Trash2 } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  isApproved: boolean;
  trainer: {
    id: string;
    name: string;
    lastName: string;
    avatar: string | null;
  };
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profile: {
      avatarUrl: string | null;
    } | null;
  };
}

const FILTERS: Array<{ key: 'pending' | 'approved' | 'all'; label: string }> = [
  { key: 'pending', label: 'На модерации' },
  { key: 'approved', label: 'Одобренные' },
  { key: 'all', label: 'Все' },
];

/** Круглый аватар 40×40 с инициалом-фолбэком (канон проекта). */
function Avatar({ src, alt, initial }: { src: string | null; alt: string; initial: string }) {
  return (
    <span
      className="flex items-center justify-center overflow-hidden shrink-0"
      style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--color-elevated)' }}
    >
      {src ? (
        <Image src={src} alt={alt} width={40} height={40} className="w-full h-full object-cover" />
      ) : (
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-muted)' }}>{initial}</span>
      )}
    </span>
  );
}

/** Статус отзыва: одобрен (лайм) / на модерации (danger). */
function StatusBadge({ approved }: { approved: boolean }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '4px 12px',
        borderRadius: 'var(--radius-pill)',
        whiteSpace: 'nowrap',
        background: approved ? 'var(--lime-medium)' : 'rgba(255,140,74,0.15)',
        color: approved ? 'var(--color-brand)' : 'var(--color-danger)',
      }}
    >
      {approved ? 'Одобрено' : 'На модерации'}
    </span>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, [filter]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/reviews?status=${filter}`);
      const data = await response.json();

      if (data.reviews) {
        setReviews(data.reviews);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  // isApproved: true — одобрить, false — скрыть (снять с публикации)
  const handleSetApproved = async (reviewId: string, isApproved: boolean) => {
    setProcessingId(reviewId);
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isApproved }),
      });

      if (response.ok) {
        fetchReviews();
      }
    } catch (error) {
      console.error('Error updating review:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (reviewId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот отзыв?')) return;

    setProcessingId(reviewId);
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchReviews();
      }
    } catch (error) {
      console.error('Error rejecting review:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = reviews.filter(r => !r.isApproved).length;

  return (
    <AdminPage>
      <PageHeader
        title="Модерация отзывов"
        icon={Star}
        backHref="/admin"
        actions={
          pendingCount > 0 ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(255,140,74,0.15)',
                color: 'var(--color-danger)',
                whiteSpace: 'nowrap',
              }}
            >
              {pendingCount} на модерации
            </span>
          ) : null
        }
      />

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 24 }}>
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="transition-colors"
              style={{
                minHeight: 44,
                padding: '10px 20px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                background: active ? 'var(--color-brand)' : 'transparent',
                color: active ? 'var(--color-night)' : 'var(--color-ink)',
                border: `1px solid ${active ? 'var(--color-brand)' : 'var(--border-hairline)'}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Список отзывов */}
      {loading ? (
        <div className="flex flex-col" style={{ gap: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 220,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--border-hairline)',
              }}
            />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Нет отзывов"
          hint={
            filter === 'pending'
              ? 'Всё промодерировано — новых отзывов нет'
              : filter === 'approved'
                ? 'Одобренных отзывов пока нет'
                : 'Отзывы ещё не оставляли'
          }
        />
      ) : (
        <div className="flex flex-col" style={{ gap: 16 }}>
          {reviews.map((review) => (
            <AdminCard
              key={review.id}
              style={
                !review.isApproved
                  ? { borderLeft: '4px solid var(--color-danger)' }
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-3" style={{ marginBottom: 16 }}>
                {/* Информация о тренере */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={review.trainer.avatar}
                    alt={review.trainer.name}
                    initial={review.trainer.name[0]}
                  />
                  <div className="min-w-0">
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }} className="truncate">
                      {review.trainer.name} {review.trainer.lastName}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '2px 0 0' }}>
                      Тренер
                    </p>
                  </div>
                </div>

                {/* Статус */}
                <StatusBadge approved={review.isApproved} />
              </div>

              <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
                {/* Информация о пользователе */}
                <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
                  <Avatar
                    src={review.user.profile?.avatarUrl ?? null}
                    alt={review.user.firstName || 'User'}
                    initial={review.user.firstName?.[0] || 'U'}
                  />
                  <div className="min-w-0">
                    <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }} className="truncate">
                      {review.user.firstName || 'Пользователь'} {review.user.lastName || ''}
                    </p>
                    <p
                      style={{ fontSize: 12, color: 'var(--color-muted)', margin: '2px 0 0' }}
                      className="truncate"
                    >
                      {review.user.email || `ID: ${review.user.id}`}
                    </p>
                  </div>
                </div>

                {/* Рейтинг */}
                <div className="flex items-center gap-1" style={{ marginBottom: 12 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={20}
                      aria-hidden
                      style={{
                        color: star <= review.rating ? 'var(--color-brand)' : 'var(--border-hairline)',
                        fill: star <= review.rating ? 'var(--color-brand)' : 'transparent',
                      }}
                    />
                  ))}
                  <span style={{ fontSize: 12, color: 'var(--color-muted)', marginLeft: 8 }}>
                    {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>

                {/* Комментарий */}
                {review.comment && (
                  <p
                    className="whitespace-pre-wrap"
                    style={{ fontSize: 14, color: 'var(--color-ink)', margin: '0 0 16px' }}
                  >
                    {review.comment}
                  </p>
                )}

                {/* Кнопки действий */}
                <div className="flex flex-wrap gap-3">
                  {!review.isApproved ? (
                    <AdminButton
                      onClick={() => handleSetApproved(review.id, true)}
                      disabled={processingId === review.id}
                      icon={Check}
                      style={{ flex: '1 1 160px' }}
                    >
                      {processingId === review.id ? 'Обработка…' : 'Одобрить'}
                    </AdminButton>
                  ) : (
                    <AdminButton
                      tone="secondary"
                      onClick={() => handleSetApproved(review.id, false)}
                      disabled={processingId === review.id}
                      icon={EyeOff}
                      style={{ flex: '1 1 160px' }}
                    >
                      {processingId === review.id ? 'Обработка…' : 'Скрыть'}
                    </AdminButton>
                  )}
                  <AdminButton
                    tone="danger"
                    onClick={() => handleReject(review.id)}
                    disabled={processingId === review.id}
                    icon={Trash2}
                    style={{ flex: '1 1 160px' }}
                  >
                    {processingId === review.id ? 'Обработка…' : 'Удалить'}
                  </AdminButton>
                </div>
              </div>
            </AdminCard>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
