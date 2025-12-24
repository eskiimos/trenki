'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isKinescopeUrl, getKinescopeDirectUrl } from '@/lib/videoQuality';

interface ShortData {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnail?: string;
  tags: string[];
  viewsCount: number;
  likesCount: number;
  commentsCount?: number;
  isLiked?: boolean;
  order: number;
  trainerId?: string | null;
  trainer?: {
    id: string;
    name: string;
    lastName: string;
    avatar: string | null;
  };
}

interface ShortsPlayerProps {
  short: ShortData;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  backUrl?: string;
  showSwipeHint?: boolean;
  autoPlay?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export const ShortsPlayer: React.FC<ShortsPlayerProps> = ({
  short,
  onLike,
  onComment,
  onShare,
  backUrl = '/',
  showSwipeHint = false,
  autoPlay = true,
  videoRef: externalVideoRef,
}) => {
  const router = useRouter();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>(short.videoUrl);
  const [isVideoReady, setIsVideoReady] = useState(false);
  
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;

  // Загрузка Kinescope URL
  useEffect(() => {
    setIsVideoReady(false);
    const loadKinescopeUrl = async () => {
      if (!isKinescopeUrl(short.videoUrl)) {
        setVideoUrl(short.videoUrl);
        setIsVideoReady(true);
        return;
      }
      
      try {
        const result = await getKinescopeDirectUrl(short.videoUrl);
        if (result.directUrl) {
          setVideoUrl(result.directUrl);
        }
      } catch (error) {
        console.error('Error loading Kinescope URL:', error);
        setVideoUrl(short.videoUrl);
      } finally {
        setIsVideoReady(true);
      }
    };
    
    loadKinescopeUrl();
  }, [short.videoUrl]);

  // Автоплей - запускаем только когда URL готов
  useEffect(() => {
    if (videoRef.current && autoPlay && isVideoReady) {
      const playVideo = async () => {
        try {
          videoRef.current!.currentTime = 0;
          await videoRef.current!.play();
        } catch (error) {
          console.error('Autoplay failed:', error);
        }
      };
      playVideo();
    }
  }, [short.id, autoPlay, isVideoReady]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex">
      {/* Back Button (Top Left) */}
      <button 
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-30 w-10 h-10 flex items-center justify-center"
      >
        <img 
          src="/icons/icon-action-back.svg" 
          alt="Назад" 
          width={24} 
          height={24}
          className="drop-shadow-lg"
        />
      </button>

      {/* Video Container */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
        {/* Простой стандартный плеер с нативными контролами */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          src={videoUrl}
          poster={short.thumbnail}
          autoPlay={autoPlay}
          loop
          playsInline
          controls
          webkit-playsinline="true"
          preload="auto"
        />

        {/* UI Overlay - только кнопки действий */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Right Side Actions */}
          <div className="absolute right-4 bottom-24 flex flex-col items-center space-y-3 z-10">
            {/* Like Button */}
            <button
              onClick={onLike}
              className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform pointer-events-auto"
            >
              <img 
                src={short.isLiked ? "/icons/video/shorts/Like.svg" : "/icons/video/shorts/Like-def.svg"} 
                alt="Лайк" 
                width={24} 
                height={24}
              />
            </button>

            {/* Comment Button */}
            <button 
              onClick={onComment}
              className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform pointer-events-auto"
            >
              <img 
                src="/icons/video/shorts/action-coment.svg" 
                alt="Комментарии" 
                width={24} 
                height={24}
              />
            </button>

            {/* Share Button */}
            <button 
              onClick={onShare}
              className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform pointer-events-auto"
            >
              <img 
                src="/icons/video/shorts/action-share.svg" 
                alt="Поделиться" 
                width={24} 
                height={24}
              />
            </button>
          </div>

          {/* Bottom Info */}
          <div className="absolute bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
            <div className="space-y-2">
              {/* Trainer Info */}
              {short.trainer && (
                <Link 
                  href={`/trainers/${short.trainer.id}`}
                  className="flex items-center space-x-2 pointer-events-auto inline-flex"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden">
                    {short.trainer.avatar ? (
                      <img 
                        src={short.trainer.avatar} 
                        alt={short.trainer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-semibold text-[10px]">
                          {short.trainer.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-white text-xs drop-shadow-md">
                    {short.trainer.name} {short.trainer.lastName}
                  </span>
                </Link>
              )}

              {/* Description (expandable) */}
              {short.description && (
                <div className="relative max-w-[60%]">
                  <p className={`text-xs text-white/90 drop-shadow-md leading-relaxed ${
                    isDescriptionExpanded ? '' : 'line-clamp-2'
                  }`}>
                    {short.description}
                  </p>
                  {!isDescriptionExpanded && short.description.length > 80 && (
                    <button 
                      onClick={() => setIsDescriptionExpanded(true)}
                      className="text-white/70 text-xs mt-1 pointer-events-auto"
                    >
                      Ещё...
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
