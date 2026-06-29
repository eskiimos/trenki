'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BottomNavigation from '@/components/BottomNavigation';
import { Skeleton } from '@/components/Skeleton';
import { Button } from '@/components/ui';
import VideoFiltersModal, {
  VideoFilters,
  EMPTY_FILTERS,
  countActiveFilters,
} from '@/components/VideoFiltersModal';
import {
  MODULE_TYPE_LABELS,
  LOAD_TYPE_LABELS,
  MUSCLE_GROUP_LABELS,
  DIFFICULTY_LABELS,
  DURATION_BUCKETS,
  matchesDuration,
} from '@/lib/videoLabels';
import { getTelegramId } from '@/lib/auth';
import { calculateWorkoutGains, CharacteristicType } from '@/lib/characteristics';

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

interface Video {
  id: string;
  title: string;
  description?: string;
  duration: number;
  videoUrl: string;
  thumbnail?: string;
  category: string;
  difficulty: string;
  tags: string[];
  loadTypes: string[];
  equipment: string[];
  level?: string;
  viewsCount: number;
  likesCount: number;
  trainer: {
    id: string;
    name: string;
    lastName: string;
    avatar?: string;
    speciality: string;
  };
  createdAt: string;
  moduleType?: string | null;
  loadType?: string | null;
  muscleGroup?: string | null;
  rpeMin?: number | null;
  rpeMax?: number | null;
}

