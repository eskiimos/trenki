'use client';

import { useState } from 'react';
import CharacteristicsGainModal from '@/components/CharacteristicsGainModal';

export default function TestCharacteristicsPage() {
  const [showModal, setShowModal] = useState(false);

  const mockGains = {
    ratingPower: 0.8,
    ratingSpeed: 1.2,
    ratingEndurance: 0.6,
    ratingTechnique: 0.0,
    ratingFlexibility: 0.4,
  };

  const mockNewCharacteristics = {
    ratingPower: 66.3,
    ratingSpeed: 59.5,
    ratingEndurance: 72.7,
    ratingTechnique: 68.9,
    ratingFlexibility: 61.8,
    potential: 65.8,
  };

  return (
    <div className="min-h-screen bg-[#101530] flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-white text-2xl font-bold font-overpass mb-4">
          Тест модалки характеристик
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-[#445CFF] to-[#7B61FF] hover:from-[#5a6fff] hover:to-[#8b71ff] text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 shadow-lg font-overpass"
        >
          Показать прирост
        </button>

        {showModal && (
          <CharacteristicsGainModal
            gains={mockGains}
            newCharacteristics={mockNewCharacteristics}
            onClose={() => setShowModal(false)}
          />
        )}
      </div>
    </div>
  );
}
