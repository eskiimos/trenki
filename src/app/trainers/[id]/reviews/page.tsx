'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Star } from 'lucide-react';

interface Trainer {
  id: string;
  name: string;
  lastName: string;
  avatar: string | null;
  rating: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    profile: {
      avatarUrl: string | null;
    } | null;
  };
}

interface MyReview {
  id: string;
  rating: number;
  comment: string | null;
  isApproved: boolean;
  createdAt: string;
}

// viewer === null — пользователь не залогинен (форму не показываем).
interface Viewer {
  canReview: boolean;
  completedLesson: boolean;
  myReview: MyReview | null;
}

// Ряд из 5 звёзд (lucide Star, залитые лаймом до value).
function StarRow({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= value ? '#A1FF4A' : 'none'}
          stroke={star <= value ? '#A1FF4A' : '#AEABBB'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export default function TrainerReviewsPage() {
  const params = useParams();
  const trainerId = params.id as string;

  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);

  const [userRating, setUserRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    const response = await fetch(`/api/trainers/${trainerId}/reviews`);
    const data = await response.json();
    if (response.ok) {
      setReviews(data.reviews ?? []);
      setAverageRating(data.averageRating ?? null);
      setCount(data.count ?? 0);
      setViewer(data.viewer ?? null);
    }
  }, [trainerId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Загружаем данные тренера
        const trainerResponse = await fetch(`/api/trainers/${trainerId}`);
        const trainerData = await trainerResponse.json();

        if (trainerResponse.ok && trainerData.trainer) {
          setTrainer(trainerData.trainer);
        }

        // Загружаем отзывы + eligibility текущего пользователя
        await fetchReviews();
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (trainerId) {
      fetchData();
    }
  }, [trainerId, fetchReviews]);

  const openForm = () => {
    // Предзаполняем форму своим отзывом (редактирование = переотправка)
    const my = viewer?.myReview;
    setUserRating(my?.rating ?? 0);
    setComment(my?.comment ?? '');
    setFormError(null);
    setSubmitted(false);
    setShowReviewForm(true);
  };

  const handleSubmitReview = async () => {
    if (userRating === 0) {
      setFormError('Пожалуйста, выберите оценку');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/trainers/${trainerId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: userRating,
          comment: comment.trim(),
        }),
      });

      if (response.ok) {
        await fetchReviews();
        setUserRating(0);
        setComment('');
        setShowReviewForm(false);
        setSubmitted(true);
      } else {
        const data = await response.json().catch(() => ({}));
        setFormError(data.error || 'Ошибка при отправке отзыва');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      setFormError('Ошибка при отправке отзыва');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060919] flex items-center justify-center">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="min-h-screen bg-[#060919] flex flex-col items-center justify-center px-4">
        <div className="text-white text-xl mb-4">Тренер не найден</div>
        <Link href="/" className="text-[#445CFF] underline">
          Вернуться на главную
        </Link>
      </div>
    );
  }

  const myReview = viewer?.myReview ?? null;

  return (
    <div className="min-h-screen text-white pb-20" style={{ background: 'linear-gradient(182.77deg, #101530 69.24%, #060919 97.69%)' }}>
      {/* Шапка с кнопкой назад */}
      <div
        className="px-4 mb-4 flex items-center justify-between"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <Link href={`/trainers/${trainerId}`} className="inline-block">
          <div className="w-10 h-10 flex items-center justify-center">
            <Image
              src="/icons/icon-action-back.svg"
              alt="Назад"
              width={32}
              height={32}
            />
          </div>
        </Link>
        <h1
          className="text-white font-bold uppercase flex-1 text-center"
          style={{
            fontFamily: 'Overpass',
            fontSize: '16px',
            lineHeight: '120%',
            letterSpacing: '0.5px'
          }}
        >
          отзывы
        </h1>
        <div className="w-10"></div>
      </div>

      {/* Карточка тренера */}
      <div className="px-4 mb-6">
        <div className="bg-[#060919] rounded-lg p-4 flex items-center gap-4">
          {/* Аватар */}
          <div className="relative w-16 h-16 flex-shrink-0 rounded-full overflow-hidden">
            {trainer.avatar ? (
              <Image
                src={trainer.avatar}
                alt={trainer.name}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#445CFF] to-[#2d3e8f]">
                <span className="text-white text-xl font-bold">
                  {trainer.name[0]}{trainer.lastName[0]}
                </span>
              </div>
            )}
          </div>

          {/* Имя и рейтинг */}
          <div className="flex-1">
            <h2
              className="text-[#445CFF] font-bold uppercase mb-1"
              style={{
                fontFamily: 'Overpass',
                fontSize: '14px',
                lineHeight: '120%',
                letterSpacing: '0.5px'
              }}
            >
              {trainer.name} {trainer.lastName}
            </h2>
            <div className="flex items-center gap-2">
              <Star size={20} fill="#A1FF4A" stroke="#A1FF4A" />
              <span className="text-[#A1FF4A] font-bold text-sm">
                {averageRating ?? trainer.rating}
              </span>
              <span className="text-white/50 text-sm">
                ({count} отзывов)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Уведомление после отправки */}
      {submitted && (
        <div className="px-4 mb-6">
          <div className="rounded-lg p-4 border border-[#A1FF4A]/40 bg-[#A1FF4A]/10">
            <p className="text-[#A1FF4A] text-sm font-bold">
              Отзыв отправлен на модерацию
            </p>
            <p className="text-[#AEABBB] text-xs mt-1">
              Он появится в списке после проверки.
            </p>
          </div>
        </div>
      )}

      {/* Блок «оставить отзыв» — только для залогиненных */}
      {viewer && (
        viewer.canReview ? (
          showReviewForm ? (
            <div className="px-4 mb-6">
              <div className="bg-[#060919] rounded-lg p-4">
                <h3 className="text-white text-sm font-bold uppercase mb-4">
                  ваш отзыв
                </h3>

                {/* Звезды рейтинга */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isActive = star <= userRating;
                    return (
                      <button
                        key={star}
                        onClick={() => setUserRating(star)}
                        className="w-8 h-8 flex items-center justify-center transition-all"
                        aria-label={`Оценка ${star}`}
                      >
                        <Star
                          size={32}
                          fill={isActive ? '#A1FF4A' : 'none'}
                          stroke={isActive ? '#A1FF4A' : '#AEABBB'}
                          strokeWidth={1.5}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Поле для комментария */}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={1000}
                  placeholder="Напишите ваш отзыв..."
                  className="w-full bg-[#101530] text-white p-3 rounded-lg mb-2 min-h-[100px] resize-none"
                  style={{
                    fontFamily: 'Overpass',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />

                {formError && (
                  <p className="text-red-400 text-xs mb-2">{formError}</p>
                )}

                {/* Кнопки */}
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => {
                      setShowReviewForm(false);
                      setUserRating(0);
                      setComment('');
                      setFormError(null);
                    }}
                    className="flex-1 bg-[#101530] text-white py-3 rounded-lg font-bold uppercase text-sm"
                    style={{ fontFamily: 'Overpass' }}
                  >
                    отмена
                  </button>
                  <button
                    onClick={handleSubmitReview}
                    disabled={submitting}
                    className="flex-1 bg-[#445CFF] text-white py-3 rounded-lg font-bold uppercase text-sm disabled:opacity-50"
                    style={{ fontFamily: 'Overpass' }}
                  >
                    {submitting ? 'отправка...' : 'отправить'}
                  </button>
                </div>
              </div>
            </div>
          ) : myReview ? (
            /* Свой отзыв: показываем даже неодобренный, с бейджем «на модерации» */
            <div className="px-4 mb-6">
              <div className="bg-[#060919] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white text-sm font-bold uppercase">
                    ваш отзыв
                  </h3>
                  {!myReview.isApproved && (
                    <span className="text-xs font-bold text-[#060919] bg-[#A1FF4A] rounded-full px-3 py-1">
                      на модерации
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <StarRow value={myReview.rating} />
                  <span className="text-white/50 text-xs">
                    {new Date(myReview.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                {myReview.comment && (
                  <p
                    className="text-[#AEABBB] mb-3"
                    style={{
                      fontFamily: 'Overpass',
                      fontSize: '14px',
                      lineHeight: '140%',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {myReview.comment}
                  </p>
                )}
                <button
                  onClick={openForm}
                  className="w-full bg-[#101530] text-white py-3 rounded-lg font-bold uppercase text-sm"
                  style={{ fontFamily: 'Overpass' }}
                >
                  редактировать
                </button>
                <p className="text-white/50 text-xs mt-2 text-center">
                  После правки отзыв снова уйдёт на модерацию
                </p>
              </div>
            </div>
          ) : (
            <div className="px-4 mb-6">
              <button
                onClick={openForm}
                className="w-full bg-[#445CFF] text-white py-3 rounded-lg font-bold uppercase text-sm"
                style={{ fontFamily: 'Overpass' }}
              >
                оставить отзыв
              </button>
            </div>
          )
        ) : (
          /* Залогинен, но не прошёл занятие тренера */
          <div className="px-4 mb-6">
            <p className="text-[#AEABBB] text-sm text-center">
              Оставить отзыв можно после прохождения занятия тренера
            </p>
          </div>
        )
      )}

      {/* Список отзывов */}
      <div className="px-4">
        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-[#060919] rounded-lg p-4">
                {/* Пользователь и рейтинг */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {/* Аватар пользователя */}
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#445CFF] to-[#2d3e8f] flex items-center justify-center">
                      {review.user.profile?.avatarUrl ? (
                        <Image
                          src={review.user.profile.avatarUrl}
                          alt={review.user.firstName || 'User'}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-sm font-bold">
                          {review.user.firstName?.[0] || 'U'}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">
                        {review.user.firstName || 'Пользователь'} {review.user.lastName || ''}
                      </p>
                      <p className="text-white/50 text-xs">
                        {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  {/* Рейтинг */}
                  <StarRow value={review.rating} />
                </div>

                {/* Комментарий */}
                {review.comment && (
                  <p
                    className="text-[#AEABBB]"
                    style={{
                      fontFamily: 'Overpass',
                      fontSize: '14px',
                      lineHeight: '140%',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {review.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-white/50 text-sm">
              Пока нет отзывов. Будьте первым!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
