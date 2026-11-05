// Builds an auto-layout summary table on the canvas, grouped by page. "View Note" cells use NODE hyperlinks.

import type { BuildTableOptions, NoteSummary } from '../types';
import { hexToRgb, progress } from '../utils';
import { loadCategories } from './categories';
import { getData, setData } from './data';
import { summariseNotes } from './notes';

const TABLE_NAME = 'Annotation Summary';
const META_KEY = 'qxr-table-meta';
const SUMMARY_PAGE_KEY = 'qxr-summary-page';
export const SUMMARY_PAGE_NAME = 'Annotation Summary';
const FONT: FontName = { family: 'Inter', style: 'Regular' };
const FONT_BOLD: FontName = { family: 'Inter', style: 'Semi Bold' };
const COLS = [
  { label: 'Date', width: 80 },
  { label: 'Category', width: 110 },
  { label: 'Note', width: 400 },
  { label: 'Status', width: 80 },
  { label: 'Link', width: 80 },
];
const TABLE_INNER_WIDTH = COLS.reduce((sum, c) => sum + c.width, 0) + 12 * (COLS.length - 1);

function cell(text: string, width: number, bold = false, color?: string, size = 11): TextNode {
  const t = figma.createText();
  t.fontName = bold ? FONT_BOLD : FONT;
  t.fontSize = size;
  t.characters = text;
  t.resize(width, t.height);
  t.textAutoResize = 'HEIGHT'; // after resize(), which would otherwise switch it to fixed
  t.fills = [{ type: 'SOLID', color: color ? hexToRgb(color) : { r: 0.1, g: 0.1, b: 0.1 } }];
  return t;
}

function row(name = 'Row'): FrameNode {
  const r = figma.createFrame();
  r.name = name;
  r.layoutMode = 'HORIZONTAL';
  r.primaryAxisSizingMode = 'AUTO';
  r.counterAxisSizingMode = 'AUTO';
  r.itemSpacing = 12;
  r.paddingTop = r.paddingBottom = 6;
  r.fills = [];
  return r;
}

/** How a table was built: stored on the table so it can be refreshed later without user input. */
interface TableMeta extends BuildTableOptions {
  sourcePageId: string;
}

function readMeta(table: FrameNode): TableMeta | null {
  try {
    const raw = getData(table, META_KEY);
    const meta = raw ? (JSON.parse(raw) as Partial<TableMeta>) : null;
    if (!meta || (meta.scope !== 'all-pages' && meta.scope !== 'this-page')) return null;
    if (meta.destination !== 'summary-page' && meta.destination !== 'current-page') return null;
    return { scope: meta.scope, destination: meta.destination, sourcePageId: String(meta.sourcePageId || '') };
  } catch (_e) {
    return null;
  }
}

async function collectNotes(meta: TableMeta, interactive: boolean): Promise<NoteSummary[]> {
  if (meta.scope === 'this-page') {
    const node = meta.sourcePageId ? await figma.getNodeByIdAsync(meta.sourcePageId) : null;
    const page = node && node.type === 'PAGE' ? node : figma.currentPage;
    await page.loadAsync();
    return summariseNotes(page);
  }
  // dynamic-page access: every page must be loaded before its contents can be read.
  if (interactive) progress(5, 'Loading all pages…');
  await figma.loadAllPagesAsync();
  const pages = figma.root.children.filter((p) => !isSummaryPage(p));
  const all: NoteSummary[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (interactive) progress(10 + Math.round((80 * i) / pages.length), `Reading ${pages[i].name}…`);
    all.push(...(await summariseNotes(pages[i])));
  }
  return all;
}

/** The summary page is recognised by a tag, not its name, so renaming it doesn't make us create another.
 *  A page that still has the default name but no tag (made by an earlier version) is adopted and tagged. */
function isSummaryPage(p: PageNode): boolean {
  return getData(p, SUMMARY_PAGE_KEY) === '1';
}

function findSummaryPage(): PageNode | undefined {
  const tagged = figma.root.children.find(isSummaryPage);
  if (tagged) return tagged;
  const byName = figma.root.children.find((p) => p.name === SUMMARY_PAGE_NAME);
  if (byName) setData(byName, SUMMARY_PAGE_KEY, '1');
  return byName;
}

async function getDestinationPage(destination: BuildTableOptions['destination']): Promise<PageNode> {
  if (destination === 'current-page') return figma.currentPage;
  const existing = findSummaryPage();
  if (existing) return existing;
  const page = figma.createPage();
  page.name = SUMMARY_PAGE_NAME;
  setData(page, SUMMARY_PAGE_KEY, '1');
  return page;
}

