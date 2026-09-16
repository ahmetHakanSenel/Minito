/**
 * Content moderation, kept apart from the handler so its timeout and fail-open policy can be
 * tested without a network.
 */

/** checked: false means the verdict is a default, because moderation could not run. */
export type ModerationVerdict = { flagged: boolean; checked: boolean; reason?: string };

export type Moderator = (input: string) => Promise<ModerationVerdict>;

export const MODERATION_MODEL = 'omni-moderation-latest';

// Moderation runs in parallel with the quota check, but the AI budget starts counting at the same
// moment. A slow moderation call must not quietly eat the time the model needs.
const MODERATION_TIMEOUT_MS = 3_000;

/**
 * OpenAI's moderation endpoint. It fails open: a person who is stuck should not be blocked
 * because a safety service is slow. Every skipped check is reported through `checked: false`, so
 * the handler can log it and the fail-open rate stays observable.
 */
export function openAiModerator(
  apiKey: string,
  options: { timeoutMs?: number; fetchFn?: typeof fetch } = {}
): Moderator {
  const { timeoutMs = MODERATION_TIMEOUT_MS, fetchFn = fetch } = options;

  return async (input) => {
    try {
      const response = await fetchFn('https://api.openai.com/v1/moderations', {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODERATION_MODEL, input }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return { flagged: false, checked: false, reason: `http_${response.status}` };
      }
      const data = await response.json();
      const flagged = data.results?.[0]?.flagged;
      if (typeof flagged !== 'boolean') {
        return { flagged: false, checked: false, reason: 'malformed_response' };
      }
      return { flagged, checked: true };
    } catch (error) {
      const reason =
        error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network';
      return { flagged: false, checked: false, reason };
    }
  };
}
