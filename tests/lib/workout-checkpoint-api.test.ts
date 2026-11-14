import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const db = vi.hoisted(() => ({
  workoutSession: { findUnique: vi.fn(), updateMany: vi.fn() },
  workoutSessionVideo: { updateMany: vi.fn(), findUnique: vi.fn() },
  transaction: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ default: { ...db, $transaction: db.transaction } }));
vi.mock('@/lib/coach/guards', () => ({ requireAuthUser: async () => ({ user: { id: 'athlete' } }) }));

import { POST } from '@/app/api/training/update/route';

const previous = '23ef94b2-d430-4325-8b82-bbd490432eba';
const checkpoint = { playbackId: previous, positionSequence: 2, watchedDuration: 8 };
function request(body: Record<string, unknown>) {
  return new NextRequest('https://trenki.test/api/training/update', {
    method: 'POST',
    body: JSON.stringify({ sessionId: 'workout', videoId: 'module', ...body }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  db.transaction.mockImplementation(fn => fn(db));
  db.workoutSession.findUnique.mockResolvedValue({ userId: 'athlete' });
  db.workoutSession.updateMany.mockResolvedValue({ count: 1 });
  db.workoutSessionVideo.updateMany.mockResolvedValue({ count: 1 });
  db.workoutSessionVideo.findUnique.mockResolvedValue({ watchedDuration: 8, completed: false, skipped: false });
});

describe('workout progress checkpoints', () => {
  it('accepts a lower position after rewind only for newer writes from the current player', async () => {
    const response = await POST(request({ action: 'progress', ...checkpoint }));
    expect(response.status).toBe(200);
    expect(db.workoutSessionVideo.updateMany).toHaveBeenCalledWith({
      where: {
        sessionId: 'workout', videoId: 'module', completed: false, skipped: false,
        session: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        playbackId: previous, positionSequence: { lt: 2 },
      },
      data: { watchedDuration: 8, positionSequence: 2 },
    });
  });

  it('replays an unsent exit checkpoint before opening a new player', async () => {
    const response = await POST(request({ action: 'start', trackPlayback: true, pendingCheckpoint: checkpoint }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.resumeAt).toBe(8);
    expect(data.playbackId).not.toBe(previous);
    expect(db.workoutSessionVideo.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ playbackId: previous, positionSequence: { lt: 2 } }),
      data: { watchedDuration: 8, positionSequence: 2 },
    }));
    expect(db.workoutSessionVideo.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ playbackId: data.playbackId, positionSequence: 0 }),
    }));
  });

  it('does not write a partially formed ordered checkpoint', async () => {
    const response = await POST(request({ action: 'progress', playbackId: previous, watchedDuration: 8 }));
    expect(response.status).toBe(400);
    expect(db.workoutSessionVideo.updateMany).not.toHaveBeenCalled();
  });
});