const VideoPage = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  const [filters, setFilters] = useState<VideoFilters>(EMPTY_FILTERS);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const videosResponse = await fetch('/api/videos');
        const videosData = await videosResponse.json();
        setVideos(videosData.videos || []);

        const profileResponse = await fetch('/api/profile');
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setUserProfile(profileData.user?.profile);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const calculateVideoGain = (loadTypes: string[]) => {
    if (!userProfile || !loadTypes || loadTypes.length === 0) return null;
    const currentCharacteristics: Record<CharacteristicType, number> = {
      ratingPower: userProfile.ratingPower || 0,
      ratingSpeed: userProfile.ratingSpeed || 0,
      ratingEndurance: userProfile.ratingEndurance || 0,
      ratingTechnique: userProfile.ratingTechnique || 0,
      ratingFlexibility: userProfile.ratingFlexibility || 0,
    };
    const gains = calculateWorkoutGains([loadTypes], currentCharacteristics);
    const totalGain = Object.values(gains).reduce((sum, val) => sum + val, 0);
    if (totalGain === 0) return null;
    return `+${totalGain.toFixed(2)}`;
  };

  // Доступные значения для каждой группы — из реальных данных
  const available = useMemo(() => {
    const set = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.filter((x): x is string => !!x))).sort();
    const setFromArr = (arr: string[][]) => Array.from(new Set(arr.flat())).filter(Boolean).sort();
    return {
      moduleTypes: set(videos.map((v) => v.moduleType)),
      loadTypes: set(videos.map((v) => v.loadType)),
      muscleGroups: set(videos.map((v) => v.muscleGroup)),
      difficulties: set(videos.map((v) => v.difficulty)),
      equipment: setFromArr(videos.map((v) => v.equipment || [])),
    };
  }, [videos]);

  // AND между группами, OR внутри группы
  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return videos.filter((v) => {
      if (q) {
        const haystack = [v.title, v.description || '', `${v.trainer.name} ${v.trainer.lastName}`]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.moduleTypes.length && (!v.moduleType || !filters.moduleTypes.includes(v.moduleType))) return false;
      if (filters.loadTypes.length && (!v.loadType || !filters.loadTypes.includes(v.loadType))) return false;
      if (filters.muscleGroups.length && (!v.muscleGroup || !filters.muscleGroups.includes(v.muscleGroup))) return false;
      if (filters.difficulties.length && !filters.difficulties.includes(v.difficulty)) return false;
      if (filters.equipment.length && !filters.equipment.some((e) => v.equipment?.includes(e))) return false;
      if (filters.durations.length && !matchesDuration(v.duration, filters.durations)) return false;
      return true;
    });
  }, [videos, filters, searchQuery]);

  const totalActive = countActiveFilters(filters);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; remove: () => void }[] = [];
    const push = <K extends keyof VideoFilters>(
      key: K,
      values: string[],
      labels?: Record<string, string>,
    ) => {
      values.forEach((v) => {
        chips.push({
          key: `${String(key)}:${v}`,
          label: labels?.[v] ?? v,
          remove: () =>
            setFilters((prev) =>
              ({
                ...prev,
                [key]: (prev[key] as string[]).filter((x) => x !== v),
              }) as VideoFilters,
            ),
        });
      });
    };
    push('moduleTypes', filters.moduleTypes, MODULE_TYPE_LABELS);
    push('loadTypes', filters.loadTypes, LOAD_TYPE_LABELS);
    push('muscleGroups', filters.muscleGroups, MUSCLE_GROUP_LABELS);
    push('difficulties', filters.difficulties, DIFFICULTY_LABELS);
    push(
      'durations',
      filters.durations,
      Object.fromEntries(DURATION_BUCKETS.map((b) => [b.id, b.label])),
    );
    push('equipment', filters.equipment);
    return chips;
  }, [filters]);

  const quickModuleTypes = available.moduleTypes;

  const VideoCardSkeleton = () => (
    <div className="mb-6">
      <div className="relative w-full aspect-video mb-3">
        <Skeleton width="w-full" height="h-full" />
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton width="w-10" height="h-10" rounded />
          <div className="flex-1 space-y-2">
            <Skeleton width="w-3/4" height="h-4" />
            <Skeleton width="w-1/2" height="h-4" />
          </div>
        </div>
        <div className="flex gap-2 mb-2">
          <Skeleton width="w-20" height="h-6" className="rounded-full" />
          <Skeleton width="w-24" height="h-6" className="rounded-full" />
          <Skeleton width="w-16" height="h-6" className="rounded-full" />
        </div>
        <Skeleton width="w-full" height="h-3" />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101530] pb-20">
        <header
          className="flex items-center justify-between p-4 bg-[#101530]"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
        >
          <div className="flex items-center space-x-2">
            <Skeleton width="w-6" height="h-6" />
            <Skeleton width="w-32" height="h-5" />
          </div>
          <div className="flex items-center space-x-4">
            <Skeleton width="w-6" height="h-6" />
            <Skeleton width="w-6" height="h-6" />
          </div>
        </header>
        <div className="overflow-x-auto px-4 py-3 hide-scrollbar">
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width="w-24" height="h-8" className="rounded-full" />
            ))}
          </div>
        </div>
        <div className="mt-4">
          {[1, 2, 3, 4].map((i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
        <BottomNavigation activeTab="video" />
      </div>
    );
  }

  const toggleQuick = (mt: string) => {
    setFilters((prev) => ({
      ...prev,
      moduleTypes: prev.moduleTypes.includes(mt)
        ? prev.moduleTypes.filter((x) => x !== mt)
        : [...prev.moduleTypes, mt],
    }));
  };

  return (
    <div className="min-h-screen bg-[#101530] pb-20">
      {/* Header */}
      <header
        className="flex items-center justify-between p-4 bg-[#101530]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <div className="flex items-center space-x-2">
          <Link href="/" className="text-white hover:text-gray-300">
            <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
          </Link>
          <h1
            className="text-white uppercase"
            style={{
              fontFamily: 'Overpass',
              fontWeight: 700,
              fontSize: '12px',
              lineHeight: '120%',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            Тренировки
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const next = !showSearch;
              setShowSearch(next);
              if (!next) setSearchQuery('');
            }}
            className="text-white hover:text-gray-300 relative"
            aria-label="Поиск"
          >
            {/* Чистая лупа (с ручкой) вместо иконки-кружка */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchQuery && (
              <span className="absolute -top-1 -right-1 bg-[#A1FF4A] rounded-full w-2 h-2" />
            )}
          </button>
          <button
            onClick={() => setShowFiltersModal(true)}
            className="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-bold uppercase tracking-wide transition"
            style={{
              borderColor: totalActive > 0 ? '#A1FF4A' : 'rgba(255,255,255,0.18)',
              color: totalActive > 0 ? '#A1FF4A' : '#FFFFFF',
            }}
            aria-label="Фильтр"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="17" x2="14" y2="17" />
            </svg>
            Фильтр
            {totalActive > 0 && (
              <span className="bg-[#A1FF4A] text-[#060919] text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
                {totalActive}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Search */}
      {showSearch && (
        <div className="px-4 pt-1 pb-2">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию или тренеру"
            className="w-full bg-[#1a1f3a] text-white placeholder:text-white/40 rounded-full px-4 py-3 outline-none border border-white/10 focus:border-[#A1FF4A]/60 transition"
            style={{ fontFamily: 'Overpass, sans-serif', fontSize: 14 }}
          />
        </div>
      )}

      {/* Quick filters: типы тренировки */}
      {quickModuleTypes.length > 0 && (
        <div className="py-3">
          <div className="flex space-x-2 overflow-x-auto px-4 hide-scrollbar">
            <button
              onClick={() => setFilters((p) => ({ ...p, moduleTypes: [] }))}
              className="px-4 py-2 rounded-full whitespace-nowrap transition-colors uppercase"
              style={{
                backgroundColor: filters.moduleTypes.length === 0 ? '#A1FF4A' : '#AEABBB1F',
                color: filters.moduleTypes.length === 0 ? '#060919' : '#F9F8FE',
                fontFamily: 'Overpass, sans-serif',
                fontWeight: 700,
                letterSpacing: '0.5px',
                fontSize: 12,
              }}
            >
              Все
            </button>
            {quickModuleTypes.map((mt) => {
              const active = filters.moduleTypes.includes(mt);
              return (
                <button
                  key={mt}
                  onClick={() => toggleQuick(mt)}
                  className="px-4 py-2 rounded-full whitespace-nowrap transition-colors uppercase"
                  style={{
                    backgroundColor: active ? '#A1FF4A' : '#AEABBB1F',
                    color: active ? '#060919' : '#F9F8FE',
                    fontFamily: 'Overpass, sans-serif',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    fontSize: 12,
                  }}
                >
                  {MODULE_TYPE_LABELS[mt] || mt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active filters bar */}
      {(activeChips.length > 0 || searchQuery) && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div
              className="text-white/60"
              style={{ fontFamily: 'Overpass, sans-serif', fontSize: 12, letterSpacing: '0.3px' }}
            >
              Найдено: <span className="text-white font-bold">{filteredVideos.length}</span>
            </div>
            {(totalActive > 0 || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setSearchQuery('');
                }}
                className="uppercase text-[#AEABBB] hover:text-white transition-colors"
                style={{
                  fontFamily: 'Overpass, sans-serif',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.5px',
                }}
              >
                Сбросить
              </button>
            )}
          </div>
          {activeChips.length > 0 && (
            <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.remove}
                  className="flex items-center gap-1.5 whitespace-nowrap"
                  style={{
                    height: 32,
                    padding: '0 10px 0 12px',
                    borderRadius: 32,
                    backgroundColor: '#A1FF4A',
                    color: '#060919',
                    fontFamily: 'Overpass, sans-serif',
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.3px',
                  }}
                >
                  <span className="uppercase">{chip.label}</span>
                  <span style={{ fontSize: 16, lineHeight: 1, marginTop: -2 }}>×</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Video Grid */}
      <div>
        {filteredVideos.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-gray-400 text-lg">Видео не найдены</p>
            <p className="text-gray-500 text-sm mt-2">Попробуйте изменить фильтры или поиск</p>
            {(totalActive > 0 || searchQuery) && (
              <Button
                type="button"
                variant="primary"
                className="mt-4"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setSearchQuery('');
                }}
              >
                Сбросить фильтры
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
            {filteredVideos.map((video) => (
              <Link key={video.id} href={`/video/${video.id}`}>
                <div>
                  <div className="relative w-full aspect-video">
                    <Image
                      src={
                        video.thumbnail && video.thumbnail.trim() !== ''
                          ? video.thumbnail
                          : '/images/video_prew_2.png'
                      }
                      alt={video.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-sm font-medium px-2.5 py-1 rounded-lg">
                      {formatDuration(video.duration)}
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-700">
                        {video.trainer.avatar ? (
                          <Image
                            src={video.trainer.avatar}
                            alt={`${video.trainer.name} ${video.trainer.lastName}`}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-bold">
                            {video.trainer.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <h3 className="text-white text-base font-semibold line-clamp-2 leading-tight flex-1">
                        {video.title.toUpperCase()}
                      </h3>
                    </div>

                    <div
                      className="overflow-x-auto -mx-4 px-4 mb-2 hide-scrollbar"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      <div className="flex gap-2 w-max">
                        {calculateVideoGain(video.loadTypes) && (
                          <div
                            className="px-3 py-1 rounded-full text-xs whitespace-nowrap font-bold flex items-center gap-1"
                            style={{ backgroundColor: 'rgba(161, 255, 74, 0.2)', color: '#FFFFFF' }}
                          >
                            <Image
                              src="/icons/video/energy-active.svg"
                              alt="Energy"
                              width={12}
                              height={12}
                            />
                            {calculateVideoGain(video.loadTypes)}
                          </div>
                        )}

                        {(() => {
                          const infoBubbles = [
                            video.moduleType && {
                              label: MODULE_TYPE_LABELS[video.moduleType] || video.moduleType,
                            },
                            video.loadType && {
                              label: LOAD_TYPE_LABELS[video.loadType] || video.loadType,
                            },
                            video.muscleGroup && {
                              label: MUSCLE_GROUP_LABELS[video.muscleGroup] || video.muscleGroup,
                            },
                            video.difficulty && {
                              label: DIFFICULTY_LABELS[video.difficulty] || video.difficulty,
                            },
                            (video.rpeMin != null || video.rpeMax != null) && {
                              label:
                                video.rpeMin != null && video.rpeMax != null
                                  ? `RPE ${video.rpeMin}–${video.rpeMax}`
                                  : video.rpeMin != null
                                    ? `RPE ${video.rpeMin}+`
                                    : `RPE ≤${video.rpeMax}`,
                            },
                          ].filter(Boolean) as { label: string }[];

                          return infoBubbles.map((bubble, i) => (
                            <span
                              key={`info-${i}`}
                              className="px-3 py-1 rounded-full text-xs whitespace-nowrap"
                              style={{ backgroundColor: '#AEABBB33', color: '#AEABBB' }}
                            >
                              {bubble.label}
                            </span>
                          ));
                        })()}

                        {video.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 rounded-full text-xs whitespace-nowrap"
                            style={{ backgroundColor: '#AEABBB33', color: '#AEABBB' }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ fontSize: '12px' }} className="text-white/60 mt-2">
                      <span>
                        {video.trainer.name} {video.trainer.lastName}
                      </span>
                      <span className="text-white/40"> | </span>
                      <span>
                        {video.likesCount >= 1000
                          ? `${(video.likesCount / 1000).toFixed(1)} тыс.`
                          : video.likesCount}{' '}
                        лайков
                      </span>
                      {video.equipment.length > 0 && (
                        <>
                          <span className="text-white/40"> | </span>
                          <span>оборудование ({video.equipment.join(', ')})</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <VideoFiltersModal
        open={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        filters={filters}
        onChange={setFilters}
        available={available}
        matchedCount={filteredVideos.length}
      />

      <BottomNavigation activeTab="video" />
    </div>
  );
};

export default VideoPage;
