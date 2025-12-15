'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainerId: string;
  trainerName: string;
  onSubmitSuccess: () => void;
}

export default function ReviewModal({ 
  isOpen, 
  onClose, 
  trainerId, 
  trainerName,
  onSubmitSuccess 
}: ReviewModalProps) {
  const [userRating, setUserRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (userRating === 0) {
      alert('Пожалуйста, выберите оценку');
      return;
    }

    setIsSubmitting(true);

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
        setIsSubmitted(true);
        onSubmitSuccess();
        
        // Закрыть модал через 3 секунды
        setTimeout(() => {
          handleClose();
        }, 3000);
      } else {
        alert('Ошибка при отправке отзыва');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Ошибка при отправке отзыва');
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

                {/* Кнопки */}
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || userRating === 0}
                    className="flex-1 py-4 rounded-2xl font-bold uppercase text-sm transition-all"
                    style={{ 
                      fontFamily: 'Overpass',
                      background: userRating === 0 || isSubmitting 
                        ? '#2d3e8f' 
                        : 'linear-gradient(90deg, #A1FF4A 0%, #7ec935 100%)',
                      color: userRating === 0 || isSubmitting ? '#AEABBB' : '#0a1628',
                      opacity: isSubmitting ? 0.7 : 1
                    }}
                  >
                    {isSubmitting ? 'Отправка...' : 'отправить'}
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-[#101530] text-white py-4 rounded-2xl font-bold uppercase text-sm"
                    style={{ fontFamily: 'Overpass' }}
                  >
                    пропустить
                  </button>
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
                <button
                  onClick={handleClose}
                  className="w-full py-4 rounded-2xl font-bold uppercase text-sm text-white"
                  style={{ 
                    fontFamily: 'Overpass',
                    background: 'linear-gradient(90deg, #445CFF 0%, #2d3e8f 100%)'
                  }}
                >
                  к тренеровкам
                </button>
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
