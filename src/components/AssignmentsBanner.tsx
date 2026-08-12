'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export default function AssignmentsBanner() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/assignments?role=athlete', { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled) return;
        const list = (d.assignments ?? []) as Array<{ status: string }>;
        setPendingCount(list.filter((a) => a.status !== 'COMPLETED').length);
      } catch {}
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (!pendingCount) return null;

  const word = pluralize(pendingCount, 'тренировка', 'тренировки', 'тренировок');
  const verb = pluralize(pendingCount, 'ждёт', 'ждут', 'ждут');

  return (
    <section className="px-4 animate-fadeInDown" style={{ paddingBottom: '12px' }}>
      <Link href="/profile/assignments" style={{ textDecoration: 'none' }}>
        <div
          style={{
            width: '100%',
            padding: 16,
            background: 'linear-gradient(135deg, rgba(161, 255, 74, 0.12) 0%, rgba(68, 92, 255, 0.20) 100%)',
            border: '1px solid rgba(161, 255, 74, 0.25)',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div
              style={{
                color: '#A1FF4A',
                fontSize: 12,
                fontFamily: 'Overpass',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                lineHeight: '120%',
              }}
            >
              от тренера
            </div>
            <div
              style={{
                color: '#F9F8FE',
                fontSize: 14,
                fontFamily: 'Overpass',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                lineHeight: '120%',
                wordWrap: 'break-word',
              }}
            >
              <span style={{ color: '#A1FF4A' }}>{pendingCount}</span> {word} {verb} выполнения
            </div>
          </div>

          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'rgba(161, 255, 74, 0.15)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="#A1FF4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </Link>
    </section>
  );
}
