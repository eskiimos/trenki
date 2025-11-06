'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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

export default function TrainerProfilePage() {
  const params = useParams();
  const trainerId = params.id as string;
  
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          setIsLoading(false);
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
      } catch (error) {
        console.error('Error loading trainer:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (trainerId) {
      fetchTrainerData();
    }
  }, [trainerId]);

  if (isLoading) {
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
    <div className="min-h-screen bg-[#060919] text-white pb-20">
      {/* Шапка с кнопкой назад */}
      <div className="px-4 pt-4 mb-4">
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
        <div className="bg-[#111631] rounded-lg p-4">
          {/* Профиль: аватар + инфо */}
          <div className="mb-4">
            <div className="flex items-stretch gap-0 rounded-lg overflow-hidden" style={{ background: 'linear-gradient(180deg, #111631 0%, #111631 100%)' }}>
              {/* Левая часть: Аватар с рейтингом */}
              <div className="relative w-[35%] flex-shrink-0 bg-gradient-to-br from-[#2d3e8f] to-[#1a2456]">
                <div className="w-full h-full">
                  {trainer.avatar ? (
                    <Image 
                      src={trainer.avatar} 
                      alt={trainer.name}
                      width={280}
                      height={280}
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
                <div className="absolute top-3 left-3 w-10 h-10 flex items-center justify-center">
                  <Image 
                    src="/icons/star-6.svg" 
                    alt="Рейтинг" 
                    width={40} 
                    height={40}
                  />
                  <span className="absolute text-[#0a1628] text-base font-bold" style={{ fontFamily: 'Overpass' }}>
                    {trainer.rating}
                  </span>
                </div>
              </div>

              {/* Правая часть: Информация */}
              <div className="flex-1 bg-[#0a1628] flex flex-col justify-between p-4">
                <div>
                  <h1 className="text-[#445CFF] text-xl font-bold uppercase leading-tight mb-1">
                    {trainer.name}
                  </h1>
                  <h2 className="text-[#445CFF] text-xl font-bold uppercase leading-tight mb-3">
                    {trainer.lastName}
                  </h2>
                </div>
                <p className="text-white text-sm uppercase leading-tight">
                  {trainer.speciality}
                </p>
              </div>
            </div>
          </div>

          {/* Статистика */}
          <div className="flex items-center justify-start gap-8 mb-4">
            <div>
              <div className="text-[#A1FF4A] text-2xl font-bold">{trainer.experience}</div>
              <div className="text-white/70 text-xs uppercase">лет опыта</div>
            </div>
            <div>
              <div className="text-[#A1FF4A] text-2xl font-bold">{videos.length}</div>
              <div className="text-white/70 text-xs uppercase">тренировок</div>
            </div>
            <div>
              <div className="text-[#A1FF4A] text-2xl font-bold">{shorts.length}</div>
              <div className="text-white/70 text-xs uppercase">треньки</div>
            </div>
          </div>

          {/* Описание */}
          {trainer.description && (
            <p className="text-white/70 text-sm leading-relaxed">
              {trainer.description}
            </p>
          )}
        </div>
      </div>

      {/* ТРЕНЬКИ (Шортсы) */}
      <div className="mb-8">
        <div className="px-4 mb-4 flex items-center justify-between">
          <h3 className="text-white text-sm font-bold uppercase">
            треньки
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-sm">({shorts.length})</span>
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
            {shorts.length > 0 ? (
              shorts.map((short) => (
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
              ))
            ) : (
              <div className="text-white/50 text-sm">Нет треньков</div>
            )}
          </div>
        </div>
      </div>

      {/* ТРЕНЕРОВКИ (Длинные видео) */}
      <div className="mb-8">
        <div className="px-4 mb-4 flex items-center justify-between">
          <h3 className="text-white text-sm font-bold uppercase">
            тренеровки
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-sm">({videos.length})</span>
            <Image 
              src="/icons/arrow.svg" 
              alt="Показать все" 
              width={16} 
              height={16}
            />
          </div>
        </div>
        
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
                  <div className="w-[340px] h-[191px] bg-gray-800 rounded-lg overflow-hidden relative">
                    {video.thumbnail ? (
                      <Image 
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800" />
                    )}
                    {/* Длительность */}
                    <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs">
                      {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
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
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-white text-sm font-bold uppercase">
            отзывы
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-sm">(99)</span>
            <Image 
              src="/icons/arrow.svg" 
              alt="Показать все" 
              width={16} 
              height={16}
            />
          </div>
        </div>

        {/* Блок с призывом оставить отзыв */}
        <div className="text-center py-8">
          <p className="text-white text-sm font-bold uppercase mb-6">
            успел познакомиться с тренером?<br />
            поделись своим мнением
          </p>
          
          {/* Звезды рейтинга */}
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button 
                key={star}
                className="w-12 h-12 flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity"
              >
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path 
                    d="M24 4L28.944 18.528H44.472L31.764 27.944L36.708 42.472L24 33.056L11.292 42.472L16.236 27.944L3.528 18.528H19.056L24 4Z" 
                    stroke="#445CFF" 
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
