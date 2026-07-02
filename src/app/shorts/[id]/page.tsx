'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Send } from 'lucide-react';
import { ShortsPlayer } from '@/components/ShortsPlayer';

// Swiper
import { Swiper, SwiperSlide } from 'swiper/react';
import { Virtual, Mousewheel, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';

// Swiper styles
import 'swiper/css';
import 'swiper/css/virtual';

interface ShortPageProps {
  params: Promise<{ id: string }>;
}

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

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    profile: {
      avatarUrl: string | null;
    } | null;
  };
}

export default function ShortPage({ params }: ShortPageProps) {
  const router = useRouter();
  const [shortId, setShortId] = useState<string>('');
  const [short, setShort] = useState<ShortData | null>(null);
  const [shorts, setShorts] = useState<ShortData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Комментарии
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // Загружаем short и все shorts для навигации
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        const resolvedParams = await params;
        const currentId = resolvedParams.id;
        setShortId(currentId);
        
        // Если открыто со страницы тренера (?trainerId=) — лента свайпа = только
        // его шортсы; иначе (прямая/расшаренная ссылка) — все, как раньше.
        // Сессия передаётся cookie, isLiked заполнит сервер.
        let trainerId = '';
        try { trainerId = new URLSearchParams(window.location.search).get('trainerId') || ''; } catch {}
        const allResponse = await fetch(
          trainerId ? `/api/shorts?trainerId=${encodeURIComponent(trainerId)}` : '/api/shorts',
        );

        if (allResponse.ok) {
          const allData = await allResponse.json();
          const allShorts = allData.shorts || [];
          setShorts(allShorts);

          const idx = allShorts.findIndex((s: ShortData) => s.id === currentId);
          if (idx !== -1) {
            setCurrentIndex(idx);
            setShort(allShorts[idx]);
          } else {
            const singleResponse = await fetch(`/api/shorts/${currentId}`);
            if (singleResponse.ok) {
              const singleData = await singleResponse.json();
              setShort(singleData.short);
            } else {
              router.push('/shorts');
            }
          }
        }
      } catch (error) {
        console.error('Error loading:', error);
        router.push('/shorts');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [params, router]);

  // Загружаем комментарии
  useEffect(() => {
    if (!shortId) return;
    
    const loadComments = async () => {
      setIsLoadingComments(true);
      try {
        const response = await fetch(`/api/shorts/${shortId}/comments`);
        if (response.ok) {
          const data = await response.json();
          setComments(data.comments || []);
        }
      } catch (error) {
        console.error('Error loading comments:', error);
      } finally {
        setIsLoadingComments(false);
      }
    };
    loadComments();
  }, [shortId]);

  // Лайк. Плеер рендерится из МАССИВА shorts, поэтому обновляем именно массив
  // (раньше писали только в singleton short → лайк «слетал» после свайпа
  // туда-обратно). Мгновенный отклик даёт локальный стейт в ShortsPlayer.
  const handleLike = async () => {
    if (!short) return;
    const id = short.id;
    const wasLiked = !!short.isLiked;
    const baseCount = short.likesCount;

    const setLikeState = (isLiked: boolean, likesCount: number) => {
      setShorts(prev => prev.map(s => (s.id === id ? { ...s, isLiked, likesCount } : s)));
      setShort(prev => (prev && prev.id === id ? { ...prev, isLiked, likesCount } : prev));
    };

    // оптимистично
    setLikeState(!wasLiked, wasLiked ? baseCount - 1 : baseCount + 1);

    try {
      const response = await fetch(`/api/shorts/${id}/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 401) {
        setLikeState(wasLiked, baseCount); // откат
        router.push('/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setLikeState(!!data.isLiked, data.likesCount); // точное значение сервера
      } else {
        setLikeState(wasLiked, baseCount); // откат
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setLikeState(wasLiked, baseCount); // откат
    }
  };

  // Открыть комментарии
  const handleOpenComments = () => setShowComments(true);

  // Поделиться
  const handleShare = async () => {
    if (!short) return;
    
    const shareUrl = `${window.location.origin}/shorts/${short.id}`;
    
    try {
      if (navigator.share) {
        await navigator.share({ title: short.title, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        alert('Ссылка скопирована!');
      }
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  // Добавить комментарий
  const handleAddComment = async () => {
    if (!newComment.trim() || !short) return;

    try {
      const response = await fetch(`/api/shorts/${short.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newComment }),
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
        setShort(prev => prev ? {
          ...prev,
          commentsCount: (prev.commentsCount || 0) + 1
        } : null);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  // Обработка смены слайда
  const handleSlideChange = useCallback((swiper: SwiperType) => {
    const newIndex = swiper.activeIndex;
    if (newIndex !== currentIndex && shorts[newIndex]) {
      setCurrentIndex(newIndex);
      setShort(shorts[newIndex]);
      setShortId(shorts[newIndex].id);
      window.history.replaceState(null, '', `/shorts/${shorts[newIndex].id}`);
    }
  }, [currentIndex, shorts]);

  if (isLoading || !short) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <Swiper
        modules={[Virtual, Mousewheel, Keyboard]}
        direction="vertical"
        slidesPerView={1}
        spaceBetween={0}
        initialSlide={currentIndex}
        virtual={{
          enabled: true,
          addSlidesAfter: 2,
          addSlidesBefore: 2,
        }}
        mousewheel={{
          sensitivity: 1,
          thresholdDelta: 30,
        }}
        keyboard={{
          enabled: true,
        }}
        speed={400}
        resistance={true}
        resistanceRatio={0.85}
        threshold={10}
        touchRatio={1}
        touchAngle={45}
        onSlideChange={handleSlideChange}
        className="w-full h-full"
        style={{ touchAction: 'pan-y' }}
      >
        {shorts.map((s, index) => (
          <SwiperSlide key={s.id} virtualIndex={index} className="!h-full">
            <ShortsPlayer
              short={s}
              onLike={handleLike}
              onComment={handleOpenComments}
              onShare={handleShare}
              canSwipeUp={index < shorts.length - 1}
              canSwipeDown={index > 0}
              isActive={index === currentIndex}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Comments Modal */}
      {showComments && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#101530] rounded-t-3xl z-50 max-h-[70vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-white font-semibold">
              Комментарии {comments.length > 0 && `(${comments.length})`}
            </h3>
            <button onClick={() => setShowComments(false)} className="text-white/70 hover:text-white">
              <X size={24} />
            </button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingComments ? (
              <div className="text-center text-white/50 py-8">Загрузка...</div>
            ) : comments.length === 0 ? (
              <div className="text-center text-white/50 py-8">
                Пока нет комментариев.<br />Будьте первым!
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {comment.user.profile?.avatarUrl ? (
                      <img 
                        src={comment.user.profile.avatarUrl} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-xs font-semibold">
                        {comment.user.firstName?.charAt(0) || comment.user.username?.charAt(0) || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-white text-sm font-medium">
                        {comment.user.firstName || comment.user.username || 'Пользователь'}
                      </span>
                      <span className="text-white/40 text-xs">
                        {new Date(comment.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <p className="text-white/90 text-sm">{comment.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Comment */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Добавить комментарий..."
                className="flex-1 bg-white/5 text-white placeholder-white/40 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center disabled:opacity-50"
              >
                <Send size={20} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
