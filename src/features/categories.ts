// Categories live in the file (shared plugin data on the document), so every collaborator sees the
// same set. A user's earlier personal set (clientStorage) seeds a file that has none yet.

import type { Category } from '../types';
import { DATA_NAMESPACE } from './data';

const FILE_KEY = 'categories';
const LEGACY_STORAGE_KEY = 'qxr-annotations:categories';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'ux', name: 'UX', color: '8A38F5' },
  { id: 'ui', name: 'UI', color: '0D99FF' },
  { id: 'feedback', name: 'Feedback', color: 'F5A623' },
  { id: 'decision', name: 'Decision', color: 'DF0000' },
];

function isCategory(value: unknown): value is Category {
  const c = value as Partial<Category> | null;
  return !!c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.color === 'string' && /^[0-9A-Fa-f]{6}$/.test(c.color);
}

function readFromFile(): Category[] | null {
  const raw = figma.root.getSharedPluginData(DATA_NAMESPACE, FILE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed.filter(isCategory) : [];
    return list.length ? list : null;
  } catch (_e) {
    return null; // corrupt data: fall back rather than break the plugin
  }
}

export async function loadCategories(): Promise<Category[]> {
  const fromFile = readFromFile();
  if (fromFile) return fromFile;
  const legacy: unknown = await figma.clientStorage.getAsync(LEGACY_STORAGE_KEY);
  const personal = Array.isArray(legacy) ? legacy.filter(isCategory) : [];
  return personal.length ? personal : DEFAULT_CATEGORIES;
}

export async function saveCategories(categories: Category[]): Promise<void> {
  const valid = categories.filter((c) => isCategory(c) && c.name.trim());
  figma.root.setSharedPluginData(DATA_NAMESPACE, FILE_KEY, JSON.stringify(valid.length ? valid : DEFAULT_CATEGORIES));
}

/** Write the category set into the file once, so notes' category ids always resolve for collaborators. */
export async function ensureCategoriesInFile(): Promise<void> {
  if (!readFromFile()) await saveCategories(await loadCategories());
}
