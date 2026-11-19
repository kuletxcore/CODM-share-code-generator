# CODM Filter Lab

A fan-made colour filter share-code generator for Call of Duty: Mobile.

Live: https://codm.kuletxcore.workers.dev

- **Try a look on a frame**: one game frame fills the top of the page. Right of a draggable divider it shows the current filter, left of it the untouched original. Pick any of the 12 looks in the strip under it (Hajin, Apex, 2035, Avalon, Haven's Hollow, Haven's Hollow (Night), Al Mazrah, Vondead, Caldera, Verdansk, Cold War, Default) and the frame, the controls and the code switch together, so **Copy code** always copies what the frame shows. After a copy the in-game steps open.
  - The footage-based looks (2035, Avalon, Haven's Hollow, Al Mazrah, Vondead, Caldera) are measured from gameplay videos and expressed relative to the pooled daytime footage of all the games sampled, so only what sets a game apart is kept. Expect subtle results; test in game.
  - The strip thumbnails and the card beside the frame show the reference still a look is chasing; the frame shows what the code does.
- **Tune it**: the game's own controls (Simple, or Advanced with shadows, midtones, highlights and range) act on that same frame. Any change turns the filter into **Your mix**, which stays in the strip and is remembered in the browser, so trying another look never throws it away. Paste a code to edit it. The URL hash holds the current code and **Share** hands out the link.
- **Use my screenshot**: swap the sample frame for a screenshot of your own, by button or by dropping a file on the frame.
- **Match a screenshot**: drop in a reference screenshot of the look you want (and, optionally, a CODM screenshot of the same kind of scene on the default filter). The page measures each tonal range and suggests a starting code, which you can put on the frame. Everything runs in the browser; nothing is uploaded.

The sample frame (`public/sample/`) is an AI-generated stand-in, not a CODM capture: a neutral, ungraded first-person scene with sky, foliage, painted walls, deep shadows and a weapon, so every zone of a filter has something to act on. To use a real capture, replace `frame.webp` (1280×720), `frame-800.webp` (800×450) and `frame-thumb.webp` (352×161, a 16:7 crop) and keep the sizes in `src/lib/frame.ts` in step.

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

The preview is an approximation of the in-game filter. It runs as a WebGL shader and falls back to the same maths on the CPU.

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

Stack: Next.js (static export), Tailwind CSS, Motion, plain WebGL (frame grading and the smoke background), Hitmarker typeface from the Call of Duty brand site.

The link preview card is `src/app/opengraph-image.jpg` (1200×630); its absolute URL comes from `metadataBase` in `src/app/layout.tsx`.

## Disclaimer

A fan-made project. Not affiliated with, endorsed by or connected to Activision, TiMi Studio Group or Tencent. Call of Duty and Call of Duty: Mobile are trademarks of their respective owners.
