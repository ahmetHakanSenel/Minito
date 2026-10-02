import { readJson, writeJson } from '../storage/jsonStore';

/**
 * Local, file-backed log of completed focus sessions.
 *
 * This is the single source of truth for the Insights screen — analytics are
 * computed from what the user actually did, never from sample data.
 */

const KEY = 'focus-sessions';
const MAX_RECORDS = 2000;

export interface FocusSessionRecord {
  id: string;
  /** Epoch ms when the session ended */
  endedAt: number;
  /** Actual focused duration in seconds */
  durationSec: number;
  /** Phone pickups detected during the session */
  pickupCount: number;
  /** Whether the session ran to completion (vs. abandoned early) */
  completed: boolean;
  /** 'timer' = timed focus session, 'steps' = AI step-flow completion */
  source: 'timer' | 'steps';
  projectId?: string;
  taskId?: string;
  stepsCompleted?: number;
}

// Appending is read, add, write. Two appends that overlapped would each read the same list, and
// the second write would erase the first record without a trace. They are chained instead: each
// starts once the previous one has written. A failed append is not allowed to break the chain.
let lastAppend: Promise<void> = Promise.resolve();

export function recordFocusSession(
  record: Omit<FocusSessionRecord, 'id' | 'endedAt'> & { endedAt?: number }
): Promise<void> {
  const endedAt = record.endedAt ?? Date.now();
  const append = lastAppend.then(async () => {
    const sessions = (await readJson<FocusSessionRecord[]>(KEY)) ?? [];
    sessions.push({
      ...record,
      id: `${endedAt}-${Math.random().toString(36).slice(2, 9)}`,
      endedAt,
    });
    // Cap file size; oldest records rotate out
    await writeJson(KEY, sessions.slice(-MAX_RECORDS));
  });
  lastAppend = append.catch(() => {});
  return append;
}

export async function getFocusSessions(): Promise<FocusSessionRecord[]> {
  const sessions = (await readJson<FocusSessionRecord[]>(KEY)) ?? [];
  return sessions.filter(
    (s) => s && typeof s.endedAt === 'number' && typeof s.durationSec === 'number'
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AGGREGATIONS FOR THE INSIGHTS SCREEN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DAY_MS = 24 * 60 * 60 * 1000;

/** Focus minutes per hour-of-day over the last `windowDays` days */
export function aggregateHourly(
  sessions: FocusSessionRecord[],
  windowDays = 14
): { hour: number; focusMinutes: number }[] {
  const cutoff = Date.now() - windowDays * DAY_MS;
  const byHour = new Array(24).fill(0);
  for (const s of sessions) {
    if (s.endedAt < cutoff) continue;
    const hour = new Date(s.endedAt).getHours();
    byHour[hour] += s.durationSec / 60;
  }
  return byHour.map((minutes, hour) => ({
    hour,
    focusMinutes: Math.round(minutes),
  }));
}

/** Focus minutes per calendar day for the last `days` days (heatmap) */
export function aggregateDaily(
  sessions: FocusSessionRecord[],
  days = 84
): { date: string; focusMinutes: number }[] {
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    const date = new Date(s.endedAt).toISOString().split('T')[0];
    byDate.set(date, (byDate.get(date) ?? 0) + s.durationSec / 60);
  }
  const result: { date: string; focusMinutes: number }[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const date = d.toISOString().split('T')[0];
    result.push({ date, focusMinutes: Math.round(byDate.get(date) ?? 0) });
  }
  return result;
}

/** Focus minutes per project over the last `windowDays` days */
export function aggregateByProject(
  sessions: FocusSessionRecord[],
  windowDays = 30
): Map<string, number> {
  const cutoff = Date.now() - windowDays * DAY_MS;
  const byProject = new Map<string, number>();
  for (const s of sessions) {
    if (s.endedAt < cutoff || !s.projectId) continue;
    byProject.set(s.projectId, (byProject.get(s.projectId) ?? 0) + s.durationSec / 60);
  }
  return byProject;
}

/**
 * Flow metrics from real behavior over the last `windowDays` days.
 * Returns zeros when there's no data — the orb then honestly shows 'idle'.
 */
export function computeFlowMetrics(
  sessions: FocusSessionRecord[],
  windowDays = 7
): { focusQuality: number; distractionLevel: number } {
  const cutoff = Date.now() - windowDays * DAY_MS;
  const recent = sessions.filter((s) => s.endedAt >= cutoff && s.source === 'timer');

  if (recent.length === 0) {
    return { focusQuality: 0, distractionLevel: 0 };
  }

  const totalMinutes = recent.reduce((sum, s) => sum + s.durationSec / 60, 0);
  const avgMinutes = totalMinutes / recent.length;
  const completionRate = recent.filter((s) => s.completed).length / recent.length;

  // Quality: average session length (25 min = full marks) + completion rate
  const focusQuality = Math.min(
    100,
    Math.round(Math.min(avgMinutes / 25, 1) * 70 + completionRate * 30)
  );

  // Distraction: pickups normalized per 25 focused minutes
  const totalPickups = recent.reduce((sum, s) => sum + (s.pickupCount ?? 0), 0);
  const pickupsPer25 = totalMinutes > 0 ? (totalPickups / totalMinutes) * 25 : 0;
  const distractionLevel = Math.min(100, Math.round(pickupsPer25 * 25));

  return { focusQuality, distractionLevel };
}
