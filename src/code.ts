// ============================================================================
// UXD Annotations — Plugin Entry Point & Message Router
// ============================================================================

import type { PluginMessage } from './types';
import { sendToUI } from './utils';
import { loadCategories, saveCategories } from './features/categories';
import { addNote, deleteNote, getNotes, gotoNote, KEY, resync, setNoteCategory, setNotePlacement, setNotePointerStyle, setStatus, summariseNotes, CONTAINER_NAME } from './features/notes';
import { loadDistance, loadPointerStyle, saveDistance, savePointerStyle } from './features/preferences';
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

figma.on('selectionchange', () => void pushState());

// Self-healing: when a target moves, re-anchor notes. When the user drags a
// note itself, remember its new offset instead of snapping it back.
let syncing = false;
async function onNodeChange(event: NodeChangeEvent): Promise<void> {
  if (syncing) return;
  const container = figma.currentPage.findChild((n) => n.name === CONTAINER_NAME) as FrameNode | null;
  if (!container) return;
  syncing = true;
  let textEdited = false;
  try {
    for (const change of event.nodeChanges) {
      if (change.type !== 'PROPERTY_CHANGE' || change.node.removed) continue;
      const node = change.node;
      // The user edited a note's text on the canvas: refresh the panel from the card.
      if (node.type === 'TEXT' && node.name === 'text' && isInside(node, container) && change.properties.indexOf('characters') !== -1) textEdited = true;
      const moved = change.properties.indexOf('x') !== -1 || change.properties.indexOf('y') !== -1;
      if (moved && node.type === 'FRAME' && node.getPluginData(KEY.note) === '1') {
        const target = await figma.getNodeByIdAsync(node.getPluginData(KEY.target));
        const tb = target && 'absoluteBoundingBox' in target ? target.absoluteBoundingBox : null;
        if (tb) {
          node.setPluginData(KEY.dx, String(node.x - tb.x));
          node.setPluginData(KEY.dy, String(node.y - tb.y));
        }
      }
    }
    if (getNotes(container).length) await resync();
    if (textEdited) {
      await pushState();
      scheduleTableRefresh();
    }
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
