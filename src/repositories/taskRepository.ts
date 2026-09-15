import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../data/supabase/client';
import { breakTask } from '../lib/api/breakTask';
import { getOrCreateGuestId } from '../lib/guestIdentity';
import { FallbackReason } from '../safety';

export type TaskBreakdown = {
  id: string;
  title: string;
  empathyBridge: string | null;
  firstStepHook: string | null;
  steps: string[];
  completedStepCount: number;
  completedAt: string | null;
  createdAt: string;
};

export type BreakdownContent = Pick<
  TaskBreakdown,
  'title' | 'empathyBridge' | 'firstStepHook' | 'steps'
>;

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

type TaskBreakdownRow = {
  id: string;
  title: string;
  empathy_bridge: string | null;
  first_step_hook: string | null;
  steps: unknown;
  completed_step_count: number;
  completed_at: string | null;
  created_at: string;
};

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

function toTaskBreakdown(row: TaskBreakdownRow): TaskBreakdown {
  return {
    id: row.id,
    title: row.title,
    empathyBridge: row.empathy_bridge,
    firstStepHook: row.first_step_hook,
    steps: Array.isArray(row.steps)
      ? row.steps.filter((step): step is string => typeof step === 'string')
      : [],
    completedStepCount: row.completed_step_count,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

async function listRecent(limit: number): Promise<TaskBreakdown[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw toRepositoryError(error);
  }
  return ((data ?? []) as TaskBreakdownRow[]).map(toTaskBreakdown);
}

async function save(content: BreakdownContent): Promise<TaskBreakdown> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      title: content.title,
      empathy_bridge: content.empathyBridge,
      first_step_hook: content.firstStepHook,
      steps: content.steps,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    throw toRepositoryError(error);
  }
  return toTaskBreakdown(data as TaskBreakdownRow);
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
    steps: result.steps,
  };
  const isOffline = result.isOfflineFallback === true;

  // Offline fallback steps are generic, so they are not worth keeping in history.
  if (isOffline) {
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
  const { error } = await supabase
    .from(TABLE)
    .update({ completed_step_count: completedStepCount })
    .eq('id', id);
  if (error) {
    throw toRepositoryError(error);
  }
}

async function markCompleted(id: string, totalSteps: number): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ completed_step_count: totalSteps, completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    throw toRepositoryError(error);
  }
}

async function remove(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
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
