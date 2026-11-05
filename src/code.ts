// ============================================================================
// UXD Annotations — Plugin Entry Point & Message Router
// ============================================================================

import type { PluginMessage } from './types';
import { sendToUI } from './utils';
import { loadCategories, saveCategories } from './features/categories';
import { addNote, attachNote, deleteNote, getNotes, gotoNote, KEY, removeNotesWithMissingTargets, removeOrphanPointers, resync, setNoteCategory, setNotePlacement, setNotePointerStyle, setStatus, summariseNotes, CONTAINER_NAME } from './features/notes';
import { loadDistance, loadPointerStyle, saveDistance, savePointerStyle } from './features/preferences';
import { getData, setData } from './features/data';
import { buildTable, refreshTables, tableState } from './features/table';

figma.showUI(__html__, { width: 360, height: 560, title: 'UXD Annotations', themeColors: true });

// Keep any existing summary table in step with the notes. Debounced so typing doesn't rebuild per keystroke.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshingTables = false;
function scheduleTableRefresh(): void {
  if (refreshTimer !== null) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    refreshTimer = null;
    if (refreshingTables) return;
    refreshingTables = true;
    try {
      await refreshTables();
    } catch (err) {
      sendToUI({ type: 'error', message: err instanceof Error ? `Table not refreshed: ${err.message}` : 'Table not refreshed.' });
    } finally {
      refreshingTables = false;
    }
  }, 400);
}

function isInside(node: BaseNode, ancestor: BaseNode): boolean {
  for (let p = node.parent; p; p = p.parent) if (p === ancestor) return true;
  return false;
}

async function pushState(): Promise<void> {
  const current = figma.currentPage.findChild((n) => n.name === CONTAINER_NAME) as FrameNode | null;
  knownNoteIds = current ? noteIds(current) : '';
  if (tableNoteIds === null) tableNoteIds = knownNoteIds;
  sendToUI({
    type: 'state',
    categories: await loadCategories(),
    notes: await summariseNotes(),
    tables: await tableState(),
    selectionCount: figma.currentPage.selection.length,
    distance: await loadDistance(),
    pointerStyle: await loadPointerStyle(),
  });
}

// Text edited on the canvas is applied when the note is deselected (blur), not on every keystroke.
const editedNoteIds = new Set<string>();

function noteFrameOf(node: BaseNode, container: FrameNode): FrameNode | null {
  for (let n: BaseNode | null = node; n && n.parent; n = n.parent) {
    if (n.parent === container && n.type === 'FRAME') return n;
  }
  return null;
}

/** Notes with unsaved canvas edits that are no longer selected (or inside the selection). */
function flushEditedNotes(): boolean {
  if (editedNoteIds.size === 0) return false;
  const container = figma.currentPage.findChild((n) => n.name === CONTAINER_NAME) as FrameNode | null;
  const stillActive = new Set<string>();
  if (container) {
    for (const node of figma.currentPage.selection) {
      const note = noteFrameOf(node, container);
      if (note) stillActive.add(note.id);
    }
  }
  let flushed = false;
  for (const id of Array.from(editedNoteIds)) {
    if (stillActive.has(id)) continue;
    editedNoteIds.delete(id);
    flushed = true;
  }
  return flushed;
}

figma.on('selectionchange', () => {
  void pushState();
  if (flushEditedNotes()) scheduleTableRefresh();
});

// Self-healing: when a target moves, re-anchor notes. When the user drags a
// note itself, remember its new offset instead of snapping it back.
let syncing = false;
let knownNoteIds = '';
let tableNoteIds: string | null = null; // notes as of the last table refresh
function noteIds(container: FrameNode): string {
  return getNotes(container).map((n) => n.id).sort().join(',');
}

// Plugin edits join the undo history, so cleaning up the instant a note is deleted would make the user's
// first Cmd+Z undo our cleanup instead of their delete. Wait, so a quick undo finds nothing to revert, then
// sweep: pointers whose note is still gone are removed and the tables refreshed.
const CLEANUP_DELAY_MS = 5000;
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
async function sweep(): Promise<void> {
  cleanupTimer = null;
  const container = figma.currentPage.findChild((n) => n.name === CONTAINER_NAME) as FrameNode | null;
  let removed = 0;
  if (container) {
    syncing = true; // don't let the change handler resync notes while we're mid-sweep
    try {
      removed += await removeNotesWithMissingTargets(container); // the layer a note pointed at was deleted
      removed += removeOrphanPointers(container); // the note itself was deleted
    } finally {
      syncing = false;
    }
  }
  const ids = container ? noteIds(container) : '';
  if (removed > 0 || ids !== tableNoteIds) {
    tableNoteIds = ids;
    await pushState();
    scheduleTableRefresh();
  }
}

function scheduleCleanup(): void {
  if (cleanupTimer !== null) clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(() => void sweep(), CLEANUP_DELAY_MS);
}

