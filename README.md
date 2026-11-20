# CODM Filter Lab

A fan-made colour filter share-code generator for Call of Duty: Mobile.

Live: https://codm.kuletxcore.workers.dev

- **Pick a look**: ready-made filters (Hajin, Apex, 2035, Avalon, Haven's Hollow, Haven's Hollow (Night), Al Mazrah, Black Ops 6, MWIII, Vondead, MW2022, MW2019, MW2019 (HunterRafi), Warzone, Caldera, Verdansk, Cold War, Verdansk Low-End, Kith, Serotonin, Default) with one-tap copy and a Customize button that opens the look in the generator. Looks without a reference image show the preview scene with the look applied.
  - MW2022 and MW2019 are MorganPixy's own codes and Warzone is DisasterNinja's, each from the pinned comment of the creator's filter video. The MW2022 and Warzone videos show the in-game settings, which match the codes exactly.
  - Serotonin's code is his own, posted under his video. Kith's is the site owner's own in-game replication of the settings his video shows. MW2019 (HunterRafi) and Verdansk Low-End are rebuilt from the settings screens in each creator's video (no code was posted), to the game's display rounding. Each look credits its creator.
  - The footage-based looks (2035, Avalon, Haven's Hollow, Al Mazrah, Vondead, Caldera, MWIII, Black Ops 6) are measured from gameplay videos and expressed relative to the pooled daytime footage of all the games sampled, so only what sets a game apart is kept. Expect subtle results; test in game.
- **Screen test**: drop one CODM screenshot (or paste it with Ctrl+V) and every look in the gallery, plus the generator's preview, is graded on your own frame (an approximation of the in-game filter). Hold Compare to see the ungraded original. Look cards you save then show your screenshot. Nothing is uploaded; the shot stays in the tab.
- **Generator**: set hue, tint, saturation and brightness for shadows, midtones and highlights, see a live preview on one of six real CODM scenes or your own screenshot, and copy the share code. The URL hash holds the current code, so links are shareable.
- **Screenshot → Code**: drop in a reference screenshot of the look you want (and, optionally, a CODM screenshot of the same kind of scene on the default filter). The page measures each tonal range and suggests a starting code. Everything runs in the browser; nothing is uploaded.

## Share code format

22 numbers joined by `_`. Worked out from shared codes and in-game screenshots, not from an official spec.

| Index | Meaning | Default |
| --- | --- | --- |
| 0 | selected Simple preset slot, 0–4 = Preset #1–#5 (confirmed) | 0 |
| 1 | enabled | 1 |
| 2 | Range bar shadows handle, 0–1000 on the bar (confirmed); game-written codes can go past 1000 and the handle is drawn at the end | 30 |
| 3 | shadows falloff; the game writes handle + 100 after a drag | 300 |
| 4 | Range bar highlights handle, as above (1084 seen in a game-written code) | 1000 |
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

Needs Node 22.18 or later (`.node-version` pins 22).

```bash
npm install
npm run dev
```

Before pushing, run the same checks as CI (lint, type check, and the share-code tests in `src/lib/codm.test.ts`):

```bash
npm run check
```

The tests cover the share-code codec: every look and preset must round-trip unchanged, and malformed or out-of-range codes must be rejected. Add a test when you touch `encode` or `decode`; new looks are covered automatically.

Deploy (static export to a Cloudflare Worker named `codm`; `wrangler deploy` runs the build first, so Cloudflare Workers Builds works from a clean checkout):

```bash
npm run deploy
```

Stack: Next.js (static export), Tailwind CSS, Motion, three.js (background), Hitmarker typeface from the Call of Duty brand site.

Preview scenes (`public/samples/`) are CODM screenshots the owner captured on the default filter, cropped clear of the HUD.

## Disclaimer

A fan-made project. Not affiliated with, endorsed by or connected to Activision, TiMi Studio Group or Tencent. Call of Duty and Call of Duty: Mobile are trademarks of their respective owners.

## Design

Visual direction, tokens, layout states and the reasons behind them live in [DESIGN.md](DESIGN.md). Read it before changing UI.

AI coding agents (any tool) start from [AGENTS.md](AGENTS.md); `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md` and `.aider.conf.yml` only point to it.
