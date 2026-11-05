// Note cards + leader lines. A note is a locked frame tagged via pluginData;
// its target and offset are stored so the line can be re-anchored (self-healing).

import type { Category, Direction, NoteStatus, NoteSummary, PointerStyle } from '../types';
import { hexToRgb, topLevelAncestor } from '../utils';
import { ensureCategoriesInFile, loadCategories } from './categories';
import { DATA_NAMESPACE, getData, setData } from './data';
import { clampDistance, DEFAULT_NOTE_DISTANCE } from './preferences';
import { pointerPoints, toPathData } from './pointer';
import { computeCardPosition, inferPlacement } from './placement';

export const CONTAINER_NAME = '.qxr-annotations';
export const KEY = { note: 'qxr-note', target: 'qxr-target', cat: 'qxr-cat', status: 'qxr-status', dx: 'qxr-dx', dy: 'qxr-dy', line: 'qxr-line', sig: 'qxr-sig', style: 'qxr-style' };
const FONT: FontName = { family: 'Inter', style: 'Regular' };
const FONT_BOLD: FontName = { family: 'Inter', style: 'Semi Bold' };

/** Hidden, zero-origin container so child x/y equal page coordinates. */
async function getContainer(): Promise<FrameNode> {
  const existing = figma.currentPage.findChild((n) => n.name === CONTAINER_NAME && n.type === 'FRAME') as FrameNode | null;
  if (existing) {
    existing.locked = false; // a locked parent would stop users editing note text on the canvas
    return existing;
  }
  const f = figma.createFrame();
  f.name = CONTAINER_NAME;
  f.x = 0;
  f.y = 0;
  f.resize(1, 1);
  f.fills = [];
  f.clipsContent = false;
  figma.currentPage.appendChild(f);
  return f;
}

export function getNotes(container: FrameNode): FrameNode[] {
  return container.findChildren((n) => n.type === 'FRAME' && getData(n, KEY.note) === '1') as FrameNode[];
}

function noteText(note: FrameNode): string {
  const t = note.findOne((n) => n.type === 'TEXT' && n.name === 'text') as TextNode | null;
  return t ? t.characters : '';
}

function statusOf(note: FrameNode): NoteStatus {
  return getData(note, KEY.status) === 'done' ? 'done' : 'todo';
}

/** Geometry fingerprint: lets resync skip untouched notes, so its own writes can't retrigger it forever. */
function signature(note: FrameNode, target: SceneNode): string {
  const tb = target.absoluteBoundingBox;
  const nb = note.absoluteBoundingBox;
  return tb && nb ? [tb.x, tb.y, tb.width, tb.height, nb.x, nb.y, nb.width, nb.height].join(',') : '';
}

function drawLine(container: FrameNode, note: FrameNode, target: SceneNode, existing?: SceneNode): GroupNode {
  const tb = target.absoluteBoundingBox;
  const nb = note.absoluteBoundingBox;
  if (existing && !existing.removed) {
    existing.locked = false;
    existing.remove();
  }
  const color = note.strokes.length ? note.strokes : [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } } as Paint];
  // Notes made before pointer styles existed have no saved style: keep them straight.
  const style: PointerStyle = getData(note, KEY.style) === 'elbow' ? 'elbow' : 'straight';
  const points = tb && nb ? pointerPoints(style, nb, tb) : [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  const end = points[points.length - 1];

  const line = figma.createVector();
  line.name = 'line';
  line.vectorPaths = [{ windingRule: 'NONE', data: toPathData(points) }];
  line.strokeJoin = 'ROUND';
  line.strokes = color;
  line.strokeWeight = 2;
  line.dashPattern = [6, 4];
  container.appendChild(line);

  const dot = figma.createEllipse();
  dot.name = 'dot';
  dot.resize(10, 10);
  dot.x = end.x - 5;
  dot.y = end.y - 5;
  dot.fills = color;
  container.appendChild(dot);

  const group = figma.group([line, dot], container, 0);
  group.name = 'pointer';
  group.locked = true;
  return group;
}

const TEXT_WIDTH = 240;
const CARD_PADDING = 16;
const AVATAR = 28;

function solid(color: RGB): Paint[] {
  return [{ type: 'SOLID', color }];
}

