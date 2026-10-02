import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { bearerToken, describeError, readJsonBody } from './http.ts';

const withAuth = (value: string) =>
  new Request('https://edge.test', { headers: value ? { Authorization: value } : {} });

Deno.test('bearer tokens are read case-insensitively and malformed headers are refused', () => {
  assertEquals(bearerToken(withAuth('Bearer abc.def')), 'abc.def');
  assertEquals(bearerToken(withAuth('bearer abc.def')), 'abc.def');
  assertEquals(bearerToken(withAuth('BEARER   abc.def ')), 'abc.def');
  assertEquals(bearerToken(withAuth('')), null);
  assertEquals(bearerToken(withAuth('Bearer')), null);
  assertEquals(bearerToken(withAuth('Basic abc')), null);
  assertEquals(bearerToken(withAuth('Bearer two tokens')), null);
});

Deno.test('error summaries carry no stack and stay short', () => {
  const summary = describeError(new RangeError('x'.repeat(1000)));
  assertEquals(summary.startsWith('RangeError: x'), true);
  assertEquals(summary.length, 300);
  assertEquals(describeError({ secret: 'payload' }), 'unknown error');
});

function requestWith(body: BodyInit | null, headers: Record<string, string> = {}): Request {
  return new Request('https://edge.test/', { method: 'POST', body, headers });
}

Deno.test('a body within the limit is parsed', async () => {
  const result = await readJsonBody(requestWith('{"input":"hi"}'), 64);
  assertEquals(result, { ok: true, value: { input: 'hi' } });
});

Deno.test('a declared length over the limit is refused without reading the body', async () => {
  let pulled = false;
  // A stream fills its queue on its own as soon as it exists; a high-water mark of zero stops
  // that, so `pull` runs only if something actually reads.
  const stream = new ReadableStream(
    {
      pull() {
        pulled = true;
      },
    },
    { highWaterMark: 0 }
  );
  const result = await readJsonBody(requestWith(stream, { 'content-length': '999999' }), 64);
  assertEquals(result, { ok: false, reason: 'too_large' });
  assertEquals(pulled, false);
});

// A stream need not declare its length, and can declare less than it sends. The limit has to
// hold while reading, not only against the header.
Deno.test('an undeclared body is cut off as soon as it passes the limit', async () => {
  const chunk = new TextEncoder().encode('x'.repeat(40));
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      sent += 1;
      controller.enqueue(chunk);
      if (sent > 1000) controller.close();
    },
  });
  const result = await readJsonBody(requestWith(stream), 64);
  assertEquals(result, { ok: false, reason: 'too_large' });
  assert(sent < 10, `read ${sent} chunks of a body that was already too large`);
});

Deno.test('a body that is not JSON reads as nothing, for the schema to reject', async () => {
  assertEquals(await readJsonBody(requestWith('not json'), 64), { ok: true, value: undefined });
  assertEquals(await readJsonBody(requestWith(null), 64), { ok: true, value: undefined });
});
