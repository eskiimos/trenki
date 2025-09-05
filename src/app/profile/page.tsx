'use client';

import Image from 'next/image';
import Link from 'next/link';

const ProfilePage = () => {
  return (
    <div className="bg-[#101530] min-h-screen text-white">
      {/* Шапка с кнопкой назад */}
      <div className="flex items-center p-4 pt-20">
        <div className="flex items-center gap-4">
          <Link href="/" className="inline-block">
            <div className="w-4 h-4 flex items-center justify-center">
              <Image 
                src="/icons/arrow.svg" 
                alt="Назад" 
                width={16} 
                height={16}
                style={{ transform: 'rotate(180deg)' }}
              />
            </div>
          </Link>
          <h1 className="text-white text-xs font-normal font-overpass">Профиль</h1>
        </div>
      </div>

      {/* Основной контент */}
      <div className="px-4 pb-20">
        {/* Профиль игрока */}
        <div className="flex gap-3 mb-4">
          {/* Большое фото - адаптируется к высоте соседнего блока */}
          <div className="w-52 self-stretch bg-[#f6f6f6] rounded-lg overflow-hidden">
            <Image 
              src="/avatars/ChatGPT Image 5 сент. 2025 г., 11_46_52.png"
              alt="Игрок" 
              width={208} 
              height={350} 
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Информация об игроке */}
          <div className="flex-1 flex flex-col gap-2">
            {/* Аватар и иконка редактирования */}
            <div className="flex justify-between items-start">
              <div className="w-14 h-14 rounded bg-gradient-to-b from-[#445CFF]/20 to-[#445CFF]/60 overflow-hidden p-1">
                <Image 
                  src="/logos/logo_akb.png"
                  alt="Логотип" 
                  width={56} 
                  height={56} 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="w-6 h-6 flex items-center justify-center">
                <Image 
                  src="/icons/tabler_edit.svg"
                  alt="Редактировать" 
                  width={24} 
                  height={24} 
                  className="w-full h-full"
                />
              </div>
            </div>
            
            {/* Имя */}
            <div className="text-white text-sm font-medium font-overpass leading-tight">
              Евгений<br/>Евгеньев
            </div>
            
            {/* Позиция */}
            <div className="text-[#AEABBB] text-xs font-medium font-overpass">
              11 | Нападающий
            </div>
            
            {/* Характеристики */}
            <div className="text-[#AEABBB] text-xs font-medium font-overpass">
              10 лет | 134 см | 42 кг
            </div>
            
            {/* Статистика */}
            <div className="flex flex-col gap-0.5 mt-2">
              <StatBar label="сила" value="16" change="+7" isPositive={true} />
              <StatBar label="выносливость" value="22" change="-4" isPositive={false} />
              <StatBar label="скорость" value="55" change="+4" isPositive={true} />
              <StatBar label="техника" value="22" change="-9" isPositive={false} />
              <StatBar label="общее" value="22" change="-9" isPositive={false} isTotal={true} />
            </div>
          </div>
        </div>

        {/* Прогресс */}
        <div className="flex items-center gap-2 mb-6">
          <div className="text-white text-xs font-medium font-overpass leading-tight">
            Ежедневный<br/>прогресс 8/10
          </div>
          <div className="flex-1 h-2 bg-[#2d3448] rounded-full overflow-hidden">
            <div className="w-4/5 h-full bg-gradient-to-r from-[#A1FF4A] to-[#7DFF8C] rounded-full"></div>
          </div>
        </div>

        {/* Меню разделы */}
        <div className="space-y-4">
          <MenuSection title="Плейлисты" />
          <MenuSection title="Избранные тренера" />
          <MenuSection title="Избранные видео" />
          <MenuSection title="История просмотров" />
          
          {/* Баннер бота */}
          <div className="bg-[#2d3448] rounded-lg p-4 text-center">
            <div className="text-[#AEABBB] text-sm font-medium font-overpass mb-4">
              подключайся к чат-боту<br/>и получи больше возможностей
            </div>
            <button className="bg-[#445CFF] text-white px-6 py-2 rounded-full text-xs font-medium font-overpass">
              К боту
            </button>
          </div>
          
          {/* FAQ */}
          <div className="space-y-4">
            <MenuSection title="Частые вопросы" />
            <div className="space-y-1">
              <FAQItem question="Как начать тренироваться?" />
              <FAQItem question="Как отслеживать прогресс?" />
              <FAQItem question="Где найти программы тренировок?" />
              <FAQItem question="Как связаться с тренером?" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Компонент для статистики
const StatBar = ({ label, value, change, isPositive, isTotal = false }: {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  isTotal?: boolean;
}) => (
  <div className={`flex justify-between items-center px-2 py-1 rounded ${isTotal ? 'bg-[#3d4759]' : 'bg-[#2d3448]'}`}>
    <span className="text-[#AEABBB] text-xs font-medium font-overpass">{label}</span>
    <div className="flex items-center gap-1">
      <span className="text-white text-lg font-black font-overpass">{value}</span>
      <span className={`text-xs font-black font-overpass ${isPositive ? 'text-[#A1FF4A]' : 'text-[#E40202]'}`}>
        ({change})
      </span>
    </div>
  </div>
);

// Компонент для пунктов меню
const MenuSection = ({ title }: { title: string }) => (
  <div className="flex justify-between items-center">
    <span className="text-[#AEABBB] text-xs font-normal font-overpass">{title}</span>
    <div className="w-4 h-4 flex items-center justify-center">
      <Image 
        src="/icons/arrow.svg" 
        alt="Стрелка" 
        width={16} 
        height={16}
        className="transform rotate-90"
      />
    </div>
  </div>
);

// Компонент для FAQ
const FAQItem = ({ question }: { question: string }) => (
  <div className="bg-[#2d3448]/50 rounded px-3 py-2 flex justify-between items-center">
    <span className="text-[#AEABBB] text-xs font-medium font-overpass">{question}</span>
    <div className="w-3 h-3 flex items-center justify-center">
      <Image 
        src="/icons/arrow.svg" 
        alt="Стрелка" 
        width={12} 
        height={12}
        className="transform rotate-180"
      />
    </div>
  </div>
);

export default ProfilePage;
