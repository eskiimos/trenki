'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

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
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <div className="bg-white shadow" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                Модерация отзывов
              </h1>
              {pendingCount > 0 && (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  {pendingCount} на модерации
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            На модерации
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'approved'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Одобренные
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Все
          </button>
        </div>

        {/* Список отзывов */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Загрузка...</div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Нет отзывов</div>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className={`bg-white rounded-lg shadow p-6 ${
                  !review.isApproved ? 'border-l-4 border-yellow-400' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  {/* Информация о тренере */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
                      {review.trainer.avatar ? (
                        <Image
                          src={review.trainer.avatar}
                          alt={review.trainer.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                          {review.trainer.name[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {review.trainer.name} {review.trainer.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">Тренер</p>
                    </div>
                  </div>

                  {/* Статус */}
                  <div>
                    {review.isApproved ? (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        Одобрено
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                        На модерации
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  {/* Информация о пользователе */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                      {review.user.profile?.avatarUrl ? (
                        <Image
                          src={review.user.profile.avatarUrl}
                          alt={review.user.firstName || 'User'}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-sm">
                          {review.user.firstName?.[0] || 'U'}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {review.user.firstName || 'Пользователь'} {review.user.lastName || ''}
                      </p>
                      <p className="text-sm text-gray-500">
                        {review.user.email || `ID: ${review.user.id}`}
                      </p>
                    </div>
                  </div>

                  {/* Рейтинг */}
                  <div className="flex items-center gap-2 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`w-5 h-5 ${
                          star <= review.rating ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                    <span className="text-sm text-gray-600 ml-2">
                      {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>

                  {/* Комментарий */}
                  {review.comment && (
                    <p className="text-gray-700 mb-4 whitespace-pre-wrap">
                      {review.comment}
                    </p>
                  )}

                  {/* Кнопки действий */}
                  <div className="flex gap-3">
                    {!review.isApproved ? (
                      <button
                        onClick={() => handleSetApproved(review.id, true)}
                        disabled={processingId === review.id}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                      >
                        {processingId === review.id ? 'Обработка...' : 'Одобрить'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSetApproved(review.id, false)}
                        disabled={processingId === review.id}
                        className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 font-medium"
                      >
                        {processingId === review.id ? 'Обработка...' : 'Скрыть'}
                      </button>
                    )}
                    <button
                      onClick={() => handleReject(review.id)}
                      disabled={processingId === review.id}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                    >
                      {processingId === review.id ? 'Обработка...' : 'Удалить'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
