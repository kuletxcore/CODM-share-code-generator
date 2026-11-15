# CODM Filter Lab

A fan-made colour filter share-code generator for Call of Duty: Mobile.

Live: https://codm.kuletxcore.workers.dev

- **One bench, one screen**: a live monitor grades in real time. Pick any look from the shelf and it lands on the image in front of you — and it keeps working on your own screenshot.
- **Look shelf**: 12 ready-made filters (Hajin, Apex, 2035, Avalon, Haven's Hollow, Haven's Hollow (Night), Al Mazrah, Vondead, Caldera, Verdansk, Cold War, Default). Every tile is that code run on the frame in the monitor, so the shelf is a contact sheet of what you'd actually get; switch it to Stills to see the reference photos. Tap to apply, tap Shuffle for a random one.
  - The footage-based looks (2035, Avalon, Haven's Hollow, Al Mazrah, Vondead, Caldera) are measured from gameplay videos and expressed relative to the pooled daytime footage of all the games sampled, so only what sets a game apart is kept. Expect subtle results; test in game.
- **Tone map instead of a Range bar**: the two in-game handles sit on the image's own luminance histogram, so you can see which tones each colour is about to touch. Drag them to move where shadows end and highlights begin; the code is written exactly the way the game writes it (handle + 100).
- **Readout in plain words**: each tone group shows its swatch, hue position and tint/saturation/brightness; click one to jump to it in the editor.
- **Compare by dragging**: drag across the frame to wipe between the original and the grade (or hit Compare). The canvas only ever holds the full grade — the original is clipped over it — so the wipe always shows real before/after pixels.
- **Grading proof**: on first use the WebGL pipeline is run once on a grey frame and read back; if the driver quietly draws nothing, the preview falls back to the CPU rather than showing an ungraded image.
- **Editor**: Simple (whole image, Preset #1–#5) or Advanced (shadows / midtones / highlights, each with hue, tint, saturation and brightness). The URL hash holds the current code, so links are shareable.
- **Screenshot → Code**: "Match a screenshot" measures a reference picture (and, optionally, a CODM screenshot of the same kind of scene on the default filter) and suggests a starting code. Everything runs in the browser; nothing is uploaded.
- **Copying**: the code is docked to the monitor on every screen size. Copying opens a step-by-step import guide that stays until you're done.

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
