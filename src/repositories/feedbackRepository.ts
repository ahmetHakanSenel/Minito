import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabase } from '../data/supabase/client';

/** The fixed vocabulary of scores; the database rejects anything outside it. */
export const FEEDBACK_SCORES = ['helpful', 'too_large', 'too_small', 'wrong_tone'] as const;

export type FeedbackScore = (typeof FEEDBACK_SCORES)[number];

export type FeedbackRepositoryErrorCode = 'unavailable' | 'unknown';

export class FeedbackRepositoryError extends Error {
  constructor(
    readonly code: FeedbackRepositoryErrorCode,
    readonly original?: unknown
  ) {
    super(`Feedback repository failed: ${code}`);
    this.name = 'FeedbackRepositoryError';
  }
}

// The function does not exist yet, i.e. migration 012 has not been applied.
const MISSING_FUNCTION_CODES = new Set(['PGRST202', '42883']);

function toRepositoryError(error: PostgrestError): FeedbackRepositoryError {
  return new FeedbackRepositoryError(
    MISSING_FUNCTION_CODES.has(error.code) ? 'unavailable' : 'unknown',
    error
  );
}

/**
 * Scores the analytics row of one breakdown request.
 *
 * The `tasks` table is closed to clients, so this goes through a SECURITY DEFINER function that
 * can only write a valid score, and only on a row the caller owns. Resolves false when no such
 * row exists, which happens when the breakdown never reached the server.
 */
async function submit(requestId: string, score: FeedbackScore): Promise<boolean> {
  let client;
  try {
    client = getSupabase();
  } catch (error) {
    throw new FeedbackRepositoryError('unavailable', error);
  }

  const { data, error } = await client.rpc('submit_breakdown_feedback', {
    p_request_id: requestId,
    p_score: score,
  });
  if (error) {
    throw toRepositoryError(error);
  }
  return data === true;
}

export const feedbackRepository = { submit };
