// Права доступа к pose-сессиям (запись скелета MediaPipe) — чистые решения без БД.
//
// Правило то же, что у карточки атлета для тренера (/api/athletes/[id]/coach-view):
// тренер видит только тех, кто ACTIVE-участник одной из его команд. Раньше
// любой COACH видел и оценивал сессии всех атлетов, а без ?athleteId получал
// последние 50 сессий всей базы — это IDOR. Сама проверка «атлет в команде
// тренера» делается запросом в БД (src/lib/coach/athlete-access.ts), здесь —
// только что с её результатом делать, чтобы это было покрыто тестами.

export interface PoseViewer {
  id: string;
  role: string; // UserRole: ATHLETE | COACH | PARENT
}

/** Чьи сессии отдавать в списке GET /api/pose-sessions. */
export type PoseListScope =
  /** Только свои. Атлет и родитель — всегда, ?athleteId игнорируется, как и раньше. */
  | { kind: 'own' }
  /** Один атлет по ?athleteId — роут обязан проверить, что он в команде тренера. */
  | { kind: 'coach-athlete'; athleteId: string }
  /** Тренер без ?athleteId — сессии всех атлетов его команд (не всей базы). */
  | { kind: 'coach-teams' };

export function resolvePoseListScope(
  viewer: PoseViewer,
  athleteIdParam: string | null | undefined,
): PoseListScope {
  if (viewer.role !== 'COACH') return { kind: 'own' };
  const athleteId = (athleteIdParam ?? '').trim();
  if (!athleteId) return { kind: 'coach-teams' };
  // Свои сессии тренеру доступны без проверки команды — как атлету.
  if (athleteId === viewer.id) return { kind: 'own' };
  return { kind: 'coach-athlete', athleteId };
}

/**
 * Можно ли открыть сессию (метаданные + подписанная ссылка на кадры).
 * `coachOfAthlete` — результат проверки «атлет в ACTIVE-составе команды тренера».
 */
export function canViewPoseSession(
  viewer: PoseViewer,
  sessionAthleteId: string,
  coachOfAthlete: boolean,
): boolean {
  if (sessionAthleteId === viewer.id) return true;
  return viewer.role === 'COACH' && coachOfAthlete;
}

/**
 * Можно ли поставить оценку/комментарий. Оценка — отзыв тренера атлету, поэтому
 * свою сессию тренер не оценивает, а чужую — только если атлет в его команде.
 */
export function canReviewPoseSession(
  viewer: PoseViewer,
  sessionAthleteId: string,
  coachOfAthlete: boolean,
): boolean {
  if (viewer.role !== 'COACH') return false;
  if (sessionAthleteId === viewer.id) return false;
  return coachOfAthlete;
}
