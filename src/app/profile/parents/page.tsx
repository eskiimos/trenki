'use client';

// Страница «Родителям» (решение босса: отдельная страница вместо секции в
// профиле): приглашение родителя, список привязанных, запрос отвязки.
// Вся логика — в самодостаточном ParentInviteSection.

import Link from 'next/link';
import Image from 'next/image';
import BottomNavigation from '@/components/BottomNavigation';
import ParentInviteSection from '@/components/ParentInviteSection';

const ProfileParentsPage = () => {
  return (
    // Тапбар фиксированный: клиренс снизу — .pb-nav (safe-area + 96, правило проекта)
    <div className="min-h-screen bg-surface text-white pb-nav">
      {/* Шапка */}
      <div className="flex items-center gap-4 p-4 safe-top max-w-3xl md:mx-auto md:px-8">
        {/* Вход сюда — из «Настроек», туда же и возвращаем */}
        <Link href="/profile/settings" aria-label="Назад в настройки" className="inline-flex">
          <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
        </Link>
        <h1 className="text-white text-xs font-bold font-overpass uppercase tracking-[0.5px]">
          Родителям
        </h1>
      </div>

      <div className="px-4 max-w-3xl md:mx-auto md:px-8">
        <p className="text-muted text-sm leading-relaxed mb-4">
          Пригласи родителя — он получит свой кабинет и будет видеть твой прогресс:
          уровень, серию, тренировки за неделю и место в лиге.
        </p>
        <ParentInviteSection />
      </div>

      <BottomNavigation activeTab="profile" />
    </div>
  );
};

export default ProfileParentsPage;
