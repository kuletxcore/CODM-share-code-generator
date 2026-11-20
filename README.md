# CODM Filter Lab

A fan-made colour filter share-code generator for Call of Duty: Mobile.

Live: https://codm.kuletxcore.workers.dev

- **Pick a look**: ready-made filters (Hajin, Apex, 2035, Avalon, Haven's Hollow, Haven's Hollow (Night), Al Mazrah, Vondead, Caldera, Verdansk, Cold War, Default) with one-tap copy and a Customize button that opens the look in the generator. Looks without a reference image show the preview scene with the look applied.
  - The footage-based looks (2035, Avalon, Haven's Hollow, Al Mazrah, Vondead, Caldera) are measured from gameplay videos and expressed relative to the pooled daytime footage of all the games sampled, so only what sets a game apart is kept. Expect subtle results; test in game.
- **Find your vibe**: six hand-tuned Advanced starting points (Visibility, Cinematic, Night Ops, Warm Daylight, Cool Overcast, Vivid Pop) plus "Surprise me". One tap loads the code and jumps to the generator — no sliders for players who just want a usable code. Each vibe's numbers are built with the same encoder as the generator, so they can never drift from the documented format.
- **Generator**: set hue, tint, saturation and brightness for shadows, midtones and highlights, see a live preview on a sample scene or your own screenshot, and copy the share code. The URL hash holds the current code, so links are shareable.
- **Mission Console** (the bar pinned to the bottom of the screen): the code, a one-tap Copy with a "1 Copy → 2 Import → 3 Play" progress line, `C` to copy from the keyboard, `1`/`2`/`3` to switch zones, an expandable "How to import" panel with the in-game steps, a QR for handing the code to a phone, a share-card button, and paste-a-code loading. Copying from the console does not open the full-screen import dialog — the steps are already on screen.
  - **Recent + favorites** live in `localStorage` on this device only (`codm-history`, `codm-favorites`), so an OS-cleared clipboard never loses a grade. Nothing is uploaded; the panel labels them "on this device".
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
- tint `0–1000` = 0–100.
- brightness `-1000–1000` = 0–100 (raw 0 = 50, neutral).
- saturation `0–2000` = 0–100 (raw 1000 = 50, neutral).

The preview is an approximation of the in-game filter.

## Using a code in game

Settings → Audio and Graphics → pick a mode tab (MP Mode, BR Mode, DMZ: Recon, …) → that mode's Graphic Style → Import → Go → choose a Custom slot (1–5), paste into "Enter the Share code", then Apply. The format is the same in every mode. Share copies the current code; Customize Color edits it (DMZ: Recon only shows the style dropdown, Share and Import).

## Metadata

`src/app/sitemap.ts`, `robots.ts` and `manifest.ts` are static-export friendly (`export const dynamic = "force-static"`). The social card is `public/looks/og.png` (referenced from `layout.tsx`). Update the `BASE` constant in those three files if the deployment URL changes.

## Development

```bash
npm install
npm run dev
```

Deploy (static export to a Cloudflare Worker named `codm`; `wrangler deploy` runs the build first, so Cloudflare Workers Builds works from a clean checkout):

```bash
npm run deploy
```

Stack: Next.js (static export), Tailwind CSS, Motion, three.js (background), Hitmarker typeface from the Call of Duty brand site.

## Disclaimer

A fan-made project. Not affiliated with, endorsed by or connected to Activision, TiMi Studio Group or Tencent. Call of Duty and Call of Duty: Mobile are trademarks of their respective owners.

## Design

Visual direction, tokens, layout states and the reasons behind them live in [DESIGN.md](DESIGN.md). Read it before changing UI.