async function buildAvatar(initial: string, photoUrl: string | null): Promise<FrameNode> {
  const avatar = figma.createFrame();
  avatar.name = 'avatar';
  avatar.resize(AVATAR, AVATAR);
  avatar.cornerRadius = AVATAR / 2;
  avatar.clipsContent = true;
  avatar.fills = solid({ r: 0.85, g: 0.85, b: 0.85 });
  if (photoUrl) {
    try {
      const image = await figma.createImageAsync(photoUrl);
      avatar.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
      return avatar;
    } catch (_e) {
      /* photo blocked or unavailable: fall back to the initial below */
    }
  }
  avatar.layoutMode = 'HORIZONTAL';
  avatar.primaryAxisAlignItems = 'CENTER';
  avatar.counterAxisAlignItems = 'CENTER';
  const letter = figma.createText();
  letter.fontName = FONT_BOLD;
  letter.fontSize = 12;
  letter.characters = initial;
  letter.fills = solid({ r: 0.3, g: 0.3, b: 0.3 });
  avatar.appendChild(letter);
  return avatar;
}

function textNode(name: string, chars: string, font: FontName, size: number, color: RGB): TextNode {
  const t = figma.createText();
  t.name = name;
  t.fontName = font;
  t.fontSize = size;
  t.characters = chars;
  t.textAutoResize = 'HEIGHT';
  t.fills = solid(color);
  return t;
}

async function buildCard(text: string, category: Category): Promise<FrameNode> {
  await Promise.all([figma.loadFontAsync(FONT), figma.loadFontAsync(FONT_BOLD)]);
  const accent = hexToRgb(category.color);
  const user = figma.currentUser;
  const author = user ? user.name : 'Unknown author';
  const stamp = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const card = figma.createFrame();
  card.name = `Note · ${category.name}`;
  card.layoutMode = 'VERTICAL';
  card.resize(TEXT_WIDTH + CARD_PADDING * 2, 10);
  // resize() flips sizing to FIXED, so set hug-height (primary axis) afterwards.
  card.primaryAxisSizingMode = 'AUTO';
  card.counterAxisSizingMode = 'FIXED';
  card.cornerRadius = 12;
  card.clipsContent = true;
  card.fills = solid({ r: 1, g: 1, b: 1 });
  card.strokes = solid(accent);
  card.strokeWeight = 2;
  card.strokeAlign = 'INSIDE';

  // Header bar in the category colour
  const header = figma.createFrame();
  header.name = 'header';
  header.layoutMode = 'HORIZONTAL';
  header.primaryAxisSizingMode = 'FIXED';
  header.counterAxisSizingMode = 'AUTO';
  header.paddingLeft = header.paddingRight = CARD_PADDING;
  header.paddingTop = header.paddingBottom = 10;
  header.fills = solid(accent);
  const tag = textNode('category', category.name, FONT_BOLD, 14, { r: 1, g: 1, b: 1 });

  // Body: note text + author footer
  const body = figma.createFrame();
  body.name = 'body';
  body.layoutMode = 'VERTICAL';
  body.primaryAxisSizingMode = 'AUTO';
  body.counterAxisSizingMode = 'FIXED';
  body.itemSpacing = 16;
  body.paddingLeft = body.paddingRight = CARD_PADDING;
  body.paddingTop = body.paddingBottom = CARD_PADDING;
  body.fills = [];
  const message = textNode('text', text, FONT, 14, { r: 0.1, g: 0.1, b: 0.1 });

  const footer = figma.createFrame();
  footer.name = 'footer';
  footer.layoutMode = 'HORIZONTAL';
  footer.primaryAxisSizingMode = 'FIXED';
  footer.counterAxisSizingMode = 'AUTO';
  footer.counterAxisAlignItems = 'CENTER';
  footer.itemSpacing = 8;
  footer.fills = [];
  const avatar = await buildAvatar(author.charAt(0).toUpperCase(), user ? user.photoUrl : null);
  const meta = figma.createFrame();
  meta.name = 'meta';
  meta.layoutMode = 'VERTICAL';
  meta.primaryAxisSizingMode = 'AUTO';
  meta.counterAxisSizingMode = 'AUTO';
  meta.itemSpacing = 0;
  meta.fills = [];
  const name = textNode('author', author, FONT_BOLD, 12, { r: 0.1, g: 0.1, b: 0.1 });
  const date = textNode('date', stamp, FONT, 12, { r: 0.6, g: 0.6, b: 0.6 });
  name.textAutoResize = 'WIDTH_AND_HEIGHT';
  date.textAutoResize = 'WIDTH_AND_HEIGHT';
  meta.appendChild(name);
  meta.appendChild(date);
  footer.appendChild(avatar);
  footer.appendChild(meta);

  header.appendChild(tag);
  body.appendChild(message);
  body.appendChild(footer);
  card.appendChild(header);
  card.appendChild(body);

  // Fill the card so the note text is exactly 240px wide.
  header.layoutSizingHorizontal = 'FILL';
  body.layoutSizingHorizontal = 'FILL';
  message.layoutSizingHorizontal = 'FILL';
  footer.layoutSizingHorizontal = 'FILL';
  return card;
}


