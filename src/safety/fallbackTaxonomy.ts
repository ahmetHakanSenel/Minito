export enum FallbackReason {
  AI_DOWN = 'AI_DOWN',
  MOD_DOWN = 'MOD_DOWN',
  DB_DOWN = 'DB_DOWN',
  RATE_DOWN = 'RATE_DOWN',
  VALIDATION = 'VALIDATION',
  CONTENT_FLAGGED = 'CONTENT_FLAGGED',
  USER_LIMIT = 'USER_LIMIT',
}

/**
 * Human‑readable labels for each fallback reason.
 * Pure logic; UI can choose how to render these.
 */
export const FallbackReasonLabels: Record<FallbackReason, string> = {
  [FallbackReason.AI_DOWN]: 'AI service is temporarily unavailable',
  [FallbackReason.MOD_DOWN]: 'Safety / moderation service is temporarily unavailable',
  [FallbackReason.DB_DOWN]: 'Database is temporarily unavailable',
  [FallbackReason.RATE_DOWN]: 'Too many requests; rate limiting is active',
  [FallbackReason.VALIDATION]: 'There was an issue validating your request',
  [FallbackReason.CONTENT_FLAGGED]: 'Content flagged by safety filters',
  [FallbackReason.USER_LIMIT]: 'You have reached the current usage limit',
};

export type FallbackMetadata = {
  reason: FallbackReason;
  message: string;
  /**
   * Optional machine‑readable details (e.g. trace ID, HTTP status)
   * for logging / telemetry. Never shown directly to the user.
   */
  details?: Record<string, unknown>;
};
