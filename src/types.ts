// ============================================================================
// UXD Annotations — Shared Types
// ============================================================================

export type NoteStatus = 'todo' | 'done';

export type PointerStyle = 'straight' | 'elbow';

export interface BuildTableOptions {
  scope: 'all-pages' | 'this-page';
  destination: 'summary-page' | 'current-page';
}

export type Direction = 'right' | 'left' | 'top' | 'bottom';

export interface Category {
  id: string;
  name: string;
  /** Hex without '#', e.g. "DF0000" */
  color: string;
}

export interface NoteSummary {
  id: string;
  text: string;
  /** DD/MM/YYYY the note was created, or '' if the card has no date layer. */
  date: string;
  categoryId: string;
  status: NoteStatus;
  targetId: string;
  targetName: string;
  frameName: string;
  /** Auto-layout direction of the top-level frame: 'row', 'column', or '' when it has none. */
  frameLayout: 'row' | 'column' | '';
  pageName: string;
  pointerStyle: PointerStyle;
  direction: Direction;
  distance: number;
}

// ── Messages: UI → Plugin ────────────────────────────────────────────────────

export type PluginMessage =
  | { type: 'init' }
  | { type: 'add-note'; text: string; categoryId: string; direction: Direction; distance: number; pointerStyle: PointerStyle }
  | { type: 'set-status'; noteId: string; status: NoteStatus }
  | { type: 'goto-note'; noteId: string }
  | { type: 'attach-note'; noteId: string }
  | { type: 'delete-note'; noteId: string }
  | { type: 'save-distance'; distance: number }
  | { type: 'save-pointer-style'; pointerStyle: PointerStyle }
  | { type: 'set-show-avatar'; show: boolean }
  | { type: 'place-free-note'; text: string; categoryId: string }
  | { type: 'set-note-category'; noteId: string; categoryId: string }
  | { type: 'set-note-placement'; noteId: string; direction: Direction; distance: number }
  | { type: 'set-note-pointer-style'; noteId: string; pointerStyle: PointerStyle }
  | { type: 'save-categories'; categories: Category[] }
  | { type: 'build-table'; options: BuildTableOptions }
  | { type: 'resync' }
  | { type: 'close' };

// ── Messages: Plugin → UI ────────────────────────────────────────────────────

export type UIMessage =
  | { type: 'state'; categories: Category[]; notes: NoteSummary[]; tables: { summaryPage: boolean; currentPage: boolean }; selectionCount: number; selection?: { name: string; type: string }; distance: number; pointerStyle: PointerStyle; showAvatar: boolean }
  | { type: 'progress'; percent: number; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };
