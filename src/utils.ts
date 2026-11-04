// ============================================================================
// UXD Annotations — Shared Utilities
// ============================================================================

import type { UIMessage } from './types';

export function sendToUI(msg: UIMessage): void {
  figma.ui.postMessage(msg);
}

export function progress(percent: number, message: string): void {
  sendToUI({ type: 'progress', percent, message });
}

export function hexToRgb(hex: string): RGB {
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
  };
}

/** Walk up to the top-level frame (direct child of the page) that contains a node. */
export function topLevelAncestor(node: BaseNode): SceneNode | null {
  let current: BaseNode = node;
  while (current.parent && current.parent.type !== 'PAGE') current = current.parent;
  return current.type === 'PAGE' || current.type === 'DOCUMENT' ? null : (current as SceneNode);
}
