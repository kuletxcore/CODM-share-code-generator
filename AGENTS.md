<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent instructions

The one set of instructions for any AI coding agent in this repo (Codex, Copilot, Cursor, Gemini, Claude, Aider, Windsurf, Jules, and others). Tool-specific files (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`) only point here, so edit this file, not them.

## The project

A fan-made colour-filter share-code generator for Call of Duty: Mobile, live at https://codm.kuletxcore.workers.dev. It is a Next.js static export served by a Cloudflare Worker. Everything runs in the browser: there is no backend, no API route, no database and no secrets.

- [README.md](README.md): the 22-number share-code format, how to use a code in game, commands.
- [DESIGN.md](DESIGN.md): the UI contract (tokens, type, layout states, accessibility, content rules) and why. Read it before any UI change; drift from it is a bug, and a UI change updates it.
- [docs/ARENA-MERGE-2.md](docs/ARENA-MERGE-2.md): which remake ideas were taken or rejected, and why. Check it before reintroducing one.
- [docs/AFTER-MERGE.md](docs/AFTER-MERGE.md): what changed after that merge, including the in-game evidence behind the share-code rules.

## Commands

```bash
npm ci            # install from the lockfile (Node 22.18+, see .node-version)
npm run dev       # dev server on :3000
npm run check     # lint + typecheck + tests: run before every commit (CI runs these plus the build)
npm run build     # static export into out/
```

`npm run deploy` publishes to production. Do not run it; Cloudflare Workers Builds deploys `main` and builds a preview for every branch.

## Things that will bite you

1. **Typecheck needs generated types.** `npm run typecheck` runs `next typegen` before `tsc`; a bare `tsc --noEmit` on a clean clone fails on `LayoutProps`.
2. **The share codec is strict on purpose.** `decode()` in `src/lib/codm.ts` only accepts 22 integers inside the documented ranges. Do not loosen it; a silently coerced code is a wrong grade in the player's game. Negative brightness (-1000 to 1000) is legal.
3. **Codec facts come from in-game screenshots.** The README marks what is confirmed. Do not change the mapping (hue = swatch × 125 + slider × 1.25, brightness and saturation offsets) without new in-game evidence.
4. **The preview grades on the GPU, with a CPU fallback.** `src/lib/gpuGrade.ts` must match `applyGrade` in `codm.ts`; change both together. `src/lib/grade.test.ts` keeps the original CPU loop as an oracle: an intentional change to the grade maths updates the oracle in the same commit, nothing else does.
5. **`next dev` rewrites the block at the top of this file.** Leave it, and commit it if it changes.

## Conventions

- Components that touch the DOM are client components. three.js, the QR encoder and the card renderer load with `await import()` to stay off the critical path.
- Tailwind v4 with tokens in `src/app/globals.css` under `@theme`. Use the tokens; do not hard-code colours.
- Tests are `*.test.ts` next to the code, using `node:test` and `node:assert/strict`, with no test-runner dependency. Import with the `.ts` extension.
- Comments say why, not what.
- Tap targets are at least 44px; every control is keyboard reachable with a visible focus ring.

## Content rules

- No numbers, testimonials or claims without a source. Game and map attributions must be checked against published sources.
- Gameplay stills must not show another player's gamer tag.
- The site stays marked "Unofficial fan-made" and is not affiliated with Activision, TiMi or Tencent.
- Never commit credentials, cookies or `.env` files.

## Git

- Work on a branch; open a draft pull request against `main`. Keep commits focused, with messages that say why.
- Done means `npm run check` and `npm run build` pass, and README or DESIGN.md is updated when behaviour or UI changed.
