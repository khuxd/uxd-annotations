import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_FREE_NOTE_TEXT, parseNoteDrop } from '../src/features/drop.ts';

test('accepts a note drop and trims its text', () => {
  assert.deepEqual(parseNoteDrop({ kind: 'qxr-note', text: '  hello ', categoryId: 'c1' }), { text: 'hello', categoryId: 'c1' });
});

test('falls back to default text when none is given', () => {
  assert.equal(parseNoteDrop({ kind: 'qxr-note', text: '   ', categoryId: 'c1' })?.text, DEFAULT_FREE_NOTE_TEXT);
  assert.equal(parseNoteDrop({ kind: 'qxr-note', categoryId: 'c1' })?.text, DEFAULT_FREE_NOTE_TEXT);
});

test('rejects drops that are not ours or are malformed', () => {
  assert.equal(parseNoteDrop(undefined), null);
  assert.equal(parseNoteDrop('qxr-note'), null);
  assert.equal(parseNoteDrop({ kind: 'other', categoryId: 'c1' }), null);
  assert.equal(parseNoteDrop({ kind: 'qxr-note', categoryId: 5 }), null);
});
