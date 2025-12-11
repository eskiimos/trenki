'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Send } from 'lucide-react';
import { ShortsPlayer } from '@/components/ShortsPlayer';
import { getTelegramId } from '@/lib/auth';

interface ShortPageProps {
  params: Promise<{
    id: string;
  }>;
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
  };
}

export default function ShortPage({ params }: ShortPageProps) {
  const router = useRouter();
  const userId = getTelegramId();
  
  const [shortId, setShortId] = useState<string>('');
  const [short, setShort] = useState<ShortData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Комментарии
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // Загружаем short
  useEffect(() => {
    const loadShort = async () => {
      try {
        setIsLoading(true);
        
        const resolvedParams = await params;
        const currentShortId = resolvedParams.id;
        setShortId(currentShortId);
        
        // Загружаем данные short
        const url = userId 
          ? `/api/shorts/${currentShortId}?userId=${userId}`
          : `/api/shorts/${currentShortId}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          setShort(data.short);
        } else {
          console.error('Failed to load short');
          router.push('/');
        }
      } catch (error) {
        console.error('Error loading short:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };
    loadShort();
  }, [params, userId, router]);

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

  // Лайк
  const handleLike = async () => {
    if (!userId || !short) {
      alert('Пожалуйста, войдите в приложение');
      return;
    }

    const wasLiked = short.isLiked;
    
    // Оптимистичное обновление
    setShort(prev => prev ? {
      ...prev,
      isLiked: !wasLiked,
      likesCount: wasLiked ? prev.likesCount - 1 : prev.likesCount + 1
    } : null);

    try {
      const response = await fetch(`/api/shorts/${short.id}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-User-ID': userId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setShort(prev => prev ? {
          ...prev,
          isLiked: data.isLiked,
          likesCount: data.likesCount
        } : null);
      } else {
        // Откатываем изменения
        setShort(prev => prev ? {
          ...prev,
          isLiked: wasLiked,
          likesCount: short.likesCount
        } : null);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Откатываем изменения
      setShort(prev => prev ? {
        ...prev,
        isLiked: wasLiked,
        likesCount: short.likesCount
      } : null);
    }
  };

  // Открыть комментарии
  const handleOpenComments = () => {
    setShowComments(true);
  };

  // Поделиться
  const handleShare = async () => {
    if (!short) return;
    
    const shareUrl = `${window.location.origin}/shorts/${short.id}`;
    const shareText = `${short.title}${short.description ? ` - ${short.description}` : ''}`;
    
    try {
      // 1. Telegram Web App (приоритет для Telegram)
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        window.Telegram.WebApp.openTelegramLink(
          `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
        );
        return;
      }
      
      // 2. Web Share API (нативная функция поделиться)
      if (navigator.share) {
        await navigator.share({
          title: short.title,
          text: shareText,
          url: shareUrl,
        });
        return;
      }
      
      // 3. Fallback - копируем в буфер обмена
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert('✓ Ссылка скопирована в буфер обмена');
      } else {
        // Старый метод для браузеров без Clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('✓ Ссылка скопирована');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      alert('Не удалось поделиться видео');
    }
  };

  // Добавить комментарий
  const handleAddComment = async () => {
    if (!newComment.trim() || !short) return;

    if (!userId) {
      alert('Пожалуйста, войдите в приложение');
      return;
    }

    try {
      const response = await fetch(`/api/shorts/${short.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, text: newComment }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
        
        // Обновляем счетчик комментариев
        setShort(prev => prev ? {
          ...prev,
          commentsCount: (prev.commentsCount || 0) + 1
        } : null);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  if (isLoading || !short) {
    return (
      <div className="fixed inset-0 bg-[#101530] z-50 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Shorts Player */}
      <ShortsPlayer
        short={short}
        onLike={handleLike}
        onComment={handleOpenComments}
        onShare={handleShare}
        backUrl="/shorts?index=0"
      />

      {/* Comments Section */}
      {showComments && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#101530] rounded-t-3xl z-50 max-h-[70vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-white font-semibold">
              Комментарии {comments.length > 0 && `(${comments.length})`}
            </h3>
            <button
              onClick={() => setShowComments(false)}
              className="text-white/70 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingComments ? (
              <div className="text-center text-white/50 py-8">
                Загрузка комментариев...
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center text-white/50 py-8">
                Пока нет комментариев.<br />Будьте первым!
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-semibold">
                      {comment.user.firstName?.charAt(0) || comment.user.username?.charAt(0) || 'U'}
                    </span>
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

          {/* Add Comment Input */}
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
                className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
