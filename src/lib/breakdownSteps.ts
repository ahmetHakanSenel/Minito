/**
 * The app's model of one micro-step, plus a tolerant reader for every shape a step has ever had.
 *
 * Steps reach the client from four places: the break-task response (snake_case), rows in
 * `task_breakdowns`, the persisted active session and the focus route params. Older rows and
 * sessions stored plain strings, so everything funnels through `normalizeSteps` and nothing
 * downstream ever sees an unvalidated step.
 */

export type StepDifficulty = 'easy' | 'medium' | 'hard';

export type BreakdownStep = {
  id: string;
  title: string;
  /** Empty for legacy and offline steps, which only ever had a title. */
  instruction: string;
  estimatedMinutes: number | null;
  difficulty: StepDifficulty | null;
};

const DIFFICULTIES: readonly StepDifficulty[] = ['easy', 'medium', 'hard'];

function isDifficulty(value: unknown): value is StepDifficulty {
  return DIFFICULTIES.includes(value as StepDifficulty);
}

function readMinutes(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function toStep(raw: unknown, index: number): BreakdownStep | null {
  if (typeof raw === 'string') {
    const title = raw.trim();
    return title
      ? {
          id: `step-${index + 1}`,
          title,
          instruction: '',
          estimatedMinutes: null,
          difficulty: null,
        }
      : null;
  }
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  if (!title) return null;

  return {
    id: typeof record.id === 'string' && record.id ? record.id : `step-${index + 1}`,
    title,
    instruction: typeof record.instruction === 'string' ? record.instruction.trim() : '',
    // Wire and database rows use snake_case; the app's own serialized sessions use camelCase.
    estimatedMinutes: readMinutes(record.estimated_minutes ?? record.estimatedMinutes),
    difficulty: isDifficulty(record.difficulty) ? record.difficulty : null,
  };
}

/** Reads structured, camelCase or legacy string steps, dropping anything unusable. */
export function normalizeSteps(raw: unknown): BreakdownStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toStep).filter((step): step is BreakdownStep => step !== null);
}
