# Preview model notes

The live preview aims to follow Call of Duty: Mobile's Graphic Style colour filter as closely as a static screenshot allows. Findings are from the owner's private research on CODM version 1.0.60, written here as maths only.

The share-code codec is unchanged: 22 integers, units ×1000, brightness centred on 0, saturation centred on 1000, Range falloff = handle + 100.

## What the preview does

Controlled by `USE_GAME_KEY_MODEL` (default `true`) and `PIXEL_TRANSFER` (default `"aces"`) in `src/lib/codm.ts`. The GPU path in `src/lib/gpuGrade.ts` reads the same values from `gradeUniforms`. Flip `USE_GAME_KEY_MODEL` to restore the earlier screenshot-fitted key curves; set `PIXEL_TRANSFER` to `"reinhard-hdr"` to compare against the earlier Reinhard tone-map fit.

### Colour keys

For each of Simple, Shadows, Midtones and Highlights:

- **Hue** is a plain colour wheel with eight swatches 45° apart. The colour is `HSV(hue, tint, 1)` — at tint 100, Orange is `(1, 0.75, 0)`.
- **Tint** is linear (tint 25 is a weight of 0.25). There is no `^1.5` curve.
- **Brightness** is a single gain `1 + lerp(−1, 1, slider)`: 0× at 0, 1× at 50, 2× at 100, the same for every group.
- **Saturation** is `2 × slider` (0 at 0, 1 at 50, 2 at 100).
- **Zone colour** (Shadows, Midtones, Highlights) is also scaled by that colour's own Rec.601 luma (`0.299R + 0.587G + 0.114B`), so a strong tint darkens as well as shifts. Simple is multiplied in without that darkening.
- Zone tint uses the fused HSV wheel; a hue outside sectors −1..6 (raw outside −166..1166) gives black. Zone brightness is clamped to [−1, 1] and saturation to [0, 2] before the fold.
- Simple is then folded into each zone: RGB is multiplied, and saturations add around the neutral 1 (`zone + simple − 1`) with no clamp afterwards, so both at 100 give 3 and both at 0 give −1.
- **White balance:** every zone key is also multiplied by the master-temperature white balance (`rgb / Rec.601(rgb)` of the 6500 K colour, about `1.036, 0.978, 1.019`). Every shipped look uses 6500 K, so the reset code is not an identity in the game.
- **Range repair:** each Range value is clamped to 0–5 (raw / 1000), then walked left to right; a value not above the previous one becomes that value + 0.01 (including the midtone pair). No clamp after the repair.
- Key maths runs in float32 (`Math.fround` at each step); the keys match the reference model within 1 ULP.

**Preview baseline (assumption).** Screenshots were already rendered by the game with the neutral code, so they already carry the 6500 K white balance. The preview applies each key relative to the neutral code's key (`rgb / neutral rgb`; saturation and ramps unchanged), so the default code is an exact identity and is skipped. Absolute keys stay exported for parity tests. `SOURCE_BASELINE` in `src/lib/codm.ts` switches this (`"neutral"` or `"none"` for absolute keys); CPU and GPU both read the same plan.

There is no lookup table on this path.

### Per-pixel grade

The three folded zone keys are interpolated with two linear ramps, not applied as four sequential passes. For a pixel in linear light:

1. Luma is Rec.709, using the weights `0.2125R + 0.7154G + 0.0721B`.
2. Two ramps are read from that luma: `w1 = saturate(L·x + y)` between the shadows handle and its falloff, `w2 = saturate(L·z + w)` between the highlights handle and its falloff. The default range (30 / 300 / 1000 / 1500) gives ramps `(≈3.704, −0.111, 2, −2)`: Shadows fade into Midtones over luma 0.03–0.30, Midtones into Highlights over 1.0–1.5.
3. The key is `shadows + (midtones − shadows)·w1 + (highlights − midtones)·w2`.
4. Saturation runs first: `rgb = lerp(L, rgb, key.w)`.
5. Then colour and brightness: `rgb = key.rgb × rgb`.
6. Then a global exposure (1 on this preview, left as a named hook).

### Tone map, and static screenshots

`PIXEL_TRANSFER = "aces"` (the default) takes a static sRGB screenshot into linear light and back as:

1. Undo display gamma: `lin = srgb ^ 2.2`.
2. Invert the standard Narkowicz ACES tone map, `y = x(ax+b) / (x(cx+d)+e)` with `(a, b, c, d, e) = (2.51, 0.03, 2.43, 0.59, 0.14)`. The inverse is the unique non-negative root of that quadratic (with these coefficients, the minus root; the plus root is negative and must not be used). Inputs at or below `1e-4` have no unique inverse and map to 0, because the forward curve floors at `1e-4` before gamma encode. Display white inverts to a finite scene-linear value of about 7.24.
3. Run the grade above in that linear light.
4. Apply the same ACES curve, floor at `1e-4`, and encode with `pow(., 1/2.2)`.

Those ACES coefficients, the floor, and the inverse root are also named hooks (`ACES_A`…`ACES_E`, `ACES_FLOOR`) so a later finding can retune them without touching the codec. The earlier Reinhard path (`v = l/(1−l)` after gamma) remains selectable via `PIXEL_TRANSFER = "reinhard-hdr"`.

The site previews on static, already tone-mapped LDR screenshots, so this inverse is the practical way to recover a working linear range. It is exact on midtones for this curve, but ACES is many-to-one near and above its white point, so pre-tone-map highlights cannot be recovered uniquely. After the inverse, display values around 0.91 and up already map to scene-linear luma ≥ 1, so the default Highlights ramp *can* affect near-white regions of a still; that is expected, and it will still not match bloomed in-game highlights pixel-for-pixel.

A neutral (default) code is an exact identity: the pixel loop is skipped, so the tone-map round trip is not applied to an already-correct screenshot.

### What the preview leaves out

- **Quality tier.** Higher graphics tiers grade in HDR with a multi-pass tone map, lower tiers in one LDR pass. Some night modes cap the tier, so they always take the lower path. The preview models one path.
- **Battle Royale zones.** Some BR areas blend the frame into a different grade towards the edge of the zone (over the outer 30% of its radius), so the same code can look different in places on the BR map.
- **Damage overlay.** The red full-screen effect lerps the active grade towards a fixed red, on all four keys, by its intensity. It is not part of a code.
- **Auto-exposure.** Exposure can switch on at round reset and after some scorestreaks, which changes overall brightness without changing the code.

## What this replaced

The earlier preview applied four sequential zone passes and read band weights on display luma, with a Reinhard undo and several fitted constants (Rec.709 as `0.2126/0.7152/0.0722` in places, a `^1.5` tint curve, a 1.75 saturation cap, 2.4 / 3.3 brightness tops, smoothstep ramps, gamma-mapped handles). Those constants were absorbing the composition error and the missing tone map; they are still in this file behind `USE_GAME_KEY_MODEL = false` so the change is reversible, but they should not be re-tuned until this model is compared to in-game screenshots.

## Agreements that did not need a code change

The codec already had the right units, the handle + 100 falloff, and the Apex (Cranked) decoding.

## Reverting

- Keys: set `USE_GAME_KEY_MODEL` to `false`.
- Tone map only: set `PIXEL_TRANSFER` to `"reinhard-hdr"`.

The GPU shader follows both flags through `gradeUniforms`. Update the oracle in `src/lib/grade.test.ts` only if you change the grade maths itself.
