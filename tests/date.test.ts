import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDate, legacyToDayFirst } from '../src/features/date.ts';

test('formats as DD/MM/YYYY with zero padding', () => {
  assert.equal(formatDate(new Date(2026, 10, 5)), '05/11/2026');
  assert.equal(formatDate(new Date(2026, 0, 31)), '31/01/2026');
});

test('converts a month-first stamp to day-first', () => {
  assert.equal(legacyToDayFirst('11/05/2026'), '05/11/2026'); // ambiguous: taken as month-first
  assert.equal(legacyToDayFirst('11/25/2026'), '25/11/2026'); // unambiguous
  assert.equal(legacyToDayFirst('1/5/2026'), '05/01/2026');
});

test('leaves day-first stamps and non-dates alone', () => {
  assert.equal(legacyToDayFirst('25/11/2026'), null);
  assert.equal(legacyToDayFirst('Yesterday'), null);
  assert.equal(legacyToDayFirst(''), null);
});
