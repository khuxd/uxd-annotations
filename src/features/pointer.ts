// Pure pointer-routing logic (no figma.* calls) so it can be unit tested.
// All coordinates are page coordinates. The pointer always ends on the target's
// left edge (inset slightly); elbow routes are axis-aligned and avoid crossing the target.

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
export const ELBOW_MARGIN = 24;

export function anchorPoint(target: Box): Point {
  return { x: target.x + Math.min(POINTER_INSET, target.width), y: target.y + target.height / 2 };
}

export function pointerPoints(style: PointerStyle, note: Box, target: Box): Point[] {
  const end = anchorPoint(target);
  const cx = note.x + note.width / 2;
  const cy = note.y + note.height / 2;

  if (style === 'straight') return [{ x: cx, y: cy }, end];

  const noteRight = note.x + note.width;
  const noteBottom = note.y + note.height;

  // Card fully left of the target: leave its right edge, jog vertically halfway across the gap.
  if (noteRight <= target.x - POINTER_INSET) {
    const midX = (noteRight + target.x) / 2;
    return [{ x: noteRight, y: cy }, { x: midX, y: cy }, { x: midX, y: end.y }, end];
  }

  // Card fully right of the target: go over (or under) the target, then come in from its left side.
  if (note.x >= target.x + target.width) {
    const above = cy <= end.y;
    const laneY = above ? Math.min(note.y, target.y) - ELBOW_MARGIN : Math.max(noteBottom, target.y + target.height) + ELBOW_MARGIN;
    const laneX = target.x - ELBOW_MARGIN;
    const startY = above ? note.y : noteBottom;
    return [{ x: cx, y: startY }, { x: cx, y: laneY }, { x: laneX, y: laneY }, { x: laneX, y: end.y }, end];
  }

  // Card above or below (overlapping horizontally): leave its left edge, run down the left side.
  const laneX = Math.min(note.x, target.x) - ELBOW_MARGIN;
  return [{ x: note.x, y: cy }, { x: laneX, y: cy }, { x: laneX, y: end.y }, end];
}

/** SVG path data for a polyline through the points. */
export function toPathData(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}
