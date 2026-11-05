import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseInTable } from '../src/features/table-pref.ts';

test('a note with no stored setting (made by an earlier version) stays in the table', () => {
  assert.equal(parseInTable(''), true);
});

test('only an explicit 0 leaves a note out of the table', () => {
  assert.equal(parseInTable('1'), true);
  assert.equal(parseInTable('0'), false);
});
