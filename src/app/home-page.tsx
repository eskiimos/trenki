'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import TrainerCard from '@/components/TrainerCard';

export default function HomePage() {
  return (
    <div className="bg-[#060919] min-h-screen text-white pb-32">
      <header className="px-4 flex justify-between items-center" style={{ paddingTop: '90px' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex justify-center items-center">
            <span className="text-lg font-bold">A</span>
          </div>
          <div>
            <h1 className="text-sm font-medium">Пользователь</h1>
            <p className="text-xs text-gray-400">Нападающий #10</p>
          </div>
        </div>
        
        <button className="w-8 h-8 flex justify-center items-center rounded-full">
          <Image 
            src="/icons/tabler_edit.svg" 
            alt="Редактировать" 
            width={20} 
            height={20} 
          />
        </button>
      </header>
      
      {/* Секция с тренерами */}
      <TrainersSection />
    </div>
  );
}

// Секция с тренерами
const TrainersSection = () => {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        const response = await fetch('/api/trainers');
        const data = await response.json();
        
        if (data.trainers) {
          setTrainers(data.trainers.slice(0, 2)); // Берем только первых 2 тренеров
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
      <section style={{ paddingBottom: '15px' }}>
        <div style={{
          width: '100%', 
          height: '100%', 
          paddingLeft: 16, 
          paddingRight: 16, 
          paddingTop: 24, 
          paddingBottom: 24, 
          background: 'linear-gradient(180deg, #101530 0%, #060919 100%)', 
          borderRadius: 1, 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: 16, 
          display: 'inline-flex'
        }}>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ paddingBottom: '15px' }}>
        <div style={{
            width: '100%', 
            height: '100%', 
            paddingLeft: 16, 
            paddingRight: 16, 
            paddingTop: 24, 
            paddingBottom: 24, 
            background: 'linear-gradient(180deg, #101530 0%, #060919 100%)', 
            borderRadius: 1, 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: 16, 
            display: 'inline-flex'
        }}>
            <div style={{
                alignSelf: 'stretch', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                display: 'inline-flex'
            }}>
                <div style={{
                    color: '#F9F8FE', 
                    fontSize: 12, 
                    fontFamily: 'Overpass', 
                    fontWeight: '700', 
                    textTransform: 'uppercase', 
                    lineHeight: '14.40px', 
                    letterSpacing: 0.50
                }}>тренеры</div>
                <div style={{
                    width: 16, 
                    height: 16, 
                    position: 'relative', 
                    overflow: 'hidden'
                }}>
                    <Link href="/trainers">
                        <Image 
                            src="/icons/arrow.svg" 
                            alt="Стрелка" 
                            width={16} 
                            height={16}
                        />
                    </Link>
                </div>
            </div>
            <div style={{
                alignSelf: 'stretch', 
                justifyContent: 'flex-start', 
                alignItems: 'center', 
                gap: 16, 
                display: 'inline-flex'
            }}>
                {trainers.map((trainer) => (
                  <TrainerCard key={trainer.id} trainer={trainer} />
                ))}
            </div>
        </div>
    </section>
  );
};
