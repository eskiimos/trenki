'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SendHorizonal, X } from 'lucide-react';

// Комментарии на странице видео — зеркало комментариев тренёк из ShortsSheet,
// но не шторка, а обычная секция под TagsSection. Список виден сразу (без
// сворачивания), поле ввода прижато к низу секции. Свои комментарии можно
// удалить (viewer определяется через /api/users/me; без сессии крестиков нет).

interface CommentUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  profile?: { avatarUrl: string | null } | null;
}

interface VideoCommentData {
  id: string;
  text: string;
  createdAt: string;
  user: CommentUser;
}

interface VideoCommentsProps {
  videoId: string;
}

const commentAuthorName = (user: CommentUser) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.username || 'Пользователь';
};

export default function VideoComments({ videoId }: VideoCommentsProps) {
  const router = useRouter();
  const [comments, setComments] = useState<VideoCommentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  // id текущего пользователя — чтобы показать «удалить» только на своих
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Кто смотрит (сессия по httpOnly-cookie). 401 — гость, крестиков не будет.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/users/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.id) setViewerId(data.id);
      })
      .catch(() => {
        // гость или сеть — просто без удаления
      });
    return () => { cancelled = true; };
  }, []);

  // Загрузка комментариев при монтировании и смене видео
  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    const loadComments = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/videos/${videoId}/comments`);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setComments(data.comments || []);
        }
      } catch (error) {
        console.error('Error loading video comments:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadComments();
    return () => { cancelled = true; };
  }, [videoId]);

  // Отправка комментария. Сессия — по httpOnly-cookie, 401 → на логин.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (response.ok) {
        const data = await response.json();
        if (data.comment) {
          setComments((prev) => [data.comment, ...prev]);
          setText('');
        }
      }
    } catch (error) {
      console.error('Error creating video comment:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Удаление своего комментария
  const handleDelete = async (commentId: string) => {
    if (deletingId) return;
    setDeletingId(commentId);
    try {
      const response = await fetch(`/api/videos/${videoId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (response.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (error) {
      console.error('Error deleting video comment:', error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-[#101530] rounded-2xl p-4">
      <h3
        className="text-white text-sm font-medium mb-3"
        style={{ fontFamily: 'Overpass' }}
      >
        Комментарии ({comments.length})
      </h3>

      {isLoading ? (
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto my-6" />
      ) : comments.length === 0 ? (
        <p className="text-[#AEABBB] text-sm text-center my-6">
          Пока нет комментариев — будь первым!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const authorName = commentAuthorName(comment.user);
            const avatarUrl = comment.user.profile?.avatarUrl;
            const isOwn = viewerId !== null && comment.user.id === viewerId;
            return (
              <div key={comment.id} className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gray-600 overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold bg-gradient-to-br from-blue-500 to-purple-600">
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-white text-xs font-medium truncate">{authorName}</span>
                    <span className="text-[#AEABBB] text-[11px] shrink-0">
                      {new Date(comment.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <p className="text-white/90 text-sm mt-0.5 break-words whitespace-pre-wrap">
                    {comment.text}
                  </p>
                </div>
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    className="shrink-0 p-1 text-[#AEABBB] hover:text-white disabled:opacity-40 transition-colors"
                    aria-label="Удалить комментарий"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Поле ввода — внизу секции */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Что вы об этом думаете?"
          className="flex-1 min-w-0 bg-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-[#AEABBB] outline-none focus:bg-white/15 transition-colors"
        />
        <button
          type="submit"
          disabled={!text.trim() || isSending}
          className="w-10 h-10 rounded-full bg-[#A1FF4A] flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-90 transition-transform"
          aria-label="Отправить комментарий"
        >
          <SendHorizonal size={18} className="text-black" />
        </button>
      </form>
    </div>
  );
}
