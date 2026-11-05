// A note dragged from the panel onto the canvas arrives as a Figma "drop" event whose dropMetadata is
// whatever the panel put there. It is untrusted input, so it is checked here before anything is built.

export const DROP_KIND = 'qxr-note';
export const DEFAULT_FREE_NOTE_TEXT = 'New note';
const MAX_TEXT = 2000;

export interface NoteDrop {
  text: string;
  categoryId: string;
}

export function parseNoteDrop(meta: unknown): NoteDrop | null {
  if (typeof meta !== 'object' || meta === null) return null;
  const m = meta as Record<string, unknown>;
  if (m.kind !== DROP_KIND || typeof m.categoryId !== 'string') return null;
  const text = typeof m.text === 'string' ? m.text.trim().slice(0, MAX_TEXT) : '';
  return { text: text || DEFAULT_FREE_NOTE_TEXT, categoryId: m.categoryId };
}
