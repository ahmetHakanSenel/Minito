import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabase } from '../data/supabase/client';
import type { Tables } from '../data/supabase/database.types';
import { breakTask } from '../lib/api/breakTask';
import { normalizeSteps, type BreakdownStep } from '../lib/breakdownSteps';
import { getOrCreateGuestId } from '../lib/guestIdentity';
import { FallbackReason } from '../safety';

export type TaskBreakdown = {
  id: string;
  title: string;
  empathyBridge: string | null;
  firstStepHook: string | null;
  steps: BreakdownStep[];
  completedStepCount: number;
  completedAt: string | null;
  createdAt: string;
};

export type BreakdownContent = Pick<
  TaskBreakdown,
  'title' | 'empathyBridge' | 'firstStepHook' | 'steps'
> & {
  /** Only fresh breakdowns carry one; history rows do not store it. */
  stoppingPoint?: string | null;
};

export type BreakdownOutcome =
  | { status: 'ready'; content: BreakdownContent; saved: TaskBreakdown | null; isOffline: boolean }
  | { status: 'flagged' }
  | { status: 'failed'; reason: FallbackReason };

export type TaskRepositoryErrorCode = 'unavailable' | 'unknown';

export class TaskRepositoryError extends Error {
  constructor(
    readonly code: TaskRepositoryErrorCode,
    readonly original?: unknown
  ) {
    super(`Task repository failed: ${code}`);
    this.name = 'TaskRepositoryError';
  }
}

type TaskBreakdownRow = Pick<
  Tables<'task_breakdowns'>,
  | 'id'
  | 'title'
  | 'empathy_bridge'
  | 'first_step_hook'
  | 'steps'
  | 'completed_step_count'
  | 'completed_at'
  | 'created_at'
>;

const TABLE = 'task_breakdowns';
const COLUMNS =
  'id, title, empathy_bridge, first_step_hook, steps, completed_step_count, completed_at, created_at';

// The table does not exist yet, i.e. the migration has not been applied.
const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01']);

function toRepositoryError(error: PostgrestError): TaskRepositoryError {
  return new TaskRepositoryError(
    MISSING_TABLE_CODES.has(error.code) ? 'unavailable' : 'unknown',
    error
  );
}

// A missing backend configuration degrades to the same "no history" state as a missing table.
function table() {
  try {
    return getSupabase().from(TABLE);
  } catch (error) {
    throw new TaskRepositoryError('unavailable', error);
  }
}

// Rows use the edge function's snake_case step shape, so one reader handles rows and responses.
function toStepRows(steps: BreakdownStep[]) {
  return steps.map((step) => ({
    id: step.id,
    title: step.title,
    instruction: step.instruction,
    estimated_minutes: step.estimatedMinutes,
    difficulty: step.difficulty,
  }));
}

function toTaskBreakdown(row: TaskBreakdownRow): TaskBreakdown {
  return {
    id: row.id,
    title: row.title,
    empathyBridge: row.empathy_bridge,
    firstStepHook: row.first_step_hook,
    // Rows saved before structured output hold plain strings; they are upgraded on read.
    steps: normalizeSteps(row.steps),
    completedStepCount: row.completed_step_count,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

async function listRecent(limit: number): Promise<TaskBreakdown[]> {
  const { data, error } = await table()
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw toRepositoryError(error);
  }
  return (data ?? []).map(toTaskBreakdown);
}

async function save(content: BreakdownContent): Promise<TaskBreakdown> {
  const { data, error } = await table()
    .insert({
      title: content.title,
      empathy_bridge: content.empathyBridge,
      first_step_hook: content.firstStepHook,
      steps: toStepRows(content.steps),
    })
    .select(COLUMNS)
    .single();
  if (error) {
    throw toRepositoryError(error);
  }
  return toTaskBreakdown(data);
}

async function breakDown(input: string): Promise<BreakdownOutcome> {
  const title = input.trim();
  const result = await breakTask(title, await getOrCreateGuestId());

  if (!result.success) {
    return result.fallbackReason === FallbackReason.CONTENT_FLAGGED
      ? { status: 'flagged' }
      : { status: 'failed', reason: result.fallbackReason };
  }

  const content: BreakdownContent = {
    title,
    empathyBridge: result.empathyBridge ?? null,
    firstStepHook: result.firstStepHook ?? null,
    stoppingPoint: result.stoppingPoint ?? null,
    steps: result.steps,
  };
  const isOffline = result.source === 'offline';

  // Offline steps and the server's deterministic fallback are generic, so they are not worth
  // keeping in history.
  if (isOffline || result.source === 'fallback') {
    return { status: 'ready', content, saved: null, isOffline };
  }

  // History is a convenience: a failed save must never stop the user from starting.
  try {
    return { status: 'ready', content, saved: await save(content), isOffline };
  } catch (error) {
    console.warn('Failed to save task breakdown:', error);
    return { status: 'ready', content, saved: null, isOffline };
  }
}

async function recordProgress(id: string, completedStepCount: number): Promise<void> {
  const { error } = await table().update({ completed_step_count: completedStepCount }).eq('id', id);
  if (error) {
    throw toRepositoryError(error);
  }
}

async function markCompleted(id: string, totalSteps: number): Promise<void> {
  const { error } = await table()
    .update({ completed_step_count: totalSteps, completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    throw toRepositoryError(error);
  }
}

async function remove(id: string): Promise<void> {
  const { error } = await table().delete().eq('id', id);
  if (error) {
    throw toRepositoryError(error);
  }
}

export const taskRepository = {
  listRecent,
  breakDown,
  recordProgress,
  markCompleted,
  remove,
};