export async function addNote(text: string, categoryId: string, direction: Direction = 'left', distance: number = DEFAULT_NOTE_DISTANCE, pointerStyle: PointerStyle = 'elbow'): Promise<void> {
  // Validate at the boundary: the UI value is untrusted input.
  const gap = clampDistance(distance);
  const target = figma.currentPage.selection[0];
  if (!target) throw new Error('Select a layer to annotate first.');
  if (!text.trim()) throw new Error('Enter some note text.');
  await ensureCategoriesInFile();
  const categories = await loadCategories();
  const category = categories.find((c) => c.id === categoryId) ?? categories[0];
  const container = await getContainer();
  const card = await buildCard(text.trim(), category);
  container.appendChild(card);

  const tb = target.absoluteBoundingBox;
  if (!tb) throw new Error('That layer has no bounds to anchor to.');
  const pos = computeCardPosition(card, tb, direction, gap);
  card.x = pos.x;
  card.y = pos.y;
  card.locked = false;
  setData(card, KEY.note, '1');
  setData(card, KEY.target, target.id);
  setData(card, KEY.cat, category.id);
  setData(card, KEY.status, 'todo');
  setData(card, KEY.style, pointerStyle);
  setData(card, KEY.dx, String(card.x - tb.x));
  setData(card, KEY.dy, String(card.y - tb.y));
  const line = drawLine(container, card, target);
  setData(card, KEY.line, line.id);
  setData(card, KEY.sig, signature(card, target));
}

/** Notes made under an earlier plugin ID keep their data as private plugin data, which this ID cannot read,
 *  so they look untagged. Recognise them by shape (a "Note · …" card holding 'text' and 'category' layers
 *  inside the container) and re-tag them as shared data. The target/offset were in the unreadable data and
 *  can't be recovered, so these notes show "(missing layer)" until re-attached by the user. Idempotent. */
async function recoverOrphanedNotes(page: PageNode): Promise<void> {
  const container = page.findChild((n) => n.name === CONTAINER_NAME && n.type === 'FRAME') as FrameNode | null;
  if (!container) return;
  const orphans = container.findChildren(
    (n) => n.type === 'FRAME' && n.name.indexOf('Note · ') === 0 && getData(n, KEY.note) !== '1' &&
      !!(n as FrameNode).findOne((c) => c.type === 'TEXT' && c.name === 'text') &&
      !!(n as FrameNode).findOne((c) => c.type === 'TEXT' && c.name === 'category'),
  ) as FrameNode[];
  if (!orphans.length) return;
  const categories = await loadCategories();
  for (const note of orphans) {
    const label = (note.findOne((c) => c.type === 'TEXT' && c.name === 'category') as TextNode).characters;
    const category = categories.find((c) => c.name === label);
    setData(note, KEY.note, '1');
    if (category) setData(note, KEY.cat, category.id);
    setData(note, KEY.status, note.opacity < 1 ? 'done' : 'todo');
    setData(note, KEY.style, 'straight'); // notes from before pointer styles existed were straight
  }
}

/** Every note on a page, found by its data tag rather than by where it sits, so notes are picked up
 *  even if they were moved out of the hidden container or created by another copy of the plugin. */
export async function findNotes(page: PageNode): Promise<FrameNode[]> {
  await page.loadAsync();
  await recoverOrphanedNotes(page);
  const shared = page.findAllWithCriteria({ types: ['FRAME'], sharedPluginData: { namespace: DATA_NAMESPACE, keys: [KEY.note] } });
  const legacy = page.findAllWithCriteria({ types: ['FRAME'], pluginData: { keys: [KEY.note] } }); // written by earlier versions
  const seen = new Set<string>();
  return [...shared, ...legacy].filter((n) => {
    if (seen.has(n.id) || getData(n, KEY.note) !== '1') return false;
    seen.add(n.id);
    return true;
  });
}

