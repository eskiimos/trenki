'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

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

const TrainersPage = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        const response = await fetch('/api/trainers');
        const data = await response.json();
        
        if (data.trainers) {
          setTrainers(data.trainers);
        }
      } catch (error) {
        console.error('Error fetching trainers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrainers();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#101530] min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-sm font-overpass">Загрузка тренеров...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#101530] min-h-screen text-white">
      {/* Кнопка назад */}
      <div className="p-4 pt-[90px]">
        <Link href="/" className="inline-block">
          <div className="w-8 h-8 flex items-center justify-center">
            <Image 
              src="/icons/arrow.svg" 
              alt="Назад" 
              width={16} 
              height={16}
              style={{ transform: 'rotate(180deg)' }}
            />
          </div>
        </Link>
      </div>

      {/* Контент страницы тренеров */}
      <div className="px-4 pb-4 flex flex-col gap-4">
        {trainers.map((trainer) => (
          <TrainerCard key={trainer.id} trainer={trainer} />
        ))}
      </div>
    </div>
  );
};

const TrainerCard = ({ trainer }: { trainer: Trainer }) => (
  <div className="w-full bg-[#060919] rounded-xl overflow-hidden">
    {/* Верхняя часть с аватаром и информацией */}
    <div className="flex p-4">
      {/* Аватар с рейтингом */}
      <div className="relative mr-4">
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-b from-transparent to-blue-600/50">
          <Image 
            src={trainer.avatarUrl || "/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png"}
            alt="Тренер" 
            width={96} 
            height={96} 
            className="w-full h-full object-cover"
          />
        </div>
        {/* Звезда с рейтингом */}
        <div className="absolute top-1 left-1 w-6 h-6 flex items-center justify-center">
          <Image 
            src="/icons/star-6.svg" 
            alt="Рейтинг" 
            width={24} 
            height={24}
            className="absolute"
          />
          <span className="relative z-10 text-[#A1FF4A] text-xs font-bold">
            {trainer.rating}
          </span>
        </div>
      </div>
      
      {/* Информация о тренере */}
      <div className="flex-1">
        <div className="mb-3">
          <h2 className="text-[#445CFF] text-sm font-bold uppercase tracking-wide leading-tight">
            {trainer.name.split(' ')[0]}
          </h2>
          <h2 className="text-[#445CFF] text-sm font-bold uppercase tracking-wide leading-tight">
            {trainer.name.split(' ').slice(1).join(' ')}
          </h2>
        </div>
        <div className="mb-2">
          <p className="text-[#AEABBB] text-xs font-medium">
            {trainer.specialization}
          </p>
        </div>
        <div>
          <p className="text-[#AEABBB] text-xs font-normal">
            {trainer.description}
          </p>
        </div>
      </div>
    </div>
    
    {/* Нижняя часть с категорией и опытом */}
    <div className="bg-[#080b1c] px-4 py-3 flex justify-between items-center">
      <span className="text-[#A1FF4A] text-xs font-medium uppercase">
        {trainer.category}
      </span>
      <span className="text-[#AEABBB] text-xs font-medium">
        Опыт: {trainer.experience} лет
      </span>
    </div>
  </div>
);

export default TrainersPage;
