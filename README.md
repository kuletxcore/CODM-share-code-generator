# CODM Filter Lab

A fan-made colour filter share-code generator for Call of Duty: Mobile.

Live: https://codm.kuletxcore.workers.dev

- **Pick a look**: ready-made filters (Hajin, Apex, 2035, Avalon, Haven's Hollow, Haven's Hollow (Night), Al Mazrah, Vondead, Caldera, Verdansk, Cold War, Default) with one-tap copy and a Customize button that opens the look in the generator. Looks without a reference image show the preview scene with the look applied.
  - The footage-based looks (2035, Avalon, Haven's Hollow, Al Mazrah, Vondead, Caldera) are measured from gameplay videos and expressed relative to the pooled daytime footage of all the games sampled, so only what sets a game apart is kept. Expect subtle results; test in game.
- **Generator**: set hue, tint, saturation and brightness for shadows, midtones and highlights, see a live preview on a sample scene or your own screenshot, and copy the share code. The URL hash holds the current code, so links are shareable.
- **Screenshot → Code**: drop in a reference screenshot of the look you want (and, optionally, a CODM screenshot of the same kind of scene on the default filter). The page measures each tonal range, suggests a starting code, **Auto-matches** it by hill-climbing the nine zone controls, and scores the result out of 100 so you can see how close you are. Everything runs in the browser; nothing is uploaded.
- **Code anatomy**: collapsible panel in the editor that spells out all 22 numbers — name, raw value, the value a player reads in game, and whether it is actually in use. Tapping a group selects that zone.
- **Remix**: one keystroke (`R`) for a random but plausible grade drawn from eight curated moods.
- **Undo/redo**: `Ctrl/⌘ Z` and `Ctrl/⌘ ⇧ Z`, one step per gesture.
- **Per-look pages**: `/look/<slug>` for each look, statically generated with its own metadata, so a look can be linked and indexed on its own.
- **Installable**: web manifest plus an offline shell, so the tool keeps working next to the game on a bad connection. The last grade you were editing is kept on the device.

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
- tint `0–1000` = 0–100.
- brightness `-1000–1000` = 0–100 (raw 0 = 50, neutral).
- saturation `0–2000` = 0–100 (raw 1000 = 50, neutral).

The preview is an approximation of the in-game filter.

## Using a code in game

Settings → Audio and Graphics → pick a mode tab (MP Mode, BR Mode, DMZ: Recon, …) → that mode's Graphic Style → Import → Go → choose a Custom slot (1–5), paste into "Enter the Share code", then Apply. The format is the same in every mode. Share copies the current code; Customize Color edits it (DMZ: Recon only shows the style dropdown, Share and Import).

## Development

```bash
npm install
npm run dev          # http://localhost:3000
npm run verify       # lint + typecheck + tests, what CI runs
npm test             # vitest, codec and analyser only (fast, no DOM)
npm run build        # static export into out/
npm run deploy       # wrangler deploy (runs the build first)
npm run icons        # regenerate public/icons/*.png from the script
```

`npm run typecheck` runs `next typegen` first: the route types (`LayoutProps`,
`PageProps`) are generated, so a bare `tsc --noEmit` fails on a clean checkout.

Stack: Next.js (static export), Tailwind CSS, Motion, three.js (background), Hitmarker typeface from the Call of Duty brand site.

### Where things live

| Path | What it owns |
| --- | --- |
| `src/lib/codm.ts` | The whole domain: codec (`encode`/`decode`/`describeCode`), tone bands (`thresholds`, `zoneWeights`, `zoneShares`), the grade (`applyGrade`, `zoneOps`), the analyser (`analyse`), the fitter (`readReference`, `scoreReference`, `fitReference`), remix moods, and the shipped `PRESETS`/`LOOKS`. Pure functions, no DOM, unit-tested. |
| `src/lib/gpuGrade.ts` | The same grade as a WebGL fragment shader, with a self-test that reads a pixel back and a CPU fallback. |
| `src/lib/scene.ts` | The lit three.js scene used as the default preview image, rendered once into a 2D canvas. |
| `src/lib/share.ts` | QR matrix, the 1200×630 look card, downloads. Loaded on demand. |
| `src/lib/useHistory.ts` | Undo/redo, coalescing one gesture into one step. |
| `src/lib/previewBus.ts` | One-line pub/sub so the tone map repaints when the preview draws. |
| `src/lib/usePersistedCode.ts` | Last grade on this device. |
| `src/components/FilterLab.tsx` | The editor: preview, controls, converter, share bar, notes. |
| `src/components/LooksGallery.tsx` | The look stage, filmstrip and game chips. |
| `src/components/CodeAnatomy.tsx` | The 22-number inspector. |
| `src/components/TonalScope.tsx` | Histogram + Range handles + zone shares. |
| `src/components/ImportGuide.tsx` | The post-copy checklist, QR, look card, clipboard handling. |
| `src/components/LookDetail.tsx` | A look's own page. |
| `src/app/` | Routes: home, `/look/[slug]`, 404, error, manifest, robots, sitemap. |

### Keeping the two grades in step

`applyGrade` (CPU) and the shader in `gpuGrade.ts` implement the same maths; a
driver that draws nothing falls back to the CPU path, and the self-test in
`createGradeGpu` is what makes that detectable. If you change one, change the
other and run the `applyGrade` tests. `zoneOps()` is the single source for the
per-zone values both consume.

## Using a code when it does not work

- The share code is the same in every mode, but each mode has its own Graphic
  Style; a code applied in MP Mode does not carry over to BR Mode.
- DMZ: Recon only exposes the style dropdown, Share and Import — no Customize
  Color, so Advanced values cannot be edited there.
- The preview is an approximation. A code can look right on the sample scene and
  read differently in game; the analyser and the match score are starting
  points, not promises.
- If Copy reports "Copy blocked", the code is selected and `Ctrl/⌘ C` works.

## Disclaimer

A fan-made project. Not affiliated with, endorsed by or connected to Activision, TiMi Studio Group or Tencent. Call of Duty and Call of Duty: Mobile are trademarks of their respective owners.

## Design

Visual direction, tokens, layout states and the reasons behind them live in [DESIGN.md](DESIGN.md). Read it before changing UI.
