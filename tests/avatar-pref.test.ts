import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseShowAvatar } from '../src/features/avatar-pref.ts';

test('avatar is shown for files saved before the setting existed', () => {
  assert.equal(parseShowAvatar(''), true);
});

test('avatar is shown when stored as 1 and hidden only when stored as 0', () => {
  assert.equal(parseShowAvatar('1'), true);
  assert.equal(parseShowAvatar('0'), false);
});
