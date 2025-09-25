'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

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
  
  return (
    <div className="bg-[#101530] min-h-screen text-white">
      <div className="p-4 pt-[100px]">
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

      <div className="px-4 pb-4 flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : trainers.length > 0 ? (
          trainers.map((trainer) => (
            <Link href={`/trainers/${trainer.id}`} key={trainer.id}>
              <TrainerCard trainer={trainer} />
            </Link>
          ))
        ) : (
          <p className="text-center py-8 text-[#AEABBB]">Тренеры не найдены</p>
        )}
      </div>
    </div>
  );
};

const TrainerCard = ({ trainer }: { trainer: Trainer }) => {
  return (
    <div className="w-full bg-[#060919] rounded-xl overflow-hidden">
      <div className="flex p-4">
        <div className="relative mr-4">
          <div className="w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-b from-transparent to-blue-600/50">
            <Image 
              src={trainer.avatar || "/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png"}
              alt={`${trainer.name} ${trainer.lastName}`} 
              width={96} 
              height={96} 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute top-1 left-1 w-6 h-6 flex items-center justify-center">
            <Image 
              src="/icons/star-6.svg" 
              alt="Рейтинг" 
              width={24} 
              height={24}
              className="absolute"
            />
            <span className="relative z-10 text-[#A1FF4A] text-xs font-bold">{trainer.rating}</span>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="mb-3">
            <h2 className="text-[#445CFF] text-sm font-bold uppercase tracking-wide leading-tight">
              {trainer.name}
            </h2>
            <h2 className="text-[#445CFF] text-sm font-bold uppercase tracking-wide leading-tight">
              {trainer.lastName}
            </h2>
          </div>
          
          <div className="space-y-2">
            <div className="py-2 border-t border-[#101530]">
              <span className="text-[#AEABBB] text-xs font-bold uppercase tracking-wide">
                {trainer.speciality}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="px-4 py-3 border-t border-[#101530]">
        <div className="flex items-center">
          <span className="text-[#AEABBB] text-xs font-bold uppercase">Опыт:</span>
          <span className="ml-2 text-[#A1FF4A] text-xs font-bold">{trainer.experience} лет</span>
        </div>
      </div>
    </div>
  );
};

export default TrainersPage;
