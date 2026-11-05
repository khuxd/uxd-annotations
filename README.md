# UXD Annotations

A Figma plugin for leaving hand-off notes on layers. Each note is a card on the canvas joined to its layer by a pointer line, and a summary table collects every note in the file.

## What it does

- **Annotate a layer.** Select one layer, write the note, pick a category, which side the card sits on, the distance from the layer and the pointer style (elbow or straight), then annotate.
- **Pointers follow the layer.** Move the layer and its notes follow; drag a note and its new offset is remembered. Edit a note's text directly on the canvas.
- **Track status.** Tick a note in the panel to mark it as done.
- **Summary table.** Build a table of all notes, grouped by page and top-level frame, on a summary page or the current page. It refreshes when notes change.
- **Categories.** UX, UI, Feedback and Decision by default. Rename, recolour, add or remove them.

## Panel

The window is 440×760. A left rail switches between four tabs, and a footer stays visible.

| Tab | What it is for |
| --- | --- |
| Add | Category, direction, pointer style, distance and note text |
| Notes | The notes on this page, filtered by status and category. Click a note to select it on the canvas; use the pencil to change its category, pointer style and location |
| Table | Which pages to include, where to put the table, and build or update it |
| Categories | Edit the category list |

The footer shows the selected layer and the **Annotate selected layer** button.

A note that has lost its layer (for example one recovered from an earlier version of the plugin) shows **Re-attach**: select the layer it should point at, then click it.

## Development

```
npm install
npm run build       # bundles src/code.ts to code.js
npm run watch       # rebuild on change
npm run typecheck
npm run lint
npm test
```

In Figma desktop: Plugins → Development → Import plugin from manifest, and choose `manifest.json`. Rebuild and re-run the plugin after changes.

### Layout

```
src/code.ts          Plugin entry: messages from the panel, canvas listeners
src/features/        notes, pointer, placement, categories, table, preferences, data
src/types.ts         Shared types and the panel <-> plugin message protocol
ui.html              The panel (single file, no build step)
tests/               Unit tests for pure logic
```

## Where notes are stored

Notes live in the Figma file, not in the plugin, as shared plugin data under the namespace `uxdannotations` (`DATA_NAMESPACE` in `src/features/data.ts`). Anyone with the plugin can read them, and the data older versions wrote is still read.

Changing the plugin `id` or `name`, the namespace, any data key, or how notes, pointers or the summary page are found can make existing annotations unreadable. See `CLAUDE.md` for the checks to run before changing any of those.
