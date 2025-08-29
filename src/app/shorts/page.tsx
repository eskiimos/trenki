'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Heart, MessageCircle, Share, MoreVertical, Volume2, VolumeX } from 'lucide-react';

const ShortsContent = () => {
  const searchParams = useSearchParams();
  const startIndex = parseInt(searchParams.get('index') || '0');
  
  const [currentVideoIndex, setCurrentVideoIndex] = useState(startIndex);
  const [isLiked, setIsLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Список коротких видео
  const videos = [
    {
      id: 1,
      src: '/video/shots/short_1.mp4',
      poster: '/images/preview_shorts/shorts_1.png',
      likes: 156,
      comments: 23,
      description: 'Быстрая тренировка на все группы мышц',
      author: 'Марк Петров'
    },
    {
      id: 2,
      src: '/video/shots/short_2.mp4',
      poster: '/images/preview_shorts/shorts_2.png',
      likes: 289,
      comments: 41,
      description: 'Кардио тренировка для сжигания жира',
      author: 'Анна Ковалева'
    },
    {
      id: 3,
      src: '/video/shots/short_3.mp4',
      poster: '/images/preview_shorts/shorts_3.png',
      likes: 203,
      comments: 18,
      description: 'Упражнения для укрепления кора',
      author: 'Сергей Михайлов'
    },
    {
      id: 4,
      src: '/video/shots/short_4.mp4',
      poster: '/images/preview_shorts/shorts_4.png',
      likes: 342,
      comments: 67,
      description: 'Растяжка после тренировки',
      author: 'Елена Власова'
    }
  ];

  const currentVideo = videos[currentVideoIndex];

  const toggleLike = () => {
    setIsLiked(!isLiked);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoEnd = () => {
    // Зацикливаем видео
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  };

  const handleSwipeUp = () => {
    // Переход к следующему видео (если есть)
    if (currentVideoIndex < videos.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentVideoIndex(currentVideoIndex + 1);
        setIsLiked(false);
        setIsTransitioning(false);
      }, 150);
    }
  };

  const handleSwipeDown = () => {
    // Переход к предыдущему видео (если есть)
    if (currentVideoIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentVideoIndex(currentVideoIndex - 1);
        setIsLiked(false);
        setIsTransitioning(false);
      }, 150);
    }
  };

  useEffect(() => {
    // Автозапуск видео при загрузке/смене
    if (videoRef.current && !isTransitioning) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  }, [currentVideoIndex, isTransitioning]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent" style={{ paddingTop: '80px' }}>
        <Link href="/" className="text-white hover:text-gray-300">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-white font-semibold">Треньки</h1>
        <button className="text-white hover:text-gray-300">
          <MoreVertical size={24} />
        </button>
      </div>

      {/* Video Container */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <div className={`w-full h-full transition-all duration-300 ease-out ${
          isTransitioning ? 'scale-95 opacity-50' : 'scale-100 opacity-100'
        }`}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            src={currentVideo.src}
            poster={currentVideo.poster}
            autoPlay
            muted={isMuted}
            loop
            playsInline
            onEnded={handleVideoEnd}
            onClick={toggleMute}
          />
        </div>

        {/* UI Overlay with fade transition */}
        <div className={`absolute inset-0 transition-opacity duration-200 ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}>
          {/* Right Side Actions */}
          <div className="absolute right-4 bottom-20 flex flex-col items-center space-y-6">
            {/* Like Button */}
            <button
              onClick={toggleLike}
              className="flex flex-col items-center space-y-1"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                isLiked ? 'bg-red-500 scale-110' : 'bg-white/20 backdrop-blur-sm'
              }`}>
                <Heart 
                  size={24} 
                  className={`${isLiked ? 'text-white fill-current' : 'text-white'}`} 
                />
              </div>
              <span className="text-white text-xs font-medium">
                {isLiked ? currentVideo.likes + 1 : currentVideo.likes}
              </span>
            </button>

            {/* Comment Button */}
            <button className="flex flex-col items-center space-y-1">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <MessageCircle size={24} className="text-white" />
              </div>
              <span className="text-white text-xs font-medium">{currentVideo.comments}</span>
            </button>

            {/* Share Button */}
            <button className="flex flex-col items-center space-y-1">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Share size={24} className="text-white" />
              </div>
              <span className="text-white text-xs font-medium">Поделиться</span>
            </button>

            {/* Volume Button */}
            <button
              onClick={toggleMute}
              className="flex flex-col items-center space-y-1"
            >
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                {isMuted ? (
                  <VolumeX size={24} className="text-white" />
                ) : (
                  <Volume2 size={24} className="text-white" />
                )}
              </div>
            </button>
          </div>

          {/* Bottom Info */}
          <div className="absolute bottom-4 left-4 right-20 text-white">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-black font-semibold text-sm">
                  {currentVideo.author.charAt(0)}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-sm">{currentVideo.author}</h3>
                <button className="text-xs text-blue-400">Подписаться</button>
              </div>
            </div>
            <p className="text-sm mb-2">{currentVideo.description}</p>
          </div>
        </div>
      </div>

      {/* Touch/Swipe Area for Navigation */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top half - swipe down for previous */}
        <div 
          className="absolute top-0 left-0 right-0 h-1/2 pointer-events-auto"
          onTouchStart={(e) => {
            const startY = e.touches[0].clientY;
            const handleTouchEnd = (endEvent: TouchEvent) => {
              const endY = endEvent.changedTouches[0].clientY;
              if (endY - startY > 50) { // Swipe down
                handleSwipeDown();
              }
              document.removeEventListener('touchend', handleTouchEnd);
            };
            document.addEventListener('touchend', handleTouchEnd);
          }}
        />
        
        {/* Bottom half - swipe up for next */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-1/2 pointer-events-auto"
          onTouchStart={(e) => {
            const startY = e.touches[0].clientY;
            const handleTouchEnd = (endEvent: TouchEvent) => {
              const endY = endEvent.changedTouches[0].clientY;
              if (startY - endY > 50) { // Swipe up
                handleSwipeUp();
              }
              document.removeEventListener('touchend', handleTouchEnd);
            };
            document.addEventListener('touchend', handleTouchEnd);
          }}
        />
      </div>
    </div>
  );
};

const ShortsPage = () => {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-black text-white">Загрузка...</div>}>
      <ShortsContent />
    </Suspense>
  );
};

export default ShortsPage;