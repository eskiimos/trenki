
'use client';

import { ChevronRight, Heart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// Компонент для короткого видео
const ShortVideoPlayer = ({ src, title, index }: { src: string; title: string; index: number }) => {
  const handleMouseEnter = (e: React.MouseEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    video.currentTime = 0;
    video.play();
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    video.pause();
    video.currentTime = 0;
  };

  return (
    <Link href={`/shorts?index=${index}`}>
      <div className="flex-shrink-0 w-36 cursor-pointer">
        <div className="bg-gray-200 rounded-lg overflow-hidden relative aspect-[9/16] hover:scale-105 transition-transform">
          <video
            className="w-full h-full object-cover"
            src={src}
            muted
            loop
            playsInline
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            poster=""
          />
        </div>
      </div>
    </Link>
  );
};

const HomePage = () => {
  return (
    <div className="bg-[#F3F4F6] min-h-screen text-[#303030]">
      <Header />
      <main className="p-4 space-y-8">
        <HeroVideo />
        <TrenkiSection />
        <TrainingsSection />
        <TrainersSection />
        <PromoBanner />
      </main>
    </div>
  );
};

const Header = () => (
  <header className="bg-white p-4 flex justify-between items-center text-[#303030]">
    <div className="flex items-center space-x-3">
      <div className="w-10 h-10 bg-gray-300 rounded-full relative">
        <Image src="/logos/logo_akb.png" alt="Logo" layout="fill" className="rounded-full"/>
      </div>
      <div>
        <h1 className="font-bold text-sm text-[#303030]">КОНСТАНТИН</h1>
        <p className="text-xs text-[#303030] opacity-70">КОНСТАНТИНОПОЛЬСКИЙ</p>
      </div>
    </div>
    <div className="text-right">
      <p className="font-bold text-2xl text-[#303030]">88</p>
      <p className="text-xs text-[#303030] opacity-70">вр</p>
    </div>
  </header>
);

const HeroVideo = () => (
  <Link href="/video/onboarding">
    <div className="bg-red-500 rounded-[3px] overflow-hidden relative h-[193px] w-full cursor-pointer hover:opacity-90 transition-opacity">
      <Image src="/images/video_inbording.png" alt="Onboarding" layout="fill" className="object-cover" />
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
        8:44
      </div>
    </div>
  </Link>
);

const TrenkiSection = () => (
  <section>
    <div className="flex justify-between items-center mb-4">
      <h2 className="font-bold text-lg text-[#303030]">ТРЕНЬКИ</h2>
      <ChevronRight className="w-6 h-6 text-[#303030]" />
    </div>
    <div className="flex space-x-4 overflow-x-auto pb-4">
      <ShortVideoPlayer src="/video/shots/short_1.mp4" title="КОРОТКАЯ ТРЕНИРОВКА 1" index={0} />
      <ShortVideoPlayer src="/video/shots/short_2.mp4" title="КОРОТКАЯ ТРЕНИРОВКА 2" index={1} />
      <ShortVideoPlayer src="/video/shots/short_3.mp4" title="КОРОТКАЯ ТРЕНИРОВКА 3" index={2} />
      <ShortVideoPlayer src="/video/shots/short_4.mp4" title="КОРОТКАЯ ТРЕНИРОВКА 4" index={3} />
    </div>
  </section>
);

const TrenkiCard = ({ image, title }: { image: string, title: string }) => (
  <div className="flex-shrink-0 w-36">
    <div className="bg-gray-200 rounded-lg overflow-hidden relative aspect-[9/16]">
        <Image src={image} alt={title} layout="fill" className="object-cover" />
    </div>
  </div>
);

const TrainingsSection = () => (
    <section>
        <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg text-[#303030]">ТРЕНИРОВКИ</h2>
            <ChevronRight className="w-6 h-6 text-[#303030]" />
        </div>
        <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-gray-300 rounded-full mr-3 relative">
              <Image src="https://placehold.co/32x32/cbd5e0/1a202c?text=A" alt="Trainer avatar" layout="fill" className="rounded-full"/>
            </div>
            <span className="font-semibold text-sm mr-auto text-[#303030]">ИМЯ ТРЕНЕРА</span>
            <Heart className="w-4 h-4 text-[#303030] mr-1" />
            <span className="text-sm text-[#303030]">874</span>
        </div>
        <div className="flex space-x-4 overflow-x-auto pb-4">
            <TrainingCard />
            <TrainingCard />
        </div>
    </section>
);

const TrainingCard = () => (
    <div className="flex-shrink-0 w-64">
        <div className="bg-yellow-400 rounded-lg h-36 mb-3 relative overflow-hidden">
            <Image src="https://placehold.co/256x144/facc15/1f2937?text=НАЗВАНИЕ" alt="Training" layout="fill" className="object-cover" />
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                8:44
            </div>
        </div>
        <div className="flex space-x-2">
            <Chip text="ТИП ТРЕНИРОВКИ" />
            <Chip text="УРОВЕНЬ" />
            <Chip text="ОБОРУДОВАНИЕ" />
        </div>
    </div>
);

const Chip = ({ text }: { text: string }) => (
    <span className="bg-gray-800 text-white text-xs font-semibold px-3 py-1 rounded-full">
        {text}
    </span>
);


const TrainersSection = () => (
    <section>
        <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg text-[#303030]">ТРЕНЕРЫ</h2>
            <ChevronRight className="w-6 h-6 text-[#303030]" />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <TrainerCard name="МАРК КОВАЛЕВСКИЙ" role="ГЛАВНЫЙ ТРЕНЕР" spec="ТАКТИЧЕСКАЯ ПОДГО..." />
            <TrainerCard name="КОНСТАНТИН КОНСТАНТИНОПО..." role="ГЛАВНЫЙ ТРЕНЕР" spec="ТАКТИЧЕСКАЯ ПОДГО..." />
        </div>
    </section>
);

const TrainerCard = ({ name, role, spec }: { name: string, role: string, spec: string }) => (
    <div className="bg-white p-4 rounded-lg text-center">
        <div className="w-20 h-20 bg-gray-300 rounded-full mx-auto mb-4 relative">
          <Image src="https://placehold.co/80x80/e2e8f0/4a5568?text=M" alt={name} layout="fill" className="rounded-full"/>
        </div>
        <h3 className="font-bold text-[#303030]">{name}</h3>
        <p className="text-xs text-[#303030] opacity-70">{role}</p>
        <p className="text-xs text-[#303030] opacity-70">{spec}</p>
    </div>
);


const PromoBanner = () => (
    <div className="bg-red-500 rounded-lg overflow-hidden relative h-48">
        <Image src="https://placehold.co/400x192/dc2626/ffffff?text=ЧТО-ТО+ОТ+МАРКА" alt="Promo" layout="fill" className="object-cover" />
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            8:44
        </div>
    </div>
);


export default HomePage;
