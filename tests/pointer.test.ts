import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorPoint, pointerPoints, toPathData, POINTER_INSET } from '../src/features/pointer.ts';

const target = { x: 500, y: 300, width: 200, height: 100 };

test('anchor is on the left edge, inset, vertically centred', () => {
  assert.deepEqual(anchorPoint(target), { x: 500 + POINTER_INSET, y: 350 });
});

test('anchor never leaves a very narrow target', () => {
  assert.equal(anchorPoint({ x: 10, y: 0, width: 2, height: 10 }).x, 12);
});

test('straight pointer runs from card centre to anchor', () => {
  const note = { x: 100, y: 100, width: 200, height: 100 };
  assert.deepEqual(pointerPoints('straight', note, target), [{ x: 200, y: 150 }, { x: 504, y: 350 }]);
});

test('elbow, card left of target: three right-angle segments ending at anchor', () => {
  const note = { x: 100, y: 100, width: 200, height: 100 };
  const pts = pointerPoints('elbow', note, target);
  assert.equal(pts.length, 4);
  assert.deepEqual(pts[0], { x: 300, y: 150 });
  assert.deepEqual(pts[3], anchorPoint(target));
  assertOrthogonal(pts);
});

test('elbow, card right of target: routes over the target, never through it', () => {
  const note = { x: 800, y: 100, width: 200, height: 100 };
  const pts = pointerPoints('elbow', note, target);
  assertOrthogonal(pts);
  assert.deepEqual(pts[pts.length - 1], anchorPoint(target));
  // the long horizontal lane must sit above the target's top edge
  assert.ok(pts[1].y < target.y);
});

test('elbow, card right and below the target: routes under it', () => {
  const note = { x: 800, y: 600, width: 200, height: 100 };
  const pts = pointerPoints('elbow', note, target);
  assertOrthogonal(pts);
  assert.ok(pts[1].y > target.y + target.height);
});

test('elbow, card above target: runs down the left side', () => {
  const note = { x: 520, y: 100, width: 160, height: 100 };
  const pts = pointerPoints('elbow', note, target);
  assertOrthogonal(pts);
  assert.ok(pts[1].x < note.x && pts[1].x < target.x);
});

test('path data is an M/L polyline', () => {
  assert.equal(toPathData([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 9 }]), 'M 0 0 L 5 0 L 5 9');
});

function assertOrthogonal(pts: { x: number; y: number }[]): void {
  for (let i = 1; i < pts.length; i++) {
    assert.ok(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y, `segment ${i} is not axis-aligned`);
  }
}
