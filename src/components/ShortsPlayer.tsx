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
  const [isMuted, setIsMuted] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
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
          // Автоматически включаем звук после начала воспроизведения
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.muted = false;
              setIsMuted(false);
            }
          }, 100);
        } catch (error) {
          console.error('Autoplay failed:', error);
        }
      };
      playVideo();
    }
  }, [short.id, autoPlay, isVideoReady]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoEnd = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setVideoProgress(progress);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      videoRef.current.currentTime = videoRef.current.duration * percentage;
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex">
      {/* Back Button (Top Left) */}
      <button 
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-30 w-10 h-10 flex items-center justify-center pointer-events-auto"
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
      <div 
        className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black pointer-events-none"
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover pointer-events-auto"
          src={videoUrl}
          poster={short.thumbnail}
          autoPlay={autoPlay}
          muted={isMuted}
          loop
          playsInline
          onEnded={handleVideoEnd}
          onTimeUpdate={handleTimeUpdate}
        />

        {/* UI Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Right Side Actions */}
          <div className="absolute right-4 bottom-24 flex flex-col items-center space-y-3">
            {/* Like Button */}
            <button
              onClick={onLike}
              className="w-14 h-14 rounded-full bg-[#0A0B0F]/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform pointer-events-auto"
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
              className="w-14 h-14 rounded-full bg-[#0A0B0F]/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform pointer-events-auto"
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
              className="w-14 h-14 rounded-full bg-[#0A0B0F]/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform pointer-events-auto"
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
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-16 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <div className="space-y-2">
              {/* Trainer Info */}
              {short.trainer && (
                <Link 
                  href={`/trainers/${short.trainer.id}`}
                  className="flex items-center space-x-2 pointer-events-auto"
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
                <div className="relative">
                  <p className={`text-xs text-white/90 drop-shadow-md leading-relaxed ${
                    isDescriptionExpanded ? '' : 'line-clamp-2'
                  }`}>
                    {short.description}
                    {!isDescriptionExpanded && short.description.length > 80 && (
                      <button 
                        onClick={() => setIsDescriptionExpanded(true)}
                        className="text-white/70 text-xs ml-1 inline pointer-events-auto"
                      >
                        ...
                      </button>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Video Timeline (Bottom) */}
          <div className="absolute bottom-0 left-0 right-0 h-12 px-4 flex items-center bg-black/20">
            <div 
              className="w-full h-1 bg-white/30 rounded-full cursor-pointer relative pointer-events-auto"
              onClick={handleSeek}
            >
              <div 
                className="absolute top-0 left-0 h-full bg-white rounded-full transition-all"
                style={{ width: `${videoProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