async function findTable(page: PageNode): Promise<FrameNode | null> {
  await page.loadAsync();
  return (page.findChild((n) => n.name === TABLE_NAME && n.type === 'FRAME') as FrameNode | null) || null;
}

/** Which tables exist, so the UI can say "Update table" instead of "Build summary table". */
export async function tableState(): Promise<{ summaryPage: boolean; currentPage: boolean }> {
  const summary = findSummaryPage();
  return {
    summaryPage: summary ? !!(await findTable(summary)) : false,
    currentPage: !!(await findTable(figma.currentPage)),
  };
}

async function renderTable(meta: TableMeta, interactive: boolean): Promise<{ count: number; pages: number }> {
  const notes = await collectNotes(meta, interactive);
  if (interactive && notes.length === 0) {
    throw new Error(meta.scope === 'all-pages' ? 'No annotations found on any page.' : 'No annotations on this page yet.');
  }
  const categories = await loadCategories();
  await Promise.all([figma.loadFontAsync(FONT), figma.loadFontAsync(FONT_BOLD)]);

  if (interactive) progress(95, 'Building table…');
  const page = await getDestinationPage(meta.destination);
  await page.loadAsync();

  // Replace the previous table but keep it where the user left it.
  const previous = page.findChildren((n) => n.name === TABLE_NAME && n.type === 'FRAME');
  const origin = previous.length ? { x: previous[0].x, y: previous[0].y } : null;
  previous.forEach((n) => n.remove());

  const table = figma.createFrame();
  table.name = TABLE_NAME;
  setData(table, META_KEY, JSON.stringify(meta));
  table.layoutMode = 'VERTICAL';
  table.primaryAxisSizingMode = 'AUTO';
  table.counterAxisSizingMode = 'AUTO';
  table.paddingLeft = table.paddingRight = table.paddingTop = table.paddingBottom = 20;
  table.itemSpacing = 4;
  table.cornerRadius = 12;
  table.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  const pageNames = Array.from(new Set(notes.map((n) => n.pageName)));
  table.appendChild(cell(`Annotation Summary — ${notes.length} items`, TABLE_INNER_WIDTH, true, undefined, 14));
  const header = row('Header row');
  COLS.forEach((c) => header.appendChild(cell(c.label, c.width, true, '666666')));
  table.appendChild(header);

  for (const pageName of pageNames) {
    const pageNotes = notes.filter((n) => n.pageName === pageName);
    table.appendChild(cell(`${pageName} (${pageNotes.length})`, TABLE_INNER_WIDTH, true, undefined, 13));
    for (const n of pageNotes) {
      const cat = categories.find((c) => c.id === n.categoryId);
      const r = row();
      r.appendChild(cell(n.date || '—', COLS[0].width));
      r.appendChild(cell(cat ? cat.name : 'Uncategorised', COLS[1].width, true, cat ? cat.color : undefined));
      r.appendChild(cell(n.text, COLS[2].width));
      r.appendChild(cell(n.status === 'done' ? '☑ Completed' : '☐ To Do', COLS[3].width));
      const link = cell('View Note', COLS[4].width, false, '0D99FF');
      link.setRangeHyperlink(0, link.characters.length, { type: 'NODE', value: n.id });
      r.appendChild(link);
      table.appendChild(r);
    }
  }

  page.appendChild(table);
  if (origin) {
    table.x = origin.x;
    table.y = origin.y;
  } else if (page === figma.currentPage) {
    table.x = figma.viewport.center.x - table.width / 2;
    table.y = figma.viewport.center.y - table.height / 2;
  } else {
    table.x = 0;
    table.y = 0;
  }

  if (interactive) {
    if (page !== figma.currentPage) await figma.setCurrentPageAsync(page);
    figma.viewport.scrollAndZoomIntoView([table]);
  }
  return { count: notes.length, pages: pageNames.length };
}

export async function buildTable(options: BuildTableOptions): Promise<{ count: number; pages: number }> {
  return renderTable({ ...options, sourcePageId: figma.currentPage.id }, true);
}

/** Re-render every existing table (summary page + current page) from the notes as they are now. */
export async function refreshTables(): Promise<void> {
  const pages: PageNode[] = [figma.currentPage];
  const summary = findSummaryPage();
  if (summary && summary !== figma.currentPage) pages.push(summary);
  for (const page of pages) {
    const table = await findTable(page);
    const meta = table ? readMeta(table) : null;
    if (meta) await renderTable({ ...meta, destination: page === summary ? 'summary-page' : 'current-page' }, false);
  }
}
