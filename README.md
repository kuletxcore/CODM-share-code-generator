# CODM Filter Lab

A fan-made colour filter share-code generator for Call of Duty: Mobile.

Live: https://codm.kuletxcore.workers.dev

- **Pick a look**: ready-made filters, each shown as a real in-game capture taken with that exact code, with one-tap copy and a Customize button that opens the look in the generator.
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
- tint `0–1000` = 0–100.
- brightness `-1000–1000` = 0–100 (raw 0 = 50, neutral).
- saturation `0–2000` = 0–100 (raw 1000 = 50, neutral).

The preview is an approximation of the in-game filter.

## Using a code in game

Settings → Audio and Graphics → pick a mode tab (MP Mode, BR Mode, DMZ: Recon, …) → that mode's Graphic Style → Import → Go → choose a Custom slot (1–5), paste into "Enter the Share code", then Apply. The format is the same in every mode. Share copies the current code; Customize Color edits it (DMZ: Recon only shows the style dropdown, Share and Import).

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
