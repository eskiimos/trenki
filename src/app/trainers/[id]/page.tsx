'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ReviewModal from '@/components/ReviewModal';

interface Trainer {
  id: string;
  name: string;
  lastName: string;
  speciality: string;
  experience: number;
  rating: number;
  avatar: string | null;
  description: string | null;
}

interface Video {
  id: string;
  title: string;
  thumbnail: string | null;
  duration: number;
  viewsCount: number;
}

interface Short {
  id: string;
  videoUrl: string;
  thumbnail: string | null;
  title: string;
}

export default function TrainerPage() {
  const params = useParams();
  const trainerId = params.id as string;
  
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [reviewsCount, setReviewsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    const fetchTrainerData = async () => {
      try {
        console.log('Fetching trainer with ID:', trainerId);
        
        // Загружаем данные тренера
        const trainerResponse = await fetch(`/api/trainers/${trainerId}`);
        console.log('Trainer response status:', trainerResponse.status);
        
        const trainerData = await trainerResponse.json();
        console.log('Trainer data:', trainerData);
        
        if (!trainerResponse.ok || !trainerData.trainer) {
          setError(trainerData.error || 'Тренер не найден');
          setLoading(false);
          return;
        }
        
        setTrainer(trainerData.trainer);

        // Загружаем видео тренера
        const videosResponse = await fetch(`/api/videos?trainerId=${trainerId}`);
        const videosData = await videosResponse.json();
        setVideos(videosData.videos || []);

        // Загружаем шортсы тренера
        const shortsResponse = await fetch(`/api/shorts?trainerId=${trainerId}`);
        const shortsData = await shortsResponse.json();
        setShorts(shortsData.shorts || []);

        // Загружаем отзывы тренера
        const reviewsResponse = await fetch(`/api/trainers/${trainerId}/reviews`);
        const reviewsData = await reviewsResponse.json();
        if (reviewsData.reviews) {
          setReviewsCount(reviewsData.reviews.length);
        }
      } catch (error) {
        console.error('Error loading trainer:', error);
      } finally {
        setLoading(false);
      }
    };

    if (trainerId) {
      fetchTrainerData();
    }
  }, [trainerId]);

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
        {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
        <Link href="/" className="text-[#445CFF] underline">
          Вернуться на главную
        </Link>
      </div>
    );
  }

  // TypeScript теперь знает, что trainer точно существует
  return (
    <div className="min-h-screen text-white pb-20" style={{ background: 'linear-gradient(182.77deg, #101530 69.24%, #060919 97.69%)' }}>
      {/* Шапка с кнопкой назад */}
      <div
        className="px-4 mb-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <Link href="/" className="inline-block">
          <div className="w-10 h-10 flex items-center justify-center">
            <Image 
              src="/icons/icon-action-back.svg" 
              alt="Назад" 
              width={32} 
              height={32}
            />
          </div>
        </Link>
      </div>

      {/* Фрейм с информацией о тренере */}
      <div className="px-4 mb-6">
        <div className="bg-[#060919] rounded-lg overflow-hidden">
          {/* Профиль: аватар + инфо */}
          <div>
            <div className="flex items-stretch gap-0">
              {/* Левая часть: Аватар с рейтингом */}
              <div className="relative w-[112px] h-[112px] flex-shrink-0 bg-gradient-to-br from-[#2d3e8f] to-[#1a2456]">
                <div className="w-full h-full">
                  {trainer.avatar ? (
                    <Image 
                      src={trainer.avatar} 
                      alt={trainer.name}
                      width={112}
                      height={112}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#445CFF] to-[#2d3e8f]">
                      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                        <circle cx="40" cy="40" r="30" fill="#5A6FFF"/>
                        <text x="40" y="52" fontSize="24" fontWeight="bold" fill="white" textAnchor="middle">
                          {trainer.name[0]}{trainer.lastName[0]}
                        </text>
                      </svg>
                    </div>
                  )}
                </div>
                {/* Рейтинг - зеленый шестиугольник в левом верхнем углу */}
                <div className="absolute top-2 left-2 w-8 h-8 flex items-center justify-center">
                  <Image 
                    src="/icons/star-6.svg" 
                    alt="Рейтинг" 
                    width={32} 
                    height={32}
                  />
                  <span 
                    className="absolute text-[#0a1628] font-bold uppercase"
                    style={{ 
                      fontFamily: 'Overpass',
                      fontSize: '14px',
                      lineHeight: '120%',
                      letterSpacing: '0.5px',
                      verticalAlign: 'middle'
                    }}
                  >
                    {trainer.rating}
                  </span>
                </div>
              </div>

              {/* Правая часть: Информация */}
              <div className="flex-1 flex flex-col justify-between p-4">
                <div>
                  <h1 
                    className="text-[#445CFF] font-bold uppercase mb-1"
                    style={{ 
                      fontFamily: 'Overpass', 
                      fontSize: '14px', 
                      lineHeight: '120%', 
                      letterSpacing: '0.5px' 
                    }}
                  >
                    {trainer.name}
                  </h1>
                  <h2 
                    className="text-[#445CFF] font-bold uppercase mb-3"
                    style={{ 
                      fontFamily: 'Overpass', 
                      fontSize: '14px', 
                      lineHeight: '120%', 
                      letterSpacing: '0.5px' 
                    }}
                  >
                    {trainer.lastName}
                  </h2>
                  {/* Горизонтальный разделитель */}
                  <div className="w-full h-[1px] bg-[#101530] mb-3"></div>
                </div>
                <p 
                  className="text-white uppercase"
                  style={{ 
                    fontFamily: 'Overpass', 
                    fontWeight: 700,
                    fontSize: '12px', 
                    lineHeight: '100%', 
                    letterSpacing: '0.5px',
                    verticalAlign: 'middle'
                  }}
                >
                  {trainer.speciality}
                </p>
              </div>
            </div>
          </div>

          {/* Горизонтальный разделитель */}
          <div className="w-full h-[1px] bg-[#101530]"></div>

          {/* Статистика */}
          <div className="flex items-center justify-start gap-4 p-3">
            <div className="whitespace-nowrap">
              <div 
                className="text-[#A1FF4A] font-bold uppercase"
                style={{ 
                  fontFamily: 'Overpass', 
                  fontSize: '12px', 
                  lineHeight: '100%', 
                  letterSpacing: '0.5px',
                  verticalAlign: 'middle'
                }}
              >
                {trainer.experience}
              </div>
              <div 
                className="text-[#f9f9f9] uppercase"
                style={{ 
                  fontFamily: 'Overpass', 
                  fontWeight: 700,
                  fontSize: '12px', 
                  lineHeight: '100%', 
                  letterSpacing: '0.5px',
                  verticalAlign: 'middle'
                }}
              >
                лет опыта
              </div>
            </div>
            
            {/* Вертикальный разделитель */}
            <div className="w-[1px] h-8 bg-[#101530] flex-shrink-0"></div>
            
            <div className="whitespace-nowrap">
              <div 
                className="text-[#A1FF4A] font-bold uppercase"
                style={{ 
                  fontFamily: 'Overpass', 
                  fontSize: '12px', 
                  lineHeight: '100%', 
                  letterSpacing: '0.5px',
                  verticalAlign: 'middle'
                }}
              >
                {videos.length}
              </div>
              <div 
                className="text-[#f9f9f9] uppercase"
                style={{ 
                  fontFamily: 'Overpass', 
                  fontWeight: 700,
                  fontSize: '12px', 
                  lineHeight: '100%', 
                  letterSpacing: '0.5px',
                  verticalAlign: 'middle'
                }}
              >
                тренировок
              </div>
            </div>
            
            {/* Вертикальный разделитель */}
            <div className="w-[1px] h-8 bg-[#101530] flex-shrink-0"></div>
            
            <div className="whitespace-nowrap">
              <div 
                className="text-[#A1FF4A] font-bold uppercase"
                style={{ 
                  fontFamily: 'Overpass', 
                  fontSize: '12px', 
                  lineHeight: '100%', 
                  letterSpacing: '0.5px',
                  verticalAlign: 'middle'
                }}
              >
                {shorts.length}
              </div>
              <div 
                className="text-[#f9f9f9] uppercase"
                style={{ 
                  fontFamily: 'Overpass', 
                  fontWeight: 700,
                  fontSize: '12px', 
                  lineHeight: '100%', 
                  letterSpacing: '0.5px',
                  verticalAlign: 'middle'
                }}
              >
                треньки
              </div>
            </div>
          </div>

          {/* Горизонтальный разделитель */}
          <div className="w-full h-[1px] bg-[#101530]"></div>

          {/* Описание */}
          {trainer.description && (
            <p 
              className="text-[#AEABBB] p-3"
              style={{ 
                fontFamily: 'Overpass', 
                fontWeight: 500,
                fontSize: '12px', 
                lineHeight: '110%', 
                letterSpacing: '0.5px',
                whiteSpace: 'pre-wrap'
              }}
            >
              {trainer.description}
            </p>
          )}
        </div>
      </div>

      {/* ТРЕНЬКИ (Шортсы) — секцию показываем только если шортсы есть */}
      {shorts.length > 0 && (
      <div className="mb-4 bg-[#060919] py-4">
        <div className="px-4 mb-4 flex items-center justify-between">
          <h3 className="text-white text-sm font-bold uppercase">
            треньки
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[#f9f9f9] text-sm">({shorts.length})</span>
            <Image
              src="/icons/arrow.svg"
              alt="Показать все"
              width={16}
              height={16}
            />
          </div>
        </div>

        {/* Горизонтальный скролл шортсов */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 px-4" style={{ width: 'max-content' }}>
            {shorts.map((short) => (
                <Link
                  key={short.id}
                  href={`/shorts/${short.id}`}
                  className="flex-shrink-0"
                >
                  <div className="w-[120px] h-[213px] bg-gray-800 rounded-lg overflow-hidden relative">
                    {short.thumbnail ? (
                      <Image
                        src={short.thumbnail}
                        alt={short.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800" />
                    )}
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>
      )}

      {/* ТРЕНИРОВКИ (Длинные видео) */}
      <div className="mb-8 bg-[#060919] py-4">
        <Link href={`/trainers/${trainerId}/videos`}>
          <div className="px-4 mb-4 flex items-center justify-between cursor-pointer">
            <h3 className="text-white text-sm font-bold uppercase">
              тренировки
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[#f9f9f9] text-sm">({videos.length})</span>
              <Image 
                src="/icons/arrow.svg" 
                alt="Показать все" 
                width={16} 
                height={16}
              />
            </div>
          </div>
        </Link>
        
        {/* Горизонтальный скролл видео */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 px-4" style={{ width: 'max-content' }}>
            {videos.length > 0 ? (
              videos.map((video) => (
                <Link 
                  key={video.id} 
                  href={`/video/${video.id}`}
                  className="flex-shrink-0"
                >
                  <div className="w-[340px]">
                    <div className="relative overflow-hidden rounded-lg">
                      {video.thumbnail ? (
                        <Image 
                          src={video.thumbnail}
                          alt={video.title}
                          width={340}
                          height={191}
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-[340px] h-[191px] bg-gradient-to-br from-gray-700 to-gray-800" />
                      )}
                      {/* Длительность */}
                      <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                        {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                    {/* Video Info */}
                    <div className="px-0 py-2">
                      <h3 className="text-white text-sm font-semibold line-clamp-2 leading-tight">
                        {video.title.toUpperCase()}
                      </h3>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-white/50 text-sm">Нет тренировок</div>
            )}
          </div>
        </div>
      </div>

      {/* ОТЗЫВЫ */}
      <div className="px-4">
        <Link href={`/trainers/${trainerId}/reviews`}>
          <div className="mb-4 flex items-center justify-between cursor-pointer">
            <h3 className="text-white text-sm font-bold uppercase">
              отзывы
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm">({reviewsCount})</span>
              <Image 
                src="/icons/arrow.svg" 
                alt="Показать все" 
                width={16} 
                height={16}
              />
            </div>
          </div>
        </Link>

        {/* Блок с призывом оставить отзыв */}
        <div className="text-center py-8">
          <p className="text-white text-sm font-bold uppercase mb-6">
            успел познакомиться с тренером?<br />
            поделись своим мнением
          </p>
          
          {/* Звезды рейтинга */}
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3, 4, 5].map((star) => {
              const isActive = star <= (hoveredRating || userRating);
              return (
                <button 
                  key={star}
                  onClick={() => {
                    setUserRating(star);
                    setIsReviewModalOpen(true);
                  }}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="w-8 h-8 flex items-center justify-center transition-all"
                  style={{ opacity: isActive ? 1 : 0.3 }}
                >
                  <Image 
                    src={isActive ? "/icons/star-6.svg" : "/icons/Raiting-star.svg"}
                    alt={`Звезда ${star}`}
                    width={32}
                    height={32}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Модальное окно отзыва */}
      {trainer && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setUserRating(0);
          }}
          trainerId={trainerId}
          trainerName={`${trainer.name} ${trainer.lastName}`}
          onSubmitSuccess={() => {
            // Обновляем количество отзывов
            fetch(`/api/trainers/${trainerId}/reviews`)
              .then(res => res.json())
              .then(data => {
                if (data.reviews) {
                  setReviewsCount(data.reviews.length);
                }
              });
          }}
        />
      )}
    </div>
  );
}
