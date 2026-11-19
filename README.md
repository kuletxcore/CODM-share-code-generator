# CODM Filter Lab

A fan-made colour filter share-code generator for Call of Duty: Mobile.

Live: https://codm.kuletxcore.workers.dev

- **Pick a look**: ready-made filters (Hajin, Apex, 2035, Avalon, Haven's Hollow, Haven's Hollow (Night), Al Mazrah, Vondead, Caldera, Verdansk, Cold War, Default) with one-tap copy and a Customize button that opens the look in the generator. Looks without a reference image show the preview scene with the look applied.
  - The footage-based looks (2035, Avalon, Haven's Hollow, Al Mazrah, Vondead, Caldera) are measured from gameplay videos and expressed relative to the pooled daytime footage of all the games sampled, so only what sets a game apart is kept. Expect subtle results; test in game.
- **Generator**: set hue, tint, saturation and brightness for shadows, midtones and highlights, see a live preview on a sample scene or your own screenshot, and copy the share code. The URL hash holds the current code, so links are shareable.
- **Screenshot → Code**: drop in a reference screenshot of the look you want (and, optionally, a CODM screenshot of the same kind of scene on the default filter). The page measures each tonal range and suggests a starting code. Everything runs in the browser; nothing is uploaded.

## Share code format

22 numbers joined by `_`. Worked out from shared codes and in-game screenshots, not from an official spec.

| Index | Meaning | Default |
| --- | --- | --- |
| 0 | selected Simple preset slot, 0–4 = Preset #1–#5 (confirmed) | 0 |
| 1 | enabled | 1 |
| 2 | Range bar shadows handle, 0–1000 (confirmed) | 30 |
| 3 | shadows falloff; the game writes handle + 100 after a drag | 300 |
| 4 | Range bar highlights handle, 0–1000 (confirmed) | 1000 |
| 5 | highlights falloff; handle + 100 after a drag | 1500 |
| 6–9 | group 1: the **Simple** Customize Color screen, whole image (confirmed) | `0_0_0_1000` |
| 10–13 | group 2: **shadows** (confirmed in game) | `0_0_0_1000` |
| 14–17 | group 3: **midtones** (confirmed in game) | `0_0_0_1000` |
| 18–21 | group 4: **highlights** (confirmed in game) | `0_0_0_1000` |

Each group is `hue_tint_brightness_saturation` (confirmed in game):

- hue `0–1000` = swatch × 125 + slider × 1.25. The 8 in-game swatches (red, orange, lime, green, cyan, blue, purple, magenta) are 45° apart and the 0–100 Hue slider moves towards the next one.
  - `1000` is a real value: Magenta with the slider at 100. It is not the same as `0` (Red at 0), and the codec round-trips it.
- tint `0–1000` = 0–100.
- brightness `-1000–1000` = 0–100 (raw 0 = 50, neutral). This is the only segment that can be negative.
- saturation `0–2000` = 0–100 (raw 1000 = 50, neutral).

`decode()` in `src/lib/codm.ts` enforces those ranges per segment and rejects a
code that does not match, rather than clamping it into something that only looks
accepted. `encode()` clamps to the same ranges, so anything the page copies is
always readable back. `SEGMENT_RANGES` is the single table both use.

The preview is an approximation of the in-game filter.

## Using a code in game

Settings → Audio and Graphics → pick a mode tab (MP Mode, BR Mode, DMZ: Recon, …) → that mode's Graphic Style → Import → Go → choose a Custom slot (1–5), paste into "Enter the Share code", then Apply. The format is the same in every mode. Share copies the current code; Customize Color edits it (DMZ: Recon only shows the style dropdown, Share and Import).

## Development

```bash
npm install
npm run dev
```

Checks (the same set CI runs, in `.github/workflows/ci.yml`):

```bash
npm run check      # typecheck + lint + test
```

- `npm run typecheck` — `tsc --noEmit`. Run this first on a fresh clone; see the note below.
- `npm run lint` — ESLint with the Next.js configs.
- `npm test` — `node --test` over `src/**/*.test.ts`. Node strips the TypeScript
  types itself, so there is no test runner dependency. The suite covers the share
  codec: segment ranges, strict rejection of malformed codes, round-tripping every
  shipped look, the hue swatch/slider split, and `analyse()` on frames missing a
  tonal band.
- `npm run build` — the static export.

Deploy (static export to a Cloudflare Worker named `codm`; `wrangler deploy` runs the build first, so Cloudflare Workers Builds works from a clean checkout):

```bash
npm run deploy
```

Stack: Next.js (static export), Tailwind CSS, Motion, three.js (background), Hitmarker typeface from the Call of Duty brand site.

### Gotcha: route types are generated

Next 16 writes `LayoutProps<'/'>` and friends into `.next/types/`, and generates
`next-env.d.ts`, which is **gitignored**. That means `next build` typechecks fine
on a fresh checkout while a bare `tsc --noEmit` fails with
`Cannot find name 'LayoutProps'`. `src/app/layout.tsx` therefore types `children`
explicitly instead of relying on the generated `LayoutProps`; keep it that way, or
typecheck has to run after a build.

## Disclaimer

A fan-made project. Not affiliated with, endorsed by or connected to Activision, TiMi Studio Group or Tencent. Call of Duty and Call of Duty: Mobile are trademarks of their respective owners.

## Design

Visual direction, tokens, layout states and the reasons behind them live in [DESIGN.md](DESIGN.md). Read it before changing UI.
