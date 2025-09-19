'use client';

import Image from 'next/image';
import Link from 'next/link';

const TrainersPage = () => {
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
        {/* Карточка тренера 1 */}
        <TrainerCard />
        
        {/* Карточка тренера 2 */}
        <TrainerCard />
        
        {/* Карточка тренера 3 */}
        <TrainerCard />
      </div>
    </div>
  );
};

const TrainerCard = () => (
  <div className="w-full bg-[#060919] rounded-xl overflow-hidden">
    {/* Верхняя часть с аватаром и информацией */}
    <div className="flex p-4">
      {/* Аватар с рейтингом */}
      <div className="relative mr-4">
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-b from-transparent to-blue-600/50">
          <Image 
            src="/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png"
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
          <span className="relative z-10 text-[#A1FF4A] text-xs font-bold">5</span>
        </div>
      </div>
      
      {/* Информация о тренере */}
      <div className="flex-1">
        <div className="mb-3">
          <h2 className="text-[#445CFF] text-sm font-bold uppercase tracking-wide leading-tight">
            КОНСТАНТИН
          </h2>
          <h2 className="text-[#445CFF] text-sm font-bold uppercase tracking-wide leading-tight">
            КОНСТАНТИНОПОЛЬСКИЙ
          </h2>
        </div>
        
        <div className="space-y-2">
          <div className="py-2 border-t border-[#101530]">
            <span className="text-[#AEABBB] text-xs font-bold uppercase tracking-wide">
              ВРАТАРСКИЙ
            </span>
          </div>
          <div className="py-2 border-t border-[#101530]">
            <span className="text-[#AEABBB] text-xs font-bold uppercase tracking-wide">
              ТАКТИЧЕСКАЯ ПОДГОТОВКА
            </span>
          </div>
        </div>
      </div>
    </div>
    
    {/* Статистика */}
    <div className="px-4 py-3 border-t border-b border-[#101530]">
      <div className="flex items-center justify-between">
        <div className="text-center">
          <div className="text-[#A1FF4A] text-sm font-bold">15</div>
          <div className="text-white text-xs font-bold uppercase tracking-wide">ЛЕТ ОПЫТА</div>
        </div>
        <div className="w-px h-8 bg-[#101530]"></div>
        <div className="text-center">
          <div className="text-[#A1FF4A] text-sm font-bold">124</div>
          <div className="text-white text-xs font-bold uppercase tracking-wide">ТРЕНЕК</div>
        </div>
        <div className="w-px h-8 bg-[#101530]"></div>
        <div className="text-center">
          <div className="text-[#A1FF4A] text-sm font-bold">88</div>
          <div className="text-white text-xs font-bold uppercase tracking-wide">ТРЕНИРОВОК</div>
        </div>
      </div>
    </div>
    
    {/* Дисклеймер */}
    <div className="p-4">
      <p className="text-[#AEABBB] text-xs leading-relaxed line-clamp-3">
        Внимание! Все видео созданы для самостоятельных занятий, и автор контента не несёт ответственности за качество выполнения упражнений занимающимися. Занятия подходят для здоровых людей. Поэтому прислушивайтесь к своим ощущениям, и если вы не уверены в состоянии своего здоровья и возможности выполнения представленных упражнений и асан, то обратитесь ко врачу. Если во время практики почувствуете негативные ощущения, прекратите занятия и также посетите врача. Надеюсь, мои занятия принесут вам только пользу и положительные эмоции. Будьте здоровы и приятных занятий!
      </p>
    </div>
  </div>
);

export default TrainersPage;
