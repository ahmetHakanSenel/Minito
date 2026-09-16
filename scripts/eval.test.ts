import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { percentile } from './eval.ts';

Deno.test('percentiles use the nearest rank, so p95 of 20 samples is not the maximum', () => {
  const twenty = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
  assertEquals(percentile(twenty, 50), 1000);
  assertEquals(percentile(twenty, 95), 1900);
  assertEquals(percentile(twenty, 100), 2000);
  assertEquals(percentile([7], 95), 7);
  assertEquals(percentile([], 95), 0);
});
