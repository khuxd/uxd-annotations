// Pure card-placement logic (no figma.* calls) so it can be unit tested.

import type { Direction } from '../types';
import type { Box, Point } from './pointer';

/** Where the top-left of a card goes so it sits `gap` px from the target on the chosen side.
 *  Left/right cards are top-aligned to the target; top/bottom cards are centred horizontally. */
export function computeCardPosition(card: { width: number; height: number }, target: Box, direction: Direction, gap: number): Point {
  switch (direction) {
    case 'left':
      return { x: target.x - card.width - gap, y: target.y };
    case 'top':
      return { x: target.x + (target.width - card.width) / 2, y: target.y - card.height - gap };
    case 'bottom':
      return { x: target.x + (target.width - card.width) / 2, y: target.y + target.height + gap };
    default:
      return { x: target.x + target.width + gap, y: target.y };
  }
}

/** Work out which side a card is on, and how far from the target, from where it actually sits. */
export function inferPlacement(card: Box, target: Box): { direction: Direction; distance: number } {
  const cardRight = card.x + card.width;
  const cardBottom = card.y + card.height;
  const targetRight = target.x + target.width;
  const targetBottom = target.y + target.height;
  const round = (n: number): number => Math.max(0, Math.round(n));

  if (cardRight <= target.x) return { direction: 'left', distance: round(target.x - cardRight) };
  if (card.x >= targetRight) return { direction: 'right', distance: round(card.x - targetRight) };
  if (cardBottom <= target.y) return { direction: 'top', distance: round(target.y - cardBottom) };
  if (card.y >= targetBottom) return { direction: 'bottom', distance: round(card.y - targetBottom) };
  return { direction: 'right', distance: 0 }; // overlapping the target
}
