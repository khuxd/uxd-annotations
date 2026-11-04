// Defaults for new notes (distance, pointer style), stored in the file so each file remembers its own
// and collaborators share them. A user's earlier personal values (clientStorage) only seed a file
// that has none yet.

import type { PointerStyle } from '../types';
import { DATA_NAMESPACE } from './data';

const DISTANCE_KEY = 'distance';
const STYLE_KEY = 'pointerStyle';
const LEGACY_DISTANCE_KEY = 'qxr-annotations:distance';
const LEGACY_STYLE_KEY = 'qxr-annotations:pointer-style';

export const DEFAULT_NOTE_DISTANCE = 60;
export const MAX_NOTE_DISTANCE = 2000;

export function clampDistance(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_NOTE_DISTANCE;
  return Math.min(Math.max(Math.round(value), 0), MAX_NOTE_DISTANCE);
}

export async function loadDistance(): Promise<number> {
  const fromFile = figma.root.getSharedPluginData(DATA_NAMESPACE, DISTANCE_KEY);
  if (fromFile !== '' && Number.isFinite(Number(fromFile))) return clampDistance(Number(fromFile));
  const legacy: unknown = await figma.clientStorage.getAsync(LEGACY_DISTANCE_KEY);
  return typeof legacy === 'number' ? clampDistance(legacy) : DEFAULT_NOTE_DISTANCE;
}

export async function saveDistance(value: number): Promise<number> {
  const distance = clampDistance(value);
  figma.root.setSharedPluginData(DATA_NAMESPACE, DISTANCE_KEY, String(distance));
  return distance;
}

export async function loadPointerStyle(): Promise<PointerStyle> {
  const fromFile = figma.root.getSharedPluginData(DATA_NAMESPACE, STYLE_KEY);
  if (fromFile === 'straight' || fromFile === 'elbow') return fromFile;
  const legacy: unknown = await figma.clientStorage.getAsync(LEGACY_STYLE_KEY);
  return legacy === 'straight' ? 'straight' : 'elbow';
}

export async function savePointerStyle(style: PointerStyle): Promise<void> {
  figma.root.setSharedPluginData(DATA_NAMESPACE, STYLE_KEY, style === 'straight' ? 'straight' : 'elbow');
}
