/**
 * Pure logic for the rescue nudge feature — testable in isolation.
 * The Firebase Function (functions/rescue-nudge.js) inlines these
 * same checks as CommonJS since it can't import browser ES modules.
 */

export const ATTENDANCE_THRESHOLD = 0.70;
export const LOOKBACK_DAYS        = 30;

/** Returns true if the client marked today as a rest day. */
export function isRestDay(client, now = new Date()) {
  const marked = client.restDayMarkedAt;
  if (!marked) return false;
  const today = now.toISOString().slice(0, 10);
  return marked.slice(0, 10) === today;
}

/**
 * Returns attendance rate (0–1) over the last LOOKBACK_DAYS days.
 * Returns 1 (passes gate) when there is no scheduled-workout data.
 */
export function attendanceRate(workouts, now = Date.now()) {
  const cutoff = now - LOOKBACK_DAYS * 86400000;
  const recent = workouts.filter(
    w => w.scheduledAt && new Date(w.scheduledAt).getTime() >= cutoff
  );
  if (recent.length === 0) return 1;
  const completed = recent.filter(w => w.completedAt).length;
  return completed / recent.length;
}

/**
 * Returns true if the nudge should be sent for this workout + client.
 * workouts = all workouts for this client (for attendance calc).
 */
export function shouldSendRescueNudge(workout, client, allWorkouts, now = new Date()) {
  if (workout.completedAt)       return false;
  if (workout.rescueNudgeSentAt) return false;
  if (!client.fcmToken)          return false;
  if (isRestDay(client, now))    return false;
  if (attendanceRate(allWorkouts, now.getTime()) < ATTENDANCE_THRESHOLD) return false;
  return true;
}
