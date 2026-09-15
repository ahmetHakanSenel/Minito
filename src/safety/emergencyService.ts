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

/**
 * Static, non‑judgmental emergency steps for when content is flagged.
 * This is intentionally offline‑safe and does NOT depend on network calls.
 */
export function getContentFlaggedPanicKit(options?: {
  traceId?: string;
  rawMessage?: string;
}): PanicKit {
  const steps: PanicStep[] = [
    {
      id: 'pause',
      title: 'Biraz durup nefes alalım',
      body:
        'Şu an hissettiğin şeyler geçerli ve önemli. Derin bir nefes al, ' +
        '4 saniye boyunca nefes al, 4 saniye tut, 4 saniyede ver. Bunu 3 kez tekrarla.',
    },
    {
      id: 'grounding',
      title: 'Etrafına dikkatini getir',
      body:
        'Bulunduğun ortamda görebildiğin 5 şeyi, dokunabildiğin 4 şeyi, ' +
        'duyabildiğin 3 sesi, koklayabildiğin 2 şeyi ve minnettar olduğun 1 şeyi fark etmeye çalış.',
    },
    {
      id: 'support',
      title: 'Yalnız değilsin',
      body:
        'Güvendiğin bir arkadaşın, aile üyen ya da profesyonel bir destek hattı varsa, ' +
        'onlarla iletişime geçmeyi düşünebilirsin. İhtiyaç duyduğunda yardım istemek güçsüzlük değil, güç göstergesidir.',
    },
  ];

  const meta: PanicKit['meta'] = {
    message:
      'Request content was flagged by safety filters. User was shown static panic kit steps.',
    details: {
      traceId: options?.traceId,
      // We never surface rawMessage to the user; it is only for potential logging.
      hasRawMessage: Boolean(options?.rawMessage),
    },
  };

  return {
    reason: FallbackReason.CONTENT_FLAGGED,
    headline: 'Bu içeriği güvenlik nedeniyle gösteremiyoruz',
    tone: 'calm',
    steps,
    meta,
  };
}
