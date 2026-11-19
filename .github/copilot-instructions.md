<!--
  Generated from AGENTS.md by scripts/sync-agent-instructions.mjs.
  Edit AGENTS.md and run `npm run agents:sync`, or CI will fail.
-->

# Copilot instructions

## What this project is

A fan-made colour-filter share-code generator for Call of Duty: Mobile. Next.js
16 static export, served as static assets from a Cloudflare Worker. Everything
runs in the browser; there is no backend, no database, no API route, and no
secrets. A visitor picks or builds a 22-number filter code, previews it, and
copies it into the game.

Two companion documents matter and they do not overlap:

- **`DESIGN.md`** — the UI contract. Colour, type, spacing, motion, layout
  states, accessibility rules, and the reason for each. **Read it before any UI
  change, and treat drift from it as a bug.** Visual decisions are not free-form
  here.
- **`README.md`** — the share-code format, how to use a code in game, and the
  developer commands.

## Commands

```bash
npm ci                 # install exactly what the lockfile pins
npm run dev            # dev server on :3000
npm run check          # typecheck + lint + tests; run this before every commit
npm test               # node --test over src/**/*.test.mts
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run build          # static export into out/
npm run deploy         # wrangler deploy (runs the build first)
```

`npm run check` is the gate. CI runs the same three steps.

## Hard-won facts, in the order they will bite you

1. **A fresh clone does not typecheck.** `next build` writes `LayoutProps<'/'>`
   and friends into `.next/types/`, and `next-env.d.ts` is gitignored, so a bare
   `tsc --noEmit` on a clean checkout fails with `Cannot find name 'LayoutProps'`.
   `src/app/layout.tsx` deliberately types `children` explicitly instead of
   relying on the generated type. Do not "tidy" that back into `LayoutProps<"/">`.
2. **The share codec is strict on purpose.** `decode()` rejects anything that is
   not 22 plain integers inside the per-segment ranges in `SEGMENT_RANGES`. Do not
   loosen it to be forgiving: a code is pasted out of the game, and silently
   coercing junk is how a wrong code reaches the player. **Negative brightness is
   legal** (`-1000..1000`, segments 8/12/16/20) and most shipped looks use it.
3. **Hue `1000` is a real value** — Magenta at slider 100 — and is not the same
   as `0` (Red at 0). `hueParts()` clamps 0–360 rather than wrapping. Wrapping it
   relabels the colour and then rewrites the grade on the next drag.
4. **The grade maths has an oracle test.** `src/lib/grade.test.mts` contains the
   original, unoptimised pixel loop and asserts the current implementation is
   bit-identical, on every shipped look plus randomised settings. If you touch
   `applyGrade` / `paintGrade` / `gradePlan`, keep that test green. Do not edit
   the oracle to match new output unless the change is intentional.
5. **CPU grading is a real path, not dead code.** It runs whenever WebGL is
   unavailable and it powers the wall-of-looks and gallery thumbnails. Keep it
   correct, and keep it fast: a 168x108 tile is about 1 ms, and the wall renders
   one tile per animation frame on purpose so opening it never blocks input.
6. **`next dev` rewrites the `nextjs-agent-rules` block above.** Do not fight it;
   commit it with your work so the tree stays clean.

## Conventions in this codebase

- Everything that touches the DOM is a client component (`"use client"`), and
  expensive libraries (three.js, the QR encoder, the card renderer) load through
  `await import()` so they stay off the critical path.
- Images are `<img>` (plus `eslint-disable` where needed), not `next/image`;
  `images.unoptimized` is set because the output is a static export.
- Styling is Tailwind v4 with design tokens declared in `src/app/globals.css`
  under `@theme`. Use the tokens (`ink`, `panel`, `line`, `mute`, `text`, `codm`,
  `lime`); never hard-code a brand colour in a component.
- Tests are `*.test.mts` beside the code they cover and use `node:test` with
  `node:assert/strict`. There is no test-runner dependency and adding one needs a
  good reason. Import with the `.ts` extension (`allowImportingTsExtensions`).
- Comments explain *why* a non-obvious choice was made. Do not narrate the code.

## Definition of done

- `npm run check` passes, and `npm run build` succeeds.
- If you changed the UI, `DESIGN.md` still describes what you built; update it.
- If you changed behaviour a comment or doc calls out, update that too.
- If you changed agent instructions, run `npm run agents:sync` and commit the
  mirrors, or CI fails.
