/**
 * Content moderation, kept apart from the handler so its timeout and fail-open policy can be
 * tested without a network.
 */

/**
 * checked: false means the verdict is a default, because moderation could not run.
 *
 * selfHarm separates the one kind of flag that calls for crisis support from every other kind.
 * The endpoint's `flagged` is true for hate, harassment, violence, sexual content and more, and
 * treating all of them as a crisis showed "you are not alone, reach out to a support line" to
 * someone who had only written that they hated a coworker. Absent when the categories could not
 * be read, in which case the caller must assume the worst.
 */
export type ModerationVerdict = {
  flagged: boolean;
  checked: boolean;
  selfHarm?: boolean;
  reason?: string;
};

// The endpoint's self-harm categories: the person, the intent, and instructions for it.
const SELF_HARM_CATEGORIES = ['self-harm', 'self-harm/intent', 'self-harm/instructions'];

function selfHarmOf(categories: unknown): boolean | undefined {
  if (typeof categories !== 'object' || categories === null) return undefined;
  const flags = categories as Record<string, unknown>;
  return SELF_HARM_CATEGORIES.some((category) => flags[category] === true);
}

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
      const result = data.results?.[0];
      const flagged = result?.flagged;
      if (typeof flagged !== 'boolean') {
        return { flagged: false, checked: false, reason: 'malformed_response' };
      }
      return { flagged, checked: true, selfHarm: selfHarmOf(result.categories) };
    } catch (error) {
      const reason =
        error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network';
      return { flagged: false, checked: false, reason };
    }
  };
}
