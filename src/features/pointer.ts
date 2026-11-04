// Pure pointer-routing logic (no figma.* calls) so it can be unit tested.
// All coordinates are page coordinates. The pointer ends on the edge of the target that faces the
// card: left/right edges are inset slightly and vertically centred; top/bottom edges are centred.

import type { Direction } from '../types';
import { inferPlacement } from './placement.ts';

export type PointerStyle = 'straight' | 'elbow';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const POINTER_INSET = 4;

/** Where the pointer lands on the target for a card on the given side. */
export function anchorPoint(target: Box, side: Direction): Point {
  const inset = (size: number): number => Math.min(POINTER_INSET, size);
  const midX = target.x + target.width / 2;
  const midY = target.y + target.height / 2;
  switch (side) {
    case 'left':
      return { x: target.x + inset(target.width), y: midY };
    case 'right':
      return { x: target.x + target.width - inset(target.width), y: midY };
    case 'top':
      return { x: midX, y: target.y + inset(target.height) };
    default:
      return { x: midX, y: target.y + target.height - inset(target.height) };
  }
}

export function pointerPoints(style: PointerStyle, note: Box, target: Box): Point[] {
  // The side is read from where the card actually is, so it stays right if the card is dragged.
  const side = inferPlacement(note, target).direction;
  const end = anchorPoint(target, side);
  const cx = note.x + note.width / 2;
  const cy = note.y + note.height / 2;

  if (style === 'straight') return [{ x: cx, y: cy }, end];

  const noteRight = note.x + note.width;
  const noteBottom = note.y + note.height;
  const targetRight = target.x + target.width;
  const targetBottom = target.y + target.height;

  switch (side) {
    case 'left': {
      const midX = (noteRight + target.x) / 2;
      return [{ x: noteRight, y: cy }, { x: midX, y: cy }, { x: midX, y: end.y }, end];
    }
    case 'right': {
      const midX = (targetRight + note.x) / 2;
      return [{ x: note.x, y: cy }, { x: midX, y: cy }, { x: midX, y: end.y }, end];
    }
    case 'top': {
      const midY = (noteBottom + target.y) / 2;
      return [{ x: cx, y: noteBottom }, { x: cx, y: midY }, { x: end.x, y: midY }, end];
    }
    default: {
      const midY = (targetBottom + note.y) / 2;
      return [{ x: cx, y: note.y }, { x: cx, y: midY }, { x: end.x, y: midY }, end];
    }
  }
}

/** SVG path data for a polyline through the points. */
export function toPathData(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}
