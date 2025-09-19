'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Profile {
  position?: string;
  number?: number;
  age?: number;
  height?: number;
  weight?: number;
  strength: number;
  endurance: number;
  speed: number;
  technique: number;
  overall: number;
  dailyProgress: number;
  maxDailyGoal: number;
}

interface User {
  firstName?: string;
  lastName?: string;
  profile?: Profile;
}

interface Trainer {
  id: number;
  name: string;
  specialization: string;
  description: string;
  avatarUrl?: string;
  rating: number;
  category: string;
  experience: number;
}

interface Video {
  id: number;
  title: string;
  description: string;
  thumbnailUrl?: string;
  duration: number;
  category: string;
  trainer: {
    name: string;
  };
}

const TestPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Загружаем профиль
        const profileResponse = await fetch('/api/profile?telegramId=123456789');
        const profileData = await profileResponse.json();
        
        // Загружаем тренеров
        const trainersResponse = await fetch('/api/trainers');
        const trainersData = await trainersResponse.json();
        
        // Загружаем видео
        const videosResponse = await fetch('/api/videos');
        const videosData = await videosResponse.json();

        if (profileData.user) setUser(profileData.user);
        if (trainersData.trainers) setTrainers(trainersData.trainers);
        if (videosData.videos) setVideos(videosData.videos);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#101530] min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-sm font-overpass">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#101530] min-h-screen text-white">
      {/* Header */}
      <div className="pt-[90px] px-6">
        <h1 className="text-xl font-bold mb-6">Тест API базы данных</h1>
      </div>
      
      {/* Профиль пользователя */}
      <div className="px-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 text-[#445CFF]">Профиль пользователя</h2>
        {user ? (
          <div className="bg-[#060919] rounded-lg p-4">
            <p><strong>Имя:</strong> {user.firstName} {user.lastName}</p>
            {user.profile && (
              <div className="mt-2">
                <p><strong>Позиция:</strong> {user.profile.position}</p>
                <p><strong>Номер:</strong> {user.profile.number}</p>
                <p><strong>Возраст:</strong> {user.profile.age} лет</p>
                <p><strong>Рост:</strong> {user.profile.height} см</p>
                <p><strong>Вес:</strong> {user.profile.weight} кг</p>
                <div className="mt-2">
                  <p><strong>Сила:</strong> {user.profile.strength}</p>
                  <p><strong>Выносливость:</strong> {user.profile.endurance}</p>
                  <p><strong>Скорость:</strong> {user.profile.speed}</p>
                  <p><strong>Техника:</strong> {user.profile.technique}</p>
                  <p><strong>Общий рейтинг:</strong> {user.profile.overall}</p>
                  <p><strong>Прогресс:</strong> {user.profile.dailyProgress}/{user.profile.maxDailyGoal}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[#AEABBB]">Профиль не найден</p>
        )}
      </div>

      {/* Тренеры */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-[#445CFF]">Тренеры ({trainers.length})</h2>
        <div className="space-y-4">
          {trainers.map((trainer) => (
            <div key={trainer.id} className="bg-[#060919] rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-[#445CFF]/20 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">👨‍🏫</span>
                </div>
                <div>
                  <h3 className="font-bold text-white">{trainer.name}</h3>
                  <p className="text-[#AEABBB] text-sm">{trainer.specialization}</p>
                  <p className="text-xs text-[#AEABBB] mt-1">{trainer.description}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-[#A1FF4A]">★ {trainer.rating}</span>
                    <span className="text-[#AEABBB]">{trainer.category}</span>
                    <span className="text-[#AEABBB]">Опыт: {trainer.experience} лет</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Видео */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-[#445CFF]">Видео ({videos.length})</h2>
        <div className="space-y-4">
          {videos.map((video) => (
            <div key={video.id} className="bg-[#060919] rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="w-24 h-16 bg-[#445CFF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🎥</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-sm">{video.title}</h3>
                  <p className="text-[#AEABBB] text-xs mt-1">{video.description}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-[#A1FF4A]">{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</span>
                    <span className="text-[#AEABBB]">{video.category}</span>
                    <span className="text-[#AEABBB]">Тренер: {video.trainer.name}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Link href="/profile" className="bg-[#445CFF] text-white px-4 py-2 rounded-lg text-sm">
          Профиль
        </Link>
        <Link href="/trainers" className="bg-[#445CFF] text-white px-4 py-2 rounded-lg text-sm">
          Тренеры
        </Link>
      </div>
      </div>
    </div>
  );
};

export default TestPage;
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-[#445CFF]">Профиль пользователя</h2>
        {user ? (
          <div className="bg-[#060919] rounded-lg p-4">
            <p><strong>Имя:</strong> {user.firstName} {user.lastName}</p>
            {user.profile && (
              <div className="mt-2">
                <p><strong>Позиция:</strong> {user.profile.position}</p>
                <p><strong>Номер:</strong> {user.profile.number}</p>
                <p><strong>Возраст:</strong> {user.profile.age} лет</p>
                <p><strong>Рост:</strong> {user.profile.height} см</p>
                <p><strong>Вес:</strong> {user.profile.weight} кг</p>
                <div className="mt-2">
                  <p><strong>Сила:</strong> {user.profile.strength}</p>
                  <p><strong>Выносливость:</strong> {user.profile.endurance}</p>
                  <p><strong>Скорость:</strong> {user.profile.speed}</p>
                  <p><strong>Техника:</strong> {user.profile.technique}</p>
                  <p><strong>Общий рейтинг:</strong> {user.profile.overall}</p>
                  <p><strong>Прогресс:</strong> {user.profile.dailyProgress}/{user.profile.maxDailyGoal}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[#AEABBB]">Профиль не найден</p>
        )}
      </div>

      {/* Тренеры */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-[#445CFF]">Тренеры ({trainers.length})</h2>
        <div className="space-y-4">
          {trainers.map((trainer) => (
            <div key={trainer.id} className="bg-[#060919] rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-[#445CFF]/20 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">👨‍🏫</span>
                </div>
                <div>
                  <h3 className="font-bold text-white">{trainer.name}</h3>
                  <p className="text-[#AEABBB] text-sm">{trainer.specialization}</p>
                  <p className="text-xs text-[#AEABBB] mt-1">{trainer.description}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-[#A1FF4A]">★ {trainer.rating}</span>
                    <span className="text-[#AEABBB]">{trainer.category}</span>
                    <span className="text-[#AEABBB]">Опыт: {trainer.experience} лет</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Видео */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-[#445CFF]">Видео ({videos.length})</h2>
        <div className="space-y-4">
          {videos.map((video) => (
            <div key={video.id} className="bg-[#060919] rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="w-24 h-16 bg-[#445CFF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🎥</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-sm">{video.title}</h3>
                  <p className="text-[#AEABBB] text-xs mt-1">{video.description}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-[#A1FF4A]">{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</span>
                    <span className="text-[#AEABBB]">{video.category}</span>
                    <span className="text-[#AEABBB]">Тренер: {video.trainer.name}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Link href="/profile" className="bg-[#445CFF] text-white px-4 py-2 rounded-lg text-sm">
          Профиль
        </Link>
        <Link href="/trainers" className="bg-[#445CFF] text-white px-4 py-2 rounded-lg text-sm">
          Тренеры
        </Link>
      </div>
    </div>
  );
};

export default TestPage;
