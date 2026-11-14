export interface WorkoutCheckpoint {
  playbackId: string;
  positionSequence: number;
  watchedDuration: number;
}

export function isWorkoutCheckpoint(value: unknown): value is WorkoutCheckpoint {
  if (typeof value !== 'object' || value === null) return false;
  const { playbackId, positionSequence, watchedDuration } = value as WorkoutCheckpoint;
  return typeof playbackId === 'string' && playbackId.length === 36 &&
    Number.isInteger(positionSequence) && positionSequence > 0 && positionSequence <= 2147483647 &&
    Number.isInteger(watchedDuration) && watchedDuration >= 0 && watchedDuration <= 2147483647;
}

export function readWorkoutCheckpoint(key: string): WorkoutCheckpoint | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    return isWorkoutCheckpoint(saved) ? saved : null;
  } catch {
    return null;
  }
}
