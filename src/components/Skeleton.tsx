import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  rounded?: boolean;
}

export const Skeleton = ({ 
  width = 'w-full', 
  height = 'h-4', 
  className = '', 
  rounded = false 
}: SkeletonProps) => {
  return (
    <div 
      className={`
        skeleton-loading
        ${width} ${height} ${rounded ? 'rounded-full' : 'rounded'}
        ${className}
      `}
    />
  );
};

// Специфичные скелетоны для профиля
export const ProfileSkeleton = () => {
  return (
    <div className="bg-[#101530] min-h-screen text-white">
      {/* Шапка с кнопкой назад */}
      <div className="flex items-center p-4 pt-[100px]">
        <div className="flex items-center gap-4">
          <Skeleton width="w-4" height="h-4" />
          <Skeleton width="w-16" height="h-4" />
        </div>
      </div>

      {/* Основной контент */}
      <div className="px-4 pb-20">
        {/* Профиль игрока - skeleton */}
        <div className="flex gap-3 mb-4">
          {/* Большое фото */}
          <Skeleton width="w-52" height="h-80" />
          
          {/* Информация об игроке */}
          <div className="flex-1 flex flex-col gap-2">
            {/* Аватар и иконка редактирования */}
            <div className="flex justify-between items-start">
              <Skeleton width="w-14" height="h-14" rounded />
              <Skeleton width="w-6" height="h-6" />
            </div>
            
            {/* Имя */}
            <div className="space-y-1">
              <Skeleton width="w-20" height="h-4" />
              <Skeleton width="w-24" height="h-4" />
            </div>
            
            {/* Позиция */}
            <Skeleton width="w-32" height="h-3" />
            
            {/* Характеристики */}
            <Skeleton width="w-28" height="h-3" />
          </div>
        </div>

        {/* Меню разделы - skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton width="w-24" height="h-4" />
            </div>
          ))}
          
          {/* Баннер бота */}
          <div className="bg-[#2d3448] rounded-lg p-4 text-center">
            <div className="space-y-2 mb-4">
              <Skeleton width="w-32" height="h-4" className="mx-auto" />
              <Skeleton width="w-36" height="h-4" className="mx-auto" />
            </div>
            <Skeleton width="w-16" height="h-8" className="mx-auto" rounded />
          </div>
          
          {/* FAQ */}
          <div className="space-y-4">
            <Skeleton width="w-28" height="h-4" />
            <div className="space-y-1">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} width="w-full" height="h-10" />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Тапбар skeleton */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-[428px] bg-[#101530] border-t border-[#2d3448] p-4">
        <div className="flex justify-around items-center">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton width="w-6" height="h-6" />
              <Skeleton width="w-8" height="h-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Skeleton для страницы редактирования профиля
export const ProfileEditSkeleton = () => {
  return (
    <div className="bg-[#101530] min-h-screen text-white">
      {/* Шапка */}
      <div className="flex items-center justify-between p-4 pt-[100px]">
        <div className="flex items-center gap-4">
          <Skeleton width="w-4" height="h-4" />
          <Skeleton width="w-32" height="h-4" />
        </div>
      </div>

      {/* Основной контент */}
      <div className="px-4 pb-20">
        {/* Форма редактирования - skeleton */}
        <div className="space-y-6">
          {/* Личная информация */}
          <div>
            <Skeleton width="w-32" height="h-5" className="mb-4" />
            <div className="space-y-3">
              <div>
                <Skeleton width="w-16" height="h-4" className="mb-2" />
                <Skeleton width="w-full" height="h-12" />
              </div>
              <div>
                <Skeleton width="w-20" height="h-4" className="mb-2" />
                <Skeleton width="w-full" height="h-12" />
              </div>
            </div>
          </div>

          {/* Хоккейная информация */}
          <div>
            <Skeleton width="w-36" height="h-5" className="mb-4" />
            <div className="space-y-3">
              <div>
                <Skeleton width="w-16" height="h-4" className="mb-2" />
                <Skeleton width="w-full" height="h-12" />
              </div>
              <div>
                <Skeleton width="w-24" height="h-4" className="mb-2" />
                <Skeleton width="w-full" height="h-12" />
              </div>
            </div>
          </div>

          {/* Физические характеристики */}
          <div>
            <Skeleton width="w-40" height="h-5" className="mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <Skeleton width="w-16" height="h-4" className="mb-2" />
                  <Skeleton width="w-full" height="h-12" />
                </div>
              ))}
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-6">
            <Skeleton width="w-full" height="h-12" rounded />
            <Skeleton width="w-full" height="h-12" rounded />
          </div>

          {/* Информация о премиум */}
          <div className="bg-[#2d3448] rounded-lg p-4">
            <Skeleton width="w-48" height="h-5" className="mb-3" />
            <div className="space-y-2">
              <Skeleton width="w-full" height="h-4" />
              <Skeleton width="w-3/4" height="h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};