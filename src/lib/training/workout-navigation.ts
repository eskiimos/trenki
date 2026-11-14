export function workoutPath(id: string | null, from?: string | null): string {
  if (!id) return '/training/workout';
  const params = new URLSearchParams({ id });
  if (from === 'assignments' || from === 'calendar') params.set('from', from);
  return `/training/workout?${params}`;
}

export function workoutReturnPath(from: string | null): string {
  if (from === 'assignments') return '/profile/assignments';
  if (from === 'calendar') return '/calendar';
  return '/';
}

export function workoutModulePath(videoId: string, sessionId: string, from: string | null): string {
  const params = new URLSearchParams({ fromWorkout: 'true', sessionId });
  if (from === 'assignments' || from === 'calendar') params.set('from', from);
  return `/video/${encodeURIComponent(videoId)}?${params}`;
}
