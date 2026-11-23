# Preview model notes

The live preview is still an approximation of Call of Duty: Mobile's Graphic Style colour filter. This page records where that approximation now follows the game's own colour-key maths, and where it still uses the earlier screenshot fit. Findings are from the owner's private research on CODM version 1.0.60. They are written here as maths only.

The share-code codec is unchanged: 22 integers, units ×1000, brightness centred on 0, saturation centred on 1000, Range falloff = handle + 100. Those rules already matched the game and are not part of this change.

## What the preview now uses

These are the keys the game builds before its per-pixel colour pass. The preview uses the same keys when `USE_GAME_KEY_MODEL` in `src/lib/codm.ts` is true (the default). Flip that flag to restore the earlier screenshot-fitted curves; keep `src/lib/gpuGrade.ts` in lockstep (it reads luma weights and the ramp style from the same place).

- **Hue** is a plain colour wheel with eight swatches 45° apart. The colour at a given hue and tint is `HSV(hue, tint, 1)`: at tint 100, Orange is `(1, 0.75, 0)`, not the stronger `(1, 0.84, 0)` the earlier fit measured.
- **Tint** is linear. Tint 25 is a weight of 0.25, tint 50 is 0.5. There is no `^1.5` curve.
- **Luma** uses Rec.601 weights: `0.299R + 0.587G + 0.114B`. The earlier fit used Rec.709 (`0.2126 / 0.7152 / 0.0722`).
- **Brightness** is a single gain `1 + lerp(−1, 1, slider)`, i.e. 0× at 0, 1× at 50, 2× at 100, the same for Simple, Shadows, Midtones and Highlights. There is no 2.4 / 3.3 split and no power curve below 50.
- **Saturation** is `2 × slider` (0 at 0, 1 at 50, 2 at 100). The Simple group's saturation is added into each zone (`zone + simple − 1`) rather than applied as a second multiply. There is no 1.75 constant.
- **Zone colour** (Shadows, Midtones, Highlights) is also scaled by that zone colour's own Rec.601 luma, so a strong tint darkens as well as shifts. The Simple group is multiplied in without that luma darkening.
- **Range blends** are linear ramps between the handle and its falloff, not smoothstep curves. The default range (handles 30 / 1000, falloffs 300 / 1500) still leaves Highlights inert: the fade-in starts at luma 1.0, above ordinary display white.
- There is no lookup table on this path.

## What was left alone, on purpose

The game's per-pixel shader — colour space, any tone mapping, and the exact order of saturation against tint — has not been confirmed. The preview still:

- converts the picture into linear HDR light with a Reinhard-style undo (`v = l / (1 − l)` after a 2.2 gamma),
- applies saturation as a luma-preserving chroma scale, then multiplies tint and exposure,
- converts back with the matching tone map and gamma.

Those steps came from fitting before/after screenshots ([AFTER-MERGE.md](AFTER-MERGE.md#7-calibrating-the-preview)). The fitted constants that this change removes (Rec.709, the `^1.5` tint curve, the 1.75 saturation cap, the 2.4 / 3.3 brightness tops, smoothstep ramps) may have been absorbing some of that unconfirmed shader stage. If a later look at the shader explains them, they can be restored or re-derived without touching the codec.

The hooks for that stage live next to `USE_GAME_KEY_MODEL` in `src/lib/codm.ts`: `PIXEL_TRANSFER` (currently `"reinhard-hdr"`), `DISPLAY_GAMMA`, and `REINHARD_WHITE`. The GPU shader reads the last two from `gradeUniforms`. Change those names when the colour space or tone map is known; do not add a second path before then.

The site previews on static screenshots. Those pictures are LDR and already tone-mapped, so the preview has to work from display-referred values. It still undoes a Reinhard-style map to get a working HDR-like range, which is why the default Highlights tab stays inert (its fade-in starts at luma 1.0). Pre-tone-map highlights above luma 1 cannot be recovered exactly from a static image, so any look that depends on those blown-out values will not match the game pixel-for-pixel on the samples or a screen test.

Range handle positions are now used as `handle / 1000` (0.03–0.30 for default Shadows, 1.0–1.5 for default Highlights). The earlier fit raised those values to `1/2.2` so they lined up with display luma. The space the game measures those ramps in is still unconfirmed; the raw positions are the conservative reading of the keys.

## Agreements that did not need a code change

The codec already had the right units, the handle + 100 falloff, the default Highlights range doing nothing, and the Apex (Cranked) decoding.

## Reverting

Set `USE_GAME_KEY_MODEL` to `false` in `src/lib/codm.ts`. The GPU shader follows that flag through `gradeUniforms`. Update the oracle in `src/lib/grade.test.ts` only if you change the grade maths itself.
