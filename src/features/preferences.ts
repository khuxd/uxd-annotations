// User preferences persisted across sessions and files via figma.clientStorage.

import type { PointerStyle } from '../types';

const STYLE_KEY = 'qxr-annotations:pointer-style';
const DISTANCE_KEY = 'qxr-annotations:distance';
export const DEFAULT_NOTE_DISTANCE = 60;
export const MAX_NOTE_DISTANCE = 2000;

export function clampDistance(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_NOTE_DISTANCE;
  return Math.min(Math.max(Math.round(value), 0), MAX_NOTE_DISTANCE);
}

export async function loadDistance(): Promise<number> {
  const stored: unknown = await figma.clientStorage.getAsync(DISTANCE_KEY);
  return typeof stored === 'number' ? clampDistance(stored) : DEFAULT_NOTE_DISTANCE;
}

export async function saveDistance(value: number): Promise<number> {
  const distance = clampDistance(value);
  await figma.clientStorage.setAsync(DISTANCE_KEY, distance);
  return distance;
}

export async function loadPointerStyle(): Promise<PointerStyle> {
  const stored: unknown = await figma.clientStorage.getAsync(STYLE_KEY);
  return stored === 'straight' ? 'straight' : 'elbow';
}

export async function savePointerStyle(style: PointerStyle): Promise<void> {
  await figma.clientStorage.setAsync(STYLE_KEY, style === 'straight' ? 'straight' : 'elbow');
}
