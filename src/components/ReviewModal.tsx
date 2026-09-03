'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainerId: string;
  trainerName: string;
  /** Звезда, выбранная на странице тренера до открытия модалки */
  initialRating?: number;
  onSubmitSuccess: (rating: number, approved: boolean) => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  trainerId,
  trainerName,
  initialRating = 0,
  onSubmitSuccess
}: ReviewModalProps) {
  const [userRating, setUserRating] = useState<number>(initialRating);
  const [comment, setComment] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Раньше рейтинг жил только на странице тренера и в модалку НЕ попадал —
  // внутренний userRating всегда был 0 и «Отправить» была вечно заблокирована.
  // Теперь стартовая звезда приходит пропом, а внутри можно поправить оценку.
  useEffect(() => {
    if (isOpen) {
      setUserRating(initialRating);
      setErrorText(null);
    }
  }, [isOpen, initialRating]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (userRating === 0) {
      setErrorText('Пожалуйста, выберите оценку');
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);

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
        const data = await response.json().catch(() => ({}));
        setIsSubmitted(true);
        onSubmitSuccess(userRating, !!data?.review?.isApproved);

        // Закрыть модал через 3 секунды
        setTimeout(() => {
          handleClose();
        }, 3000);
      } else {
        // Показываем реальную причину (например, гейт «отзыв только после
        // прохождения занятия тренера» — 403 с текстом от сервера)
        const data = await response.json().catch(() => ({}));
        setErrorText(data.error || 'Ошибка при отправке отзыва');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      setErrorText('Ошибка сети — попробуйте ещё раз');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setUserRating(0);
    setComment('');
    setIsSubmitted(false);
    onClose();
  };

  const maxChars = 500;
  const remainingChars = maxChars - comment.length;

  return (
    <>
      {/* Оверлей */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />

      {/* Модальное окно */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
        <div 
          className="bg-[#060919] rounded-t-3xl overflow-hidden"
          style={{
            maxHeight: '85vh',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)'
          }}
        >
          {/* Шапка */}
          <div 
            className="relative px-4 py-6"
            style={{
              background: 'linear-gradient(90deg, #445CFF 0%, #2d3e8f 100%)',
            }}
          >
            {/* Декоративные элементы как в календаре */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            </div>

            <div className="relative flex items-center justify-between">
              <h2 
                className="text-white font-bold uppercase text-center flex-1"
                style={{ 
                  fontFamily: 'Overpass', 
                  fontSize: '16px', 
                  lineHeight: '120%', 
                  letterSpacing: '0.5px' 
                }}
              >
                {isSubmitted ? 'Спасибо!' : 'Расскажи подробнее о тренере'}
              </h2>
              <button 
                onClick={handleClose}
                className="ml-4 text-white/70 hover:text-white transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Контент */}
          <div className="px-4 py-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
            {!isSubmitted ? (
              <>
                {/* Заголовок */}
                <h3 
                  className="text-white font-bold uppercase mb-6"
                  style={{ 
                    fontFamily: 'Overpass', 
                    fontSize: '14px', 
                    lineHeight: '120%', 
                    letterSpacing: '0.5px' 
                  }}
                >
                  твой отзыв
                </h3>

                {/* Оценка: приходит со страницы тренера, здесь можно поправить */}
                <div className="flex items-center justify-center gap-3 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setUserRating(star)}
                      aria-label={`Оценка ${star}`}
                      className="transition-transform active:scale-90"
                    >
                      <Star
                        size={32}
                        className={star <= userRating ? 'text-[#A1FF4A]' : 'text-[#AEABBB]/40'}
                        fill={star <= userRating ? 'currentColor' : 'none'}
                      />
                    </button>
                  ))}
                </div>

                {/* Счетчик символов */}
                <div className="mb-4 text-right">
                  <span 
                    className="text-[#AEABBB]"
                    style={{ 
                      fontFamily: 'Overpass', 
                      fontSize: '12px',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {remainingChars}/{maxChars}
                  </span>
                </div>

                {/* Текстовое поле */}
                <textarea
                  value={comment}
                  onChange={(e) => {
                    if (e.target.value.length <= maxChars) {
                      setComment(e.target.value);
                    }
                  }}
                  placeholder="Напиши свой отзыв..."
                  className="w-full bg-[#101530] text-white p-4 rounded-2xl mb-6 resize-none"
                  style={{ 
                    fontFamily: 'Overpass', 
                    fontSize: '14px',
                    lineHeight: '140%',
                    minHeight: '180px',
                    outline: 'none',
                    border: 'none'
                  }}
                />

                {errorText && (
                  <div className="text-[#FF8C4A] text-sm mb-4" style={{ fontFamily: 'Overpass' }}>
                    {errorText}
                  </div>
                )}

                {/* Кнопки */}
                <div className="flex gap-3 mb-4">
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={isSubmitting || userRating === 0}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Отправка...' : 'отправить'}
                  </Button>
                  <Button variant="ghost" onClick={handleClose} className="flex-1">
                    пропустить
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Сообщение об успехе */}
                <div className="text-center py-8">
                  <h3 
                    className="text-white font-bold uppercase mb-6"
                    style={{ 
                      fontFamily: 'Overpass', 
                      fontSize: '16px', 
                      lineHeight: '120%', 
                      letterSpacing: '0.5px' 
                    }}
                  >
                    отзыв успешно отправлен.
                  </h3>
                  <p 
                    className="text-white/70 mb-8"
                    style={{ 
                      fontFamily: 'Overpass', 
                      fontSize: '14px', 
                      lineHeight: '140%', 
                      letterSpacing: '0.5px' 
                    }}
                  >
                    после модерации он будет доступен для других пользователей.
                  </p>
                </div>

                {/* Кнопка */}
                <Button variant="primary" fullWidth onClick={handleClose}>
                  К тренировкам
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
