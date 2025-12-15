'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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
  comment: string;
  createdAt: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    profile: {
      avatarUrl: string | null;
    } | null;
  };
}

export default function TrainerReviewsPage() {
  const params = useParams();
  const trainerId = params.id as string;
  
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Загружаем данные тренера
        const trainerResponse = await fetch(`/api/trainers/${trainerId}`);
        const trainerData = await trainerResponse.json();
        
        if (trainerResponse.ok && trainerData.trainer) {
          setTrainer(trainerData.trainer);
        }

        // Загружаем отзывы
        const reviewsResponse = await fetch(`/api/trainers/${trainerId}/reviews`);
        const reviewsData = await reviewsResponse.json();
        
        if (reviewsResponse.ok && reviewsData.reviews) {
          setReviews(reviewsData.reviews);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (trainerId) {
      fetchData();
    }
  }, [trainerId]);

  const handleSubmitReview = async () => {
    if (userRating === 0) {
      alert('Пожалуйста, выберите оценку');
      return;
    }

    try {
      const response = await fetch(`/api/trainers/${trainerId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: userRating,
          comment: comment.trim(),
        }),
      });

      if (response.ok) {
        // Обновляем список отзывов
        const reviewsResponse = await fetch(`/api/trainers/${trainerId}/reviews`);
        const reviewsData = await reviewsResponse.json();
        
        if (reviewsData.reviews) {
          setReviews(reviewsData.reviews);
        }

        // Сбрасываем форму
        setUserRating(0);
        setComment('');
        setShowReviewForm(false);
      } else {
        alert('Ошибка при отправке отзыва');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Ошибка при отправке отзыва');
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

  return (
    <div className="min-h-screen text-white pb-20" style={{ background: 'linear-gradient(182.77deg, #101530 69.24%, #060919 97.69%)' }}>
      {/* Шапка с кнопкой назад */}
      <div className="px-4 pt-4 mb-4 flex items-center justify-between">
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
              <Image 
                src="/icons/star-6.svg" 
                alt="Рейтинг" 
                width={20} 
                height={20}
              />
              <span className="text-[#A1FF4A] font-bold text-sm">
                {trainer.rating}
              </span>
              <span className="text-white/50 text-sm">
                ({reviews.length} отзывов)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Форма добавления отзыва */}
      {!showReviewForm ? (
        <div className="px-4 mb-6">
          <button
            onClick={() => setShowReviewForm(true)}
            className="w-full bg-[#445CFF] text-white py-3 rounded-lg font-bold uppercase text-sm"
            style={{ fontFamily: 'Overpass' }}
          >
            оставить отзыв
          </button>
        </div>
      ) : (
        <div className="px-4 mb-6">
          <div className="bg-[#060919] rounded-lg p-4">
            <h3 className="text-white text-sm font-bold uppercase mb-4">
              ваш отзыв
            </h3>
            
            {/* Звезды рейтинга */}
            <div className="flex items-center justify-center gap-4 mb-4">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = star <= (hoveredRating || userRating);
                return (
                  <button 
                    key={star}
                    onClick={() => setUserRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="w-8 h-8 flex items-center justify-center transition-all"
                    style={{ opacity: isActive ? 1 : 0.3 }}
                  >
                    <Image 
                      src={isActive ? "/icons/star-6.svg" : "/icons/star-6-null.svg"}
                      alt={`Звезда ${star}`}
                      width={32}
                      height={32}
                    />
                  </button>
                );
              })}
            </div>

            {/* Поле для комментария */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Напишите ваш отзыв..."
              className="w-full bg-[#101530] text-white p-3 rounded-lg mb-4 min-h-[100px] resize-none"
              style={{ 
                fontFamily: 'Overpass', 
                fontSize: '14px',
                outline: 'none'
              }}
            />

            {/* Кнопки */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReviewForm(false);
                  setUserRating(0);
                  setComment('');
                }}
                className="flex-1 bg-[#101530] text-white py-3 rounded-lg font-bold uppercase text-sm"
                style={{ fontFamily: 'Overpass' }}
              >
                отмена
              </button>
              <button
                onClick={handleSubmitReview}
                className="flex-1 bg-[#445CFF] text-white py-3 rounded-lg font-bold uppercase text-sm"
                style={{ fontFamily: 'Overpass' }}
              >
                отправить
              </button>
            </div>
          </div>
        </div>
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
                  <div className="flex items-center gap-1">
                    <Image 
                      src="/icons/star-6.svg" 
                      alt="Рейтинг" 
                      width={16} 
                      height={16}
                    />
                    <span className="text-[#A1FF4A] font-bold text-sm">
                      {review.rating}
                    </span>
                  </div>
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
