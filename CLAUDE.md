# UXD Annotations (Figma plugin)

Adds to the global `CLAUDE.md`. Build: `npm run build`. Checks: `npm run typecheck`, `npm run lint`, `npm test`.

## Annotations must survive plugin changes

Notes live in the Figma file (shared plugin data under `DATA_NAMESPACE` in `src/features/data.ts`), not in the plugin. Files already in use hold data written by earlier versions, so a change that makes that data unreadable silently loses users' annotations.

Before finishing any change that could be breaking, check that annotations already in a file are still picked up. A change is potentially breaking if it touches:

- the plugin `id` or `name` in `manifest.json`
- `DATA_NAMESPACE`, any data key, or the shape or meaning of stored values (notes, categories, distance, pointer style, table meta, summary page tag)
- how notes, pointers, containers or the summary page are found (by name, tag, node type or structure)
- node names or structure that lookups depend on

What to do:

1. Keep reading old data: fall back to the previous namespace, key or format, then migrate it forward on next write (see `getData` and the legacy keys in `src/features/preferences.ts`). Never drop the old read path in the same change that adds a new one.
2. Add a test in `tests/` that loads data in the previous format and asserts the notes are still found.
3. Verify in Figma on a file with notes made by the previous version: open it, confirm the notes list, pointers and summary table all still appear, then add a note and rebuild the table.
4. If old data genuinely cannot be read, say so explicitly in the PR and commit message instead of shipping it quietly.