async function onNodeChange(event: NodeChangeEvent): Promise<void> {
  if (syncing) return;
  const container = figma.currentPage.findChild((n) => n.name === CONTAINER_NAME) as FrameNode | null;
  const membership = event.nodeChanges.some((c) => c.type === 'DELETE' || c.type === 'CREATE');
  if (!container) {
    if (membership && knownNoteIds) {
      knownNoteIds = '';
      await pushState();
      scheduleCleanup();
    }
    return;
  }
  syncing = true;
  try {
    // A note was deleted (or brought back by undo): update the panel now, tidy the document later.
    if (membership) {
      const ids = noteIds(container);
      if (ids !== knownNoteIds) {
        knownNoteIds = ids;
        await pushState();
      }
      // Always schedule: the selection change from deleting a selected note can update knownNoteIds first.
      scheduleCleanup();
    }
    for (const change of event.nodeChanges) {
      if (change.type !== 'PROPERTY_CHANGE' || change.node.removed) continue;
      const node = change.node;
      // The user edited a note's text on the canvas: remember which note, and apply it once it is deselected.
      if (node.type === 'TEXT' && node.name === 'text' && isInside(node, container) && change.properties.indexOf('characters') !== -1) {
        const note = noteFrameOf(node, container);
        if (note) editedNoteIds.add(note.id);
      }
      const moved = change.properties.indexOf('x') !== -1 || change.properties.indexOf('y') !== -1;
      if (moved && node.type === 'FRAME' && getData(node, KEY.note) === '1') {
        const target = await figma.getNodeByIdAsync(getData(node, KEY.target));
        const tb = target && 'absoluteBoundingBox' in target ? target.absoluteBoundingBox : null;
        if (tb) {
          setData(node, KEY.dx, String(node.x - tb.x));
          setData(node, KEY.dy, String(node.y - tb.y));
        }
      }
    }
    if (getNotes(container).length) await resync();
  } finally {
    syncing = false;
  }
}

// dynamic-page access: listen on the current page only, and re-bind on page switch.
function bindPage(): void {
  figma.currentPage.off('nodechange', onNodeChange); // avoid duplicate handlers when revisiting a page
  figma.currentPage.on('nodechange', onNodeChange);
}
bindPage();
figma.on('currentpagechange', () => {
  bindPage();
  if (editedNoteIds.size) { editedNoteIds.clear(); scheduleTableRefresh(); }
  void pushState();
});

figma.ui.onmessage = async (msg: PluginMessage) => {
  try {
    switch (msg.type) {
      case 'init':
        await pushState();
        break;
      case 'add-note':
        await saveDistance(msg.distance);
        await savePointerStyle(msg.pointerStyle);
        await addNote(msg.text, msg.categoryId, msg.direction, msg.distance, msg.pointerStyle);
        await pushState();
        scheduleTableRefresh();
        sendToUI({ type: 'success', message: 'Note added.' });
        break;
      case 'set-status':
        await setStatus(msg.noteId, msg.status);
        await pushState();
        scheduleTableRefresh();
        break;
      case 'goto-note':
        await gotoNote(msg.noteId);
        break;
      case 'attach-note':
        await attachNote(msg.noteId);
        await pushState();
        sendToUI({ type: 'success', message: 'Pointer added.' });
        break;
      case 'delete-note':
        await deleteNote(msg.noteId);
        await pushState();
        scheduleTableRefresh();
        break;
      case 'save-distance':
        await saveDistance(msg.distance);
        break;
      case 'set-note-category':
        await setNoteCategory(msg.noteId, msg.categoryId);
        await pushState();
        scheduleTableRefresh();
        break;
      case 'set-note-placement':
        await setNotePlacement(msg.noteId, msg.direction, msg.distance);
        await pushState();
        break;
      case 'set-note-pointer-style':
        await setNotePointerStyle(msg.noteId, msg.pointerStyle);
        await pushState();
        break;
      case 'save-pointer-style':
        await savePointerStyle(msg.pointerStyle);
        break;
      case 'save-categories':
        await saveCategories(msg.categories);
        await pushState();
        scheduleTableRefresh();
        sendToUI({ type: 'success', message: 'Categories saved.' });
        break;
      case 'build-table': {
        const { count, pages } = await buildTable(msg.options);
        await pushState();
        sendToUI({ type: 'success', message: `Table updated with ${count} annotations from ${pages} page${pages === 1 ? '' : 's'}.` });
        break;
      }
      case 'resync': {
        const fixed = await resync();
        sendToUI({ type: 'success', message: `Re-anchored ${fixed} notes.` });
        break;
      }
      case 'close':
        figma.closePlugin();
        break;
    }
  } catch (err) {
    sendToUI({ type: 'error', message: err instanceof Error ? err.message : 'An unexpected error occurred.' });
  }
};
