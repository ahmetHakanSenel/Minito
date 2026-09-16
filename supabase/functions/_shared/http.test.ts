import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { bearerToken, describeError } from './http.ts';

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
