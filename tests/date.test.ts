import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDate } from '../src/features/date.ts';

test('formats as DD/MM/YYYY with zero padding', () => {
  assert.equal(formatDate(new Date(2026, 10, 5)), '05/11/2026');
  assert.equal(formatDate(new Date(2026, 0, 31)), '31/01/2026');
});
