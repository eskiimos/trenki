'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Comment {
  id: string;
  type: 'video' | 'short';
  text: string;
  createdAt: string;
  author: string;
  target: { id: string; title: string };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'video' | 'short'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchComments = async () => {
    try {
      const res = await fetch('/api/admin/comments');
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, []);

  const handleDelete = async (c: Comment) => {
    if (!confirm(`Удалить комментарий от «${c.author}»?\n\n${c.text}`)) return;
    setDeletingId(c.id);
    try {
      const res = await fetch('/api/admin/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: c.type, id: c.id }),
      });
      if (res.ok) {
        setComments((prev) => prev.filter((x) => x.id !== c.id));
      } else {
        alert('Не удалось удалить комментарий');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const visible = comments.filter((c) => filter === 'all' || c.type === filter);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">💬 Комментарии</h1>
          <Link href="/admin" className="text-xs text-[#A1FF4A] hover:underline">
            ← В админку
          </Link>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Постмодерация: комментарии публикуются сразу, здесь можно удалить неуместные.
        </p>

        {/* Фильтр по типу */}
        <div className="flex gap-2 mb-4">
          {([
            ['all', 'Все'],
            ['video', 'К видео'],
            ['short', 'К тренькам'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === key
                  ? 'bg-[#445CFF] text-white'
                  : 'bg-[#1a1f3a] text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-gray-400 text-sm py-10 text-center">Загрузка…</div>
        ) : visible.length === 0 ? (
          <div className="text-gray-400 text-sm py-10 text-center">Комментариев нет</div>
        ) : (
          <div className="space-y-3">
            {visible.map((c) => (
              <div
                key={`${c.type}-${c.id}`}
                className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{c.author}</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                        {c.type === 'video' ? 'видео' : 'тренька'}
                      </span>
                      <span className="text-xs text-gray-500">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-200 mt-1.5 break-words whitespace-pre-wrap">
                      {c.text}
                    </p>
                    <div className="text-xs text-gray-500 mt-2 truncate">
                      → {c.target.title}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(c)}
                    disabled={deletingId === c.id}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-[#FF8C4A]/15 text-[#FF8C4A] hover:bg-[#FF8C4A]/25 transition-colors disabled:opacity-50"
                  >
                    {deletingId === c.id ? '…' : 'Удалить'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
