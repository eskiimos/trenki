'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SendHorizonal } from 'lucide-react';

// Шторка «описание + комментарии» для ленты треньков (Instagram-стиль):
// видео сверху сжимается в карточку, ниже — автор, полное описание и
// комментарии с закреплённым полем ввода. Открывается из ShortsPlayer
// (кнопка комментариев или тап по описанию), закрывается тапом по грабберу,
// по свёрнутому видео или Escape.

interface SheetTrainer {
  id: string;
  name: string;
  lastName: string;
  avatar: string | null;
}

interface SheetShort {
  id: string;
  title: string;
  description?: string;
  trainer?: SheetTrainer;
}

interface CommentUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  profile?: { avatarUrl: string | null } | null;
}

interface ShortCommentData {
  id: string;
  text: string;
  createdAt: string;
  user: CommentUser;
}

interface ShortsSheetProps {
  short: SheetShort;
  /** true на время exit-анимации: шит остаётся смонтированным со slideDown */
  closing: boolean;
  onClose: () => void;
  /** Успешно добавили комментарий — родитель обновляет commentsCount на рейле */
  onCommentAdded: () => void;
}

const commentAuthorName = (user: CommentUser) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.username || 'Пользователь';
};

export const ShortsSheet: React.FC<ShortsSheetProps> = ({
  short,
  closing,
  onClose,
  onCommentAdded,
}) => {
  const router = useRouter();
  const [comments, setComments] = useState<ShortCommentData[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Загрузка комментариев при открытии
  useEffect(() => {
    let cancelled = false;
    const loadComments = async () => {
      setIsLoadingComments(true);
      try {
        const response = await fetch(`/api/shorts/${short.id}/comments`);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setComments(data.comments || []);
        }
      } catch (error) {
        console.error('Error loading comments:', error);
      } finally {
        if (!cancelled) setIsLoadingComments(false);
      }
    };
    loadComments();
    return () => { cancelled = true; };
  }, [short.id]);

  // Escape закрывает шит
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Отправка комментария. Сессия — по httpOnly-cookie, 401 → на логин.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/shorts/${short.id}/comments`, {
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
          setComments(prev => [data.comment, ...prev]);
          setText('');
          onCommentAdded();
        }
      }
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className={`fixed left-0 right-0 bottom-0 z-50 flex flex-col bg-[#101530] rounded-t-2xl ${
        closing ? 'animate-slideDown' : 'animate-slideUp'
      }`}
      // Верх шита — сразу под свёрнутой карточкой видео
      // (карточка: top = safe-area + 8px, height 38vh, плюс зазор 8px)
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 38vh + 16px)' }}
    >
      {/* Граббер — тап закрывает */}
      <button
        onClick={onClose}
        className="w-full py-3 flex justify-center shrink-0"
        aria-label="Закрыть"
      >
        <span className="w-10 h-1 rounded-full bg-white/25" />
      </button>

      {/* Скроллящаяся часть: автор, описание, разделитель, комментарии */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 animate-fadeIn">
        {/* Автор */}
        {short.trainer && (
          <Link
            href={`/trainers/${short.trainer.id}`}
            className="flex items-center gap-2 mb-3"
          >
            <div className="w-9 h-9 rounded-full bg-gray-600 overflow-hidden shrink-0">
              {short.trainer.avatar ? (
                <img src={short.trainer.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br from-blue-500 to-purple-600">
                  {short.trainer.name.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-white font-medium text-sm">
              {short.trainer.name} {short.trainer.lastName}
            </span>
          </Link>
        )}

        {/* Полное описание */}
        <p className="text-white text-sm font-semibold mb-1">{short.title}</p>
        {short.description && (
          <p className="text-white/80 text-sm whitespace-pre-wrap">{short.description}</p>
        )}

        <div className="border-t border-white/10 my-4" />

        {/* Комментарии */}
        <p className="text-white text-sm font-semibold mb-3">Комментарии</p>

        {isLoadingComments ? (
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Поле ввода — прижато к низу шита, закрывает зону тапбара */}
      <div
        className="shrink-0 border-t border-white/10 px-4 pt-3 bg-[#101530]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
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
    </div>
  );
};
