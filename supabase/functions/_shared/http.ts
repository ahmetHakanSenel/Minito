/**
 * HTTP helpers shared by every edge function, so CORS, JSON replies and bearer parsing behave the
 * same everywhere instead of drifting apart in copy-pasted handlers.
 */

const BASE_ALLOWED_HEADERS = ['authorization', 'x-client-info', 'apikey', 'content-type'];

export function corsHeaders(
  methods: string[],
  extraHeaders: string[] = []
): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': [...methods, 'OPTIONS'].join(', '),
    'Access-Control-Allow-Headers': [...BASE_ALLOWED_HEADERS, ...extraHeaders].join(', '),
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

/**
 * Answers the preflight and rejects methods the function does not serve.
 * Resolves null when the request should be handled.
 */
export function guardMethod(
  req: Request,
  methods: string[],
  cors: Record<string, string>
): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (!methods.includes(req.method)) {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, {
      ...cors,
      Allow: [...methods, 'OPTIONS'].join(', '),
    });
  }
  return null;
}

/** The bearer token, or null. The scheme is case-insensitive (RFC 9110). */
export function bearerToken(req: Request): string | null {
  const match = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : null;
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required secret: ${name}`);
  }
  return value;
}

/** An error's name and message, without a stack or any attached payload. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 300);
  return typeof error === 'string' ? error.slice(0, 300) : 'unknown error';
}
