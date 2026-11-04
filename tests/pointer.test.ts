import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorPoint, pointerPoints, toPathData, POINTER_INSET } from '../src/features/pointer.ts';

const target = { x: 500, y: 300, width: 200, height: 100 };

test('left: anchor is 4px inside the left edge, vertically centred', () => {
  assert.deepEqual(anchorPoint(target, 'left'), { x: 500 + POINTER_INSET, y: 350 });
});

test('right: anchor is 4px inside the right edge, vertically centred', () => {
  assert.deepEqual(anchorPoint(target, 'right'), { x: 700 - POINTER_INSET, y: 350 });
});

test('top and bottom: anchor is horizontally centred', () => {
  assert.equal(anchorPoint(target, 'top').x, 600);
  assert.equal(anchorPoint(target, 'bottom').x, 600);
  assert.equal(anchorPoint(target, 'top').y, 300 + POINTER_INSET);
  assert.equal(anchorPoint(target, 'bottom').y, 400 - POINTER_INSET);
});

test('anchor never leaves a very narrow target', () => {
  assert.equal(anchorPoint({ x: 10, y: 0, width: 2, height: 10 }, 'left').x, 12);
  assert.equal(anchorPoint({ x: 10, y: 0, width: 2, height: 10 }, 'right').x, 10);
});

test('straight pointer runs from card centre to the anchor on the card side', () => {
  const left = { x: 100, y: 100, width: 200, height: 100 };
  assert.deepEqual(pointerPoints('straight', left, target), [{ x: 200, y: 150 }, anchorPoint(target, 'left')]);
  const right = { x: 800, y: 100, width: 200, height: 100 };
  assert.deepEqual(pointerPoints('straight', right, target), [{ x: 900, y: 150 }, anchorPoint(target, 'right')]);
});

test('elbow, card on the left: leaves the card right edge, ends on the left anchor', () => {
  const note = { x: 100, y: 100, width: 200, height: 100 };
  const pts = pointerPoints('elbow', note, target);
  assert.deepEqual(pts[0], { x: 300, y: 150 });
  assert.deepEqual(pts[pts.length - 1], anchorPoint(target, 'left'));
  assertOrthogonal(pts);
});

test('elbow, card on the right: leaves the card left edge, ends on the right anchor', () => {
  const note = { x: 800, y: 100, width: 200, height: 100 };
  const pts = pointerPoints('elbow', note, target);
  assert.deepEqual(pts[0], { x: 800, y: 150 });
  assert.deepEqual(pts[pts.length - 1], anchorPoint(target, 'right'));
  assertOrthogonal(pts);
});

test('elbow, card above: leaves the card bottom, ends on the top anchor', () => {
  const note = { x: 520, y: 100, width: 160, height: 100 };
  const pts = pointerPoints('elbow', note, target);
  assert.deepEqual(pts[0], { x: 600, y: 200 });
  assert.deepEqual(pts[pts.length - 1], anchorPoint(target, 'top'));
  assertOrthogonal(pts);
});

test('elbow, card below: leaves the card top, ends on the bottom anchor', () => {
  const note = { x: 520, y: 600, width: 160, height: 100 };
  const pts = pointerPoints('elbow', note, target);
  assert.deepEqual(pts[0], { x: 600, y: 600 });
  assert.deepEqual(pts[pts.length - 1], anchorPoint(target, 'bottom'));
  assertOrthogonal(pts);
});

test('path data is an M/L polyline', () => {
  assert.equal(toPathData([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 9 }]), 'M 0 0 L 5 0 L 5 9');
});

function assertOrthogonal(pts: { x: number; y: number }[]): void {
  for (let i = 1; i < pts.length; i++) {
    assert.ok(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y, `segment ${i} is not axis-aligned`);
  }
}