export async function summariseNotes(page: PageNode = figma.currentPage): Promise<NoteSummary[]> {
  const out: NoteSummary[] = [];
  // Resolve before looping: `for (x of await …)` compiles to a form Figma's plugin engine can mis-execute.
  const notes = await findNotes(page);
  for (const note of notes) {
    const target = await figma.getNodeByIdAsync(getData(note, KEY.target));
    const frame = target ? topLevelAncestor(target) : null;
    const tb = target && 'absoluteBoundingBox' in target ? target.absoluteBoundingBox : null;
    const nb = note.absoluteBoundingBox;
    const placement = tb && nb ? inferPlacement(nb, tb) : { direction: 'right' as Direction, distance: 0 };
    out.push({
      id: note.id,
      text: noteText(note),
      categoryId: getData(note, KEY.cat),
      status: statusOf(note),
      targetId: target?.id ?? '',
      targetName: target && 'name' in target ? target.name : '(missing layer)',
      frameName: frame?.name ?? 'Unassigned',
      frameLayout: frame && 'layoutMode' in frame ? (frame.layoutMode === 'HORIZONTAL' ? 'row' : frame.layoutMode === 'VERTICAL' ? 'column' : '') : '',
      pageName: page.name,
      pointerStyle: getData(note, KEY.style) === 'elbow' ? 'elbow' : 'straight',
      direction: placement.direction,
      distance: placement.distance,
    });
  }
  return out;
}

export async function setStatus(noteId: string, status: NoteStatus): Promise<void> {
  const note = await figma.getNodeByIdAsync(noteId);
  if (!note || note.type !== 'FRAME') return;
  setData(note, KEY.status, status);
  note.opacity = status === 'done' ? 0.5 : 1;
}

/** Re-categorise an existing note: card header, border, label and pointer all take the new colour. */
export async function setNoteCategory(noteId: string, categoryId: string): Promise<void> {
  const note = await figma.getNodeByIdAsync(noteId);
  if (!note || note.type !== 'FRAME' || getData(note, KEY.note) !== '1') return;
  const category = (await loadCategories()).find((c) => c.id === categoryId);
  if (!category) throw new Error('That category no longer exists.');

  const accent = hexToRgb(category.color);
  const tag = note.findOne((n) => n.type === 'TEXT' && n.name === 'category') as TextNode | null;
  const header = note.findOne((n) => n.type === 'FRAME' && n.name === 'header') as FrameNode | null;
  if (tag && tag.fontName !== figma.mixed) await figma.loadFontAsync(tag.fontName);
  if (tag) tag.characters = category.name;
  if (header) header.fills = solid(accent);
  note.strokes = solid(accent);
  note.name = `Note · ${category.name}`;
  setData(note, KEY.cat, category.id);

  // The pointer takes its colour from the card border, so redraw it.
  const container = note.parent;
  const target = await figma.getNodeByIdAsync(getData(note, KEY.target));
  if (container && container.type === 'FRAME' && target && !target.removed && 'absoluteBoundingBox' in target) {
    const existing = (await figma.getNodeByIdAsync(getData(note, KEY.line))) as SceneNode | null;
    const line = drawLine(container, note, target as SceneNode, existing || undefined);
    setData(note, KEY.line, line.id);
    setData(note, KEY.sig, signature(note, target as SceneNode));
  }
}

/** Move an existing note to a new side/distance of its target and redraw its line. */
export async function setNotePlacement(noteId: string, direction: Direction, distance: number): Promise<void> {
  const note = await figma.getNodeByIdAsync(noteId);
  if (!note || note.type !== 'FRAME' || getData(note, KEY.note) !== '1') return;
  const container = note.parent;
  const target = await figma.getNodeByIdAsync(getData(note, KEY.target));
  const tb = target && !target.removed && 'absoluteBoundingBox' in target ? target.absoluteBoundingBox : null;
  if (!container || container.type !== 'FRAME' || !target || !tb) {
    throw new Error('Cannot move: the annotated layer no longer exists.');
  }
  const pos = computeCardPosition(note, tb, direction, clampDistance(distance));
  note.x = pos.x;
  note.y = pos.y;
  setData(note, KEY.dx, String(note.x - tb.x));
  setData(note, KEY.dy, String(note.y - tb.y));
  const existing = (await figma.getNodeByIdAsync(getData(note, KEY.line))) as SceneNode | null;
  const line = drawLine(container, note, target as SceneNode, existing || undefined);
  setData(note, KEY.line, line.id);
  setData(note, KEY.sig, signature(note, target as SceneNode));
}

