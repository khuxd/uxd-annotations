import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCardPosition, inferPlacement } from '../src/features/placement.ts';

const target = { x: 500, y: 300, width: 200, height: 100 };
const card = { width: 272, height: 150 };

test('left: card sits gap px left of the target, top-aligned', () => {
  assert.deepEqual(computeCardPosition(card, target, 'left', 60), { x: 500 - 272 - 60, y: 300 });
});

test('right: card sits gap px right of the target, top-aligned', () => {
  assert.deepEqual(computeCardPosition(card, target, 'right', 40), { x: 740, y: 300 });
});

test('top and bottom: centred horizontally', () => {
  assert.deepEqual(computeCardPosition(card, target, 'top', 30), { x: 500 + (200 - 272) / 2, y: 300 - 150 - 30 });
  assert.deepEqual(computeCardPosition(card, target, 'bottom', 30), { x: 500 + (200 - 272) / 2, y: 430 });
});

test('inferPlacement round-trips computeCardPosition for every direction', () => {
  for (const direction of ['left', 'right', 'top', 'bottom'] as const) {
    for (const gap of [0, 24, 60, 300]) {
      const pos = computeCardPosition(card, target, direction, gap);
      const inferred = inferPlacement({ ...pos, ...card }, target);
      assert.deepEqual(inferred, { direction, distance: gap }, `${direction} ${gap}`);
    }
  }
});

test('inferPlacement falls back sensibly when the card overlaps the target', () => {
  assert.deepEqual(inferPlacement({ x: 550, y: 320, width: 100, height: 50 }, target), { direction: 'right', distance: 0 });
});
