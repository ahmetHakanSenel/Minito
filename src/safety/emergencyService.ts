import { FallbackReason, FallbackMetadata } from './fallbackTaxonomy';

export type PanicStep = {
  id: string;
  title: string;
  body: string;
};

export type PanicKit = {
  reason: FallbackReason.CONTENT_FLAGGED;
  headline: string;
  tone: 'calm' | 'supportive';
  steps: PanicStep[];
  /**
   * Optional extra metadata for logging / analytics only.
   * Never required to render the UI.
   */
  meta?: Omit<FallbackMetadata, 'reason'>;
};
