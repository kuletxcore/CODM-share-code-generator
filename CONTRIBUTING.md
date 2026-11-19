# Contributing

A small, single-purpose tool. The bar for a change is that it either fixes
something a player hits or removes a step between arriving and pasting a code
into CODM.

## Before you open a PR

```bash
npm ci
npm run verify     # lint, typecheck, tests
npm run build      # the deploy is a static export, so this is the real check
```

`main` deploys straight to production, so CI runs the same four gates on every
pull request.

## What needs tests

Pure logic in `src/lib/codm.ts` — the codec, the tone bands, the analyser, the
fitter, remix. It has no DOM and is cheap to test; `src/lib/codm.test.ts` is the
place. Behaviour that needs a browser (canvas, WebGL, clipboard) is checked by
hand and described in the PR.

Two invariants are load-bearing and have tests:

- every shipped code round-trips (`encode(decode(code)) === code`) — see
  `SHIPPED` in `codm.test.ts`;
- the analyser is neutral when the reference is the screen itself.

## Adding a look

Looks are claims, and the site's rule is that no claim ships without a source.

1. Derive the values from footage or screenshots; say how many and which.
2. Put the code in `LOOKS` with a `slug`, a `game` and a one-line `note` that
   says what the look is, not how it feels ("MWII Warzone: dusty, desaturated,
   lifted shadows").
3. Add the reference still to `public/looks/` and a 352×161 thumbnail to
   `public/looks/thumb/` if the look has an image.
4. If it came from footage, write the derivation in the comment above the entry,
   in the same voice as the existing ones.
5. `npm test` must still pass: every look is a round-trip fixture, and
   `/look/<slug>` is generated from `LOOKS` at build time, so the sitemap and the
   404 page pick it up automatically.

If the numbers are a guess rather than a measurement, say so in the note or do
not ship it.

## Style

- TypeScript, strict. No `any` without a reason in a comment.
- Comments explain why, not what. The existing files are the reference.
- Copy is sentence case and plain: no marketing, no invented system status.
- UI changes: read `DESIGN.md` first, and update it if a decision changes.
- Accessibility is part of done: focus visible, 44px targets, roles on custom
  controls, and the keyboard path works.

## Commits

One idea per commit, imperative mood, with a body that says what was wrong and
why the change fixes it.
