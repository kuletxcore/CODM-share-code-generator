# CODM Filter Lab

A fan-made colour filter share-code generator for Call of Duty: Mobile.

Live: https://codm.kuletxcore.workers.dev

- **Generator**: set hue, tint, saturation and brightness for shadows, midtones and highlights, see a live preview on a sample scene or your own screenshot, and copy the share code. The URL hash holds the current code, so links are shareable.
- **Screenshot → Code**: drop in a reference screenshot of the look you want (and, optionally, a CODM screenshot of the same kind of scene on the default filter). The page measures each tonal range and suggests a starting code. Everything runs in the browser; nothing is uploaded.

## Share code format (inferred)

22 numbers joined by `_`. Worked out from shared codes, not from an official spec:

| Index | Meaning | Default |
| --- | --- | --- |
| 0 | preset flag (0 default, 2 custom) | 0 |
| 1 | enabled | 1 |
| 2 | unknown | 30 |
| 3 | shadow range | 300 |
| 4 | unknown | 1000 |
| 5 | highlight range | 1500 |
| 6–9, 10–13, 14–17, 18–21 | groups of hue, tint, saturation, brightness: shadows, midtones, highlights, and a 4th group | `0_0_0_1000` |

Within a group: hue `0–1000` = 0–360°, tint `0–1000` = 0–100, saturation `-1000–1000` = 0–100 (50 neutral), brightness `0–2000` = 0–100 (50 neutral).

The group order, range values and the 4th group are unconfirmed, and the preview is an approximation of the in-game filter.

## Development

```bash
npm install
npm run dev
```

Deploy (static export to a Cloudflare Worker named `codm`):

```bash
npm run deploy
```

Stack: Next.js (static export), Tailwind CSS, Motion, three.js (background), Hitmarker typeface from the Call of Duty brand site.

## Disclaimer

A fan-made project. Not affiliated with, endorsed by or connected to Activision, TiMi Studio Group or Tencent. Call of Duty and Call of Duty: Mobile are trademarks of their respective owners.