/** Change an existing note's pointer style and redraw its line immediately. */
export async function setNotePointerStyle(noteId: string, style: PointerStyle): Promise<void> {
  const note = await figma.getNodeByIdAsync(noteId);
  if (!note || note.type !== 'FRAME' || getData(note, KEY.note) !== '1') return;
  const container = note.parent;
  const target = await figma.getNodeByIdAsync(getData(note, KEY.target));
  if (!container || container.type !== 'FRAME' || !target || target.removed || !('absoluteBoundingBox' in target)) {
    throw new Error('Cannot restyle: the annotated layer no longer exists.');
  }
  setData(note, KEY.style, style);
  const existing = (await figma.getNodeByIdAsync(getData(note, KEY.line))) as SceneNode | null;
  const line = drawLine(container, note, target as SceneNode, existing || undefined);
  setData(note, KEY.line, line.id);
  setData(note, KEY.sig, signature(note, target as SceneNode));
}

export async function gotoNote(noteId: string): Promise<void> {
  const note = await figma.getNodeByIdAsync(noteId);
  if (note && note.type === 'FRAME') {
    figma.viewport.scrollAndZoomIntoView([note]);
    figma.currentPage.selection = [note]; // select it so the text can be edited straight on the canvas
  }
}

export async function deleteNote(noteId: string): Promise<void> {
  const note = await figma.getNodeByIdAsync(noteId);
  if (!note || note.type !== 'FRAME') return;
  const line = await figma.getNodeByIdAsync(getData(note, KEY.line));
  if (line && !line.removed) line.remove();
  note.remove();
}

/** Remove pointer lines whose note no longer exists (e.g. the card was deleted straight from the canvas).
 *  A deleted node's data can't be read, so orphans are found by elimination: any 'pointer' group in the
 *  container that no live note references. Returns how many were removed. */
export function removeOrphanPointers(container: FrameNode): number {
  const used = new Set<string>();
  for (const note of getNotes(container)) used.add(getData(note, KEY.line));
  const orphans = container.findChildren((n) => n.type === 'GROUP' && n.name === 'pointer' && !used.has(n.id));
  for (const line of orphans) {
    line.locked = false;
    line.remove();
  }
  return orphans.length;
}

/** Delete notes whose target layer has been deleted, along with their pointer lines. Notes with no
 *  recorded target (recovered from an earlier plugin ID) are left alone for the user to re-attach.
 *  Returns how many were removed. */
export async function removeNotesWithMissingTargets(container: FrameNode): Promise<number> {
  let removed = 0;
  for (const note of getNotes(container)) {
    const targetId = getData(note, KEY.target);
    if (!targetId) continue;
    const target = await figma.getNodeByIdAsync(targetId);
    if (target && !target.removed) continue;
    const line = (await figma.getNodeByIdAsync(getData(note, KEY.line))) as SceneNode | null;
    if (line && !line.removed) {
      line.locked = false;
      line.remove();
    }
    note.remove();
    removed++;
  }
  return removed;
}

/** Self-heal: move each note to keep its offset from its target, then redraw its line. */
export async function resync(): Promise<number> {
  const container = figma.currentPage.findChild((n) => n.name === CONTAINER_NAME) as FrameNode | null;
  if (!container) return 0;
  let fixed = 0;
  for (const note of getNotes(container)) {
    const target = await figma.getNodeByIdAsync(getData(note, KEY.target));
    if (!target || target.removed || !('absoluteBoundingBox' in target) || !target.absoluteBoundingBox) continue;
    const tb = target.absoluteBoundingBox;
    const nx = tb.x + Number(getData(note, KEY.dx));
    const ny = tb.y + Number(getData(note, KEY.dy));
    if (note.x !== nx || note.y !== ny) {
      note.x = nx;
      note.y = ny;
      fixed++;
    }
    const existing = (await figma.getNodeByIdAsync(getData(note, KEY.line))) as SceneNode | null;
    const sig = signature(note, target as SceneNode);
    if (existing && !existing.removed && getData(note, KEY.sig) === sig) continue;
    const line = drawLine(container, note, target as SceneNode, existing || undefined);
    setData(note, KEY.line, line.id);
    setData(note, KEY.sig, sig);
  }
  return fixed;
}
