// Categories persist across files via figma.clientStorage.

import type { Category } from '../types';

const STORAGE_KEY = 'qxr-annotations:categories';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'ux', name: 'UX', color: '8A38F5' },
  { id: 'ui', name: 'UI', color: '0D99FF' },
  { id: 'feedback', name: 'Feedback', color: 'F5A623' },
  { id: 'decision', name: 'Decision', color: 'DF0000' },
];

export async function loadCategories(): Promise<Category[]> {
  const stored: unknown = await figma.clientStorage.getAsync(STORAGE_KEY);
  if (Array.isArray(stored) && stored.length > 0) return stored as Category[];
  return DEFAULT_CATEGORIES;
}

export async function saveCategories(categories: Category[]): Promise<void> {
  const valid = categories.filter((c) => c.id && c.name.trim() && /^[0-9A-Fa-f]{6}$/.test(c.color));
  await figma.clientStorage.setAsync(STORAGE_KEY, valid.length ? valid : DEFAULT_CATEGORIES);
}
