<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Where to read first

Two guides can both look like "read me first". They do not overlap:

- **Changing UI, colour, type, spacing, motion or copy** — read `DESIGN.md`. It is
  the contract for how the site looks and why; treat drift from it as a bug.
- **Changing Next.js code** (routing, metadata, exports, build config) — read the
  versioned guide in `node_modules/next/dist/docs/` (it exists only after
  `npm install`). This is Next 16 and its conventions are not the ones you may
  expect.

Before pushing, run `npm run check` (typecheck + lint + tests); CI runs the same.
