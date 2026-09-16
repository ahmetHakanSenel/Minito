import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { MODERATION_MODEL, openAiModerator } from './moderation.ts';

function fakeFetch(respond: (init: RequestInit) => Promise<Response>) {
  const bodies: unknown[] = [];
  const fetchFn = ((_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return respond(init ?? {});
  }) as typeof fetch;
  return { fetchFn, bodies };
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

Deno.test('a flagged verdict is passed through, with the model pinned', async () => {
  const { fetchFn, bodies } = fakeFetch(() => json({ results: [{ flagged: true }] }));
  const verdict = await openAiModerator('key', { fetchFn })('some text');

  assertEquals(verdict, { flagged: true, checked: true });
  assertEquals(bodies, [{ model: MODERATION_MODEL, input: 'some text' }]);
});

Deno.test('an HTTP error fails open and says so', async () => {
  const { fetchFn } = fakeFetch(() => json({ error: 'quota' }, 429));
  assertEquals(await openAiModerator('key', { fetchFn })('text'), {
    flagged: false,
    checked: false,
    reason: 'http_429',
  });
});

Deno.test('a malformed reply is not mistaken for a clean verdict', async () => {
  const { fetchFn } = fakeFetch(() => json({ results: [] }));
  assertEquals((await openAiModerator('key', { fetchFn })('text')).reason, 'malformed_response');
});

Deno.test('a hanging moderation call is cut off by its own timeout', async () => {
  const { fetchFn } = fakeFetch(
    (init) =>
      new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })
  );
  const startedAt = Date.now();
  const verdict = await openAiModerator('key', { fetchFn, timeoutMs: 50 })('text');

  assertEquals(verdict, { flagged: false, checked: false, reason: 'timeout' });
  assertEquals(Date.now() - startedAt < 1000, true);
});

Deno.test('a network failure fails open and says so', async () => {
  const { fetchFn } = fakeFetch(() => Promise.reject(new TypeError('dns failure')));
  assertEquals((await openAiModerator('key', { fetchFn })('text')).reason, 'network');
});
