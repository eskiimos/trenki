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
    <div
      className="min-h-screen bg-[#101530] text-white"
      // Тапбар фиксированный: отступ снизу = safe-area + 96px (правило проекта)
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      {/* Шапка */}
      <div
        className="flex items-center gap-4 p-4 max-w-3xl md:mx-auto md:px-8"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <Link href="/profile" aria-label="Назад в профиль">
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
