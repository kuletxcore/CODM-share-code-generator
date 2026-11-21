# After the merge

What changed on `claude-merge` after the arena round 2 merge was written up in [ARENA-MERGE-2.md](ARENA-MERGE-2.md). Five things happened:
- the three.js preview scene was replaced with real CODM frames
- three looks shared by creators were added
- their videos produced the first in-game evidence that tested the share-code rules
- one of those rules had to change as a result
- six more looks were added: four rebuilt from on-screen settings and two derived from footage

## 1. Real CODM scenes instead of the three.js render

**Why.** The preview drew a low-poly three.js scene: flat colours, few true shadows and a block for a gun. Only one remake (fae6c3f0) proposed replacing it, and it used an AI-generated stand-in frame. That branch was dropped as a whole page rewrite, but its premise held: a believable frame shows a grade better than a drawn one. A real CODM capture is better still, because the filter is meant for exactly that picture.

**Source.** The owner supplied MorganPixy's "CODM Season 10 2026 - New and Reworked Weapons Showcase". It is HUD-free and recorded on the default filter, and its chapters move across five maps.

**Choosing the frames.**
1. Frames were sampled every 6 s into contact sheets.
2. One frame was chosen per map. Each has deep shade, bright sky and saturated colour.
3. Frames with "RELOADING" or "LOW AMMO" text, aim-down-sights views and player names were rejected.

| Scene | Source game | Video time |
|---|---|---|
| Shipment 2019 (default) | Modern Warfare (2019) | 8:19 |
| Combine | Black Ops III | 4:20 |
| Hijacked | Black Ops II | 1:28 |
| Armada Strike | Black Ops Cold War | 5:30 |
| Crossfire | Call of Duty 4 | 12:09 |

**Map names.** The owner named the maps, and each name was checked against Activision's map snapshots and press coverage. The one correction was Armada → **Armada Strike**, the 6v6 version, which is the name in both Cold War and CODM.

**Result.**
- Each scene is a 1280×720 WebP of 41 to 51 KB, loaded only when chosen.
- That replaces about 185 KB of gzipped three.js plus a render on the phone.
- `src/lib/scene.ts` is deleted. three.js now only draws the smoke background.
- A row of 44px buttons under the preview switches scenes, and the video is credited beneath it.
- Gallery cards without their own image use the Shipment frame.
- The scene module is `src/lib/samples.ts`.

**Update: the owner's own captures.** All six scenes now use screenshots the owner took in CODM on default settings, cropped to 16:9 clear of the HUD at the edges, replacing MorganPixy's frames. A sixth scene, Firing Range (Black Ops, confirmed by Activision's CODM map snapshot), was added from the same batch.

## 2. Three looks shared by creators

| Look | Creator | Game chip | Source |
|---|---|---|---|
| MW2022 | MorganPixy | MWII | Pinned comment, youtu.be/DtpgvsKhR5w |
| MW2019 | MorganPixy | MW 2019 | Pinned comment, youtu.be/TImj7OGnM60 |
| Warzone | DisasterNinja | Black Ops 7 | Pinned comment, youtu.be/Kq2q9lV2VOY (4 Sep 2026) |

**Card images.** Each card is a frame from the creator's own video with the code applied. MW2019's frame is cropped clear of a picture-in-picture inset. Warzone's is cropped clear of the minimap, buttons, logo and player ID.

**"In game" label.** These images show the code in use, unlike the reference stills of the footage-based looks. A new `inGame` flag on a look makes the stage say "In game" instead of "Inspiration".

**Warzone's game chip.** The video was uploaded on 4 September 2026, while Warzone ran on Black Ops 7 (Season 05; Activision announced Season 06 for 17 September). Its map is Black Ops 6's Nuketown, identified by the owner from its house. "Special Forces Base" on the minimap is CODM's callout for a team spawn, not a map name, which is why a search for it found nothing.

## 3. In-game evidence for the share code

Two of the videos show the in-game Customize Color screen with the filter loaded. That gave settings to compare against the code, from creators who had no part in working out the format. Tests in `src/lib/codm.test.ts` pin each case.

| Video | In game | From the code | Agrees |
|---|---|---|---|
| MW2022, shadows | Orange, slider 0, Tint 40, Saturation 35, Brightness 100 | hue 125, tint 396, sat 697, bri 1000 → Orange 0, 39.6, 34.85, 100 | Yes |
| MW2022, Range | Shadows handle at about 18% of the bar | 189 | Yes |
| Warzone, Simple | Red 0, Tint 23, Saturation 77, Brightness 70 | 0, 232, 1531, 403 → Red 0, 23.2, 76.55, 70.15 | Yes |
| Warzone, shadows | Lime 0, Tint 17, Saturation 59, Brightness 78 | 250, 169, 1175, 552 → Lime 0, 16.9, 58.75, 77.6 | Yes |
| Warzone, Range | Both handles at the right end of the bar | shadows 974, highlights **1084** as posted | A typo (section 4) |

**What the evidence confirms:**
- the order of the four value groups
- hue = swatch × 125 + slider × 1.25
- tint ÷ 10
- saturation ÷ 20
- brightness offset from 0 = 50
- the game displays values rounded to whole numbers

**One quirk, left alone.** In the MW2022 video, midtones and highlights show **Tint 1** where the code has 0. The game probably never displays a tint below 1. The codec stays as it is: it would be guessing to change it, and 0 round-trips cleanly.

**The top of every range.** The owner exported a code with every slider and both Range handles pushed to the end: `0_1_0_100_1000_1100` then `125_1000_1000_2000` for each group. This confirms in game the upper limits `decode` enforces: tint 1000, brightness 1000, saturation 2000. It also confirms two more behaviours:
- Red with the Hue slider at 100 writes 125, the same value as Orange at 0, which is why the editor keeps the chosen swatch.
- Handles dragged to the ends of the Range bar write 0 and 1000, each falloff being the handle + 100. The bar itself stops at 1000, so DisasterNinja's 1084 (section 4) could not have come from dragging a handle.

A test pins this code.

## 4. A typo in a posted code, and a rule briefly loosened

**What happened.** DisasterNinja's posted code has the highlights handle at 1084, past the end of the 0–1000 bar, so `decode()` refused it. Every zone value in that code matched his video, and the video drew both handles at the right end, so the limit was loosened to accept handles past 1000.

**What the game says.** The owner tried importing the code in CODM, and the game refuses it, loading the default instead. The game is as strict as `decode()` was, so the limit is back: handles must be 0–1000. Hue, tint, brightness and saturation were never loosened.

**The correction.** The code's highlights falloff is 1094, and the game writes each falloff as handle + 100 (confirmed again by the all-100 export in section 3). So the handle was 994, and 1084 is a typo. The Warzone look uses `…974_1074_994_1094…`. The owner's in-game remake of the zone values (`0_226_403_1535` and `250_165_555_1182`) shows the same numbers in game as the posted code. A test pins the corrected code, and another checks that 1084 is rejected.

**Lesson.** A code posted as text can carry typos that a code copied from the game cannot. When a shared code breaks a limit, try importing it in the game before changing the codec.

## 5. Six more looks, two new ways of sourcing them

The creators shared their codes for their communities to use, and each look credits its creator, so no separate permission step was taken.

### Rebuilt from on-screen settings

None of these four videos posts a code in its description or pinned comment. Each one shows the in-game Customize Color pages, though. Sections 3 and 4 confirmed how the code maps to those numbers, so each code is rebuilt from what the screen shows.

- The game displays rounded numbers, so a rebuilt code can differ from the creator's own by about one raw step. It still shows the same numbers in game.
- `src/lib/codm.test.ts` checks that every rebuilt code reads back as the on-screen values.

| Look | Creator | Chip | What the video shows |
|---|---|---|---|
| Verdansk Low-End | Mr.CODM_PRO_YT (youtu.be/kRGy1BqMwgo) | CODM | Simple: Blue, Hue 94, Tint 12, Saturation 51, Brightness 44, Preset #1. The companion long video (youtu.be/Daevpv9sPao) shows the same panel at 4:58 and never opens Advanced; the frame sampling had missed it, and the owner pointed it out. The rest of that video is gameplay with the setting on. |
| MW2019 (HunterRafi) | HunterRafi (youtu.be/vi1WYrsuXDs) | MW 2019 | All four pages, plus Preset #2. The Range bar has no numbers, so its handles were measured in pixels at about 17.5% and 89%, calibrated on the MW2022 video, whose handles are known. |
| Kith | Kith (youtu.be/FpxFdjQg5bg) | CODM | **Replaced by the owner's in-game replication.** The rebuild had read the midtones tint as 90. In the video Kith raises it to 100 only to show the reddish cast it gives, then says to keep it at 1. A viewer's code (@WisdomSlaps) and a second viewer's list both gave 1. His narration, read from the video's captions, states every value: shadows Cyan, brightness 42→100, hue 66→90, saturation 49→65, tint 13→5; midtones brightness 50→80, saturation 50→65, hue 0→10, tint kept at 1 "to avoid an overly reddish look"; highlights on the swatch his hardcoded subtitles call "yellow" (the game's Orange) with hue slider and tint untouched, saturation 30, brightness 50. The owner then set those values in CODM and exported the code. It shows the same numbers in game as the viewer's code, except for the highlights swatch, which is Orange as in the video (the viewer's had Red). The owner tested both codes in game: both import and apply, and the owner kept the Orange one. |
| Serotonin | Serotonin (youtu.be/MvEatDU4eiE) | CODM | **Replaced by his own code**, posted in reply to a viewer. The rebuild was within one display step on every value. Two differences: his code puts both Range handles at the ends, and his midtones hue reads 96.8 where the video shows 98. No card: the video is 360p. |

**Filing.** Verdansk Low-End went under the new **CODM** chip rather than MW 2019, because it was made for CODM's own Verdansk, not to imitate MW 2019.

**What the shared codes taught.** Two of the four rebuilt looks later got real codes. Rebuilding from the screen held to display rounding. Its two weak points were values shown only as a demonstration (a frame can't tell a demo from a final setting) and the Range handles, which have no numbers on screen. A shared code is preferred whenever one exists.

**More evidence for the tint display.** HunterRafi's highlights also show Tint 1, which is the MW2022 display quirk again. Both read as raw 0.

### Derived from footage

These use the same method as 2035 and Avalon: per-video medians of the zone analysis, relative to the pooled daytime footage of 28 videos from the other games.

| Look | Sources | Result | Confidence |
|---|---|---|---|
| MWIII | Five multiplayer videos (the cluAqepnjEY slices cropped to the left 70% to remove the facecam), plus 429 in-game stills of 96 weapons from the archived IMFDB page | Cooler shadows; less saturated across the range; slightly darker shadows | Medium-high: the stills and the videos agree |
| Black Ops 6 | 396 in-game stills of 125 weapons from the archived IMFDB page, plus two weapon-inspect videos on one firing range and the first 15 s of a desert map | Darker, more saturated shadows; muted, slightly cool highlights | Medium: the stills and the videos agree, except on a green shadow cast that only the firing range showed and the stills drop |

**IMFDB stills.** The owner fetched the galleries from the Wayback Machine copies of the IMFDB pages, onto the `grok-refs` branch (1,200 images, 704 MB).
- They were used only as analysis input, never merged into the site's branch, because 704 MB would weigh down every clone and Cloudflare build.
- About a third were weapon renders on dark backdrops or menu shots. These were filtered out automatically: more than half dark, not roughly 16:9, or one flat backdrop colour.
- Each weapon's in-game shots count as one group, the way each video counts as one.
- Both looks were derived three ways (videos only, stills only, both). They agreed before the stills were pooled in.
- The stills may include campaign shots, which can be graded differently. Their agreement with the multiplayer videos suggests they don't skew the result.

**Cards for MWIII and Black Ops 6.** The video frames all carried HUD or player names, so the owner supplied clean screenshots: a rooftop pool for MWIII and Nuketown for Black Ops 6. Both were cropped clear of an ID string in the corner and are labelled "Inspiration", since they show the game, not the code applied.

**IMFDB access.** The live IMFDB pages serve a Cloudflare bot check to scripts, and it was not bypassed. The stills came from the archived copies instead (above).

**New chips.** `GAMES` gained **CODM**, **MWIII** and **Black Ops 6**.

## 6. The deferred list, built

The five ideas [ARENA-MERGE-2.md](ARENA-MERGE-2.md#deferred) deferred are now on the site. Each was rewritten, not ported, because every branch version had a bug noted at the time.

| Idea (branch) | What shipped | What changed from the branch |
|---|---|---|
| Recent and favourite codes (35a5bc8c, 5a181f54) | **Your codes**: the last 8 copied codes and up to 30 saved ones, under the editor, with Load, Copy, Rename and Remove | A recent entry is written once per copy, in the one function every copy passes through, never on a slider tick. Saving keeps the look's name, and Rename keeps the old name if the new one is blank. Entries are re-checked with the strict codec when read back, and other tabs stay in step. |
| A page per look (4d4b3931) | `/look/<slug>` for every look except Default, plus `/sitemap.xml` | The page shows the values as the game's Customize Color screens show them, not raw code slots. A look without its own still is previewed on a CODM scene, labelled as such, and its link preview uses the site card, never another look's image. Copy opens the same import guide. |
| Code bar that docks (fae6c3f0) | The share-code bar now sits at the top of the editor; a short bar with the code and Copy docks to the bottom only while the editor is on screen and that bar is not | The first phone screen no longer loses about 120px to a bar showing the default code under a gallery that has its own Copy. A shared link or QR hand-off now opens on the editor, where its code is. |
| "Needs tweaking" (5a181f54) | A button in the import guide that reopens the copied code in the editor, pinned | The branch's wipe clipped the wrong side. Here the pinned grade is drawn left of the divider by the same shader and CPU path as the original was, checked on both. |
| Duel links (9a3eb115) | **Pin this grade** plus **Copy compare link** (`#c=<code>&p=<pinned>`) | A separate duel view would have duplicated the preview. Pinning gives the same comparison inside the generator, including on a screen test, and the hash keeps it shareable. |

Checked with `npm run check` (32 tests, including the hash format, the stored-codes cleanup and unique look slugs), `npm run build` (20 look pages), and Chromium at 390 and 1440 wide: the dock stays off the first screen, the pinned grade lands on the left of the wipe on both the GPU and the CPU path, and a look page's Customize and Needs tweaking open the generator on that code.

## 7. Calibrating the preview

In-game tests showed every creator code imports correctly, but the preview showed most looks three to four times stronger than the game. A Kith test brightened the sky by 24 in game against 76 in the preview; Apex changed about 4% of pixels by more than 10. The owner then took before/after screenshots that each change one setting: Firing Range, Nuketown, a set in `pics/` taken on an Oppo F11 at Low graphics, and a second set in `pics/Batch 2/` taken in the Practice Range on an Infinix GT50 Pro at Max graphics, and a third in `pics/F11 Low/` (Practice Range, F11 at Low, camera held still, plus Brightness 25 and Saturation 25 on the Infinix in `Extras/`).

What the game does, and the preview now does:
- **It grades in linear HDR light before a tone map.** Undoing a Reinhard-style tone map (`v = l / (1 − l)` on linear light) turns every test into simple gains that hold from darks to near-white. This is why effects fade near white.
- **Tint multiplies by the swatch colour.** Its weight is `1 − (1 − tint/100)^1.5`: 0.33 at Tint 25, 0.65 at 50, 1 at 100. Simple Red 100 keeps red and takes green and blue to zero. The swatches are not a plain hue wheel: measured at Tint 100, their second channel is stronger (Orange 1, 0.84, 0; Lime 0.59, 1, 0; Green 0, 1, 0.42; Cyan 0, 0.91, 1; Blue 0, 0.35, 1; Purple 0.54, 0, 1; Magenta 1, 0, 0.92), and the Hue slider blends towards the next swatch.
- **A Shadows, Midtones or Highlights tint darkens too.** On top of the same colour shift as the Simple tab, red keeps about 0.54 at Tint 50 and 0.17 at 100 (the Simple tab keeps all of it). Bright colours darken less: Cyan 100 keeps about 0.78, so the preview scales the darkening by the swatch's own luminance. This is why creator looks raise zone brightness above 50.
- **Saturation runs before the tint.** Saturation 0 with Red 25 gives a red-tinted grey. Saturation 100 scales colour by about 1.75.
- **Brightness is exposure.** 0 is black, 25 is a gain of about 0.34, 100 about 2.4, rising in a straight line above 50. Shadows Brightness 100 is stronger, about 3.3 in the darks.
- **The Range handles are positions in linear light.** With the default range, shadows fade out between display luminance 0.2 and 0.58. Highlights fade *in* from the highlights handle to its falloff, so on the default range (1000, 1500) Highlights changes nothing: the F11 Highlights Red 100 shot is identical to the default. Most creator codes keep the default range, so their Highlights settings do nothing in game.

Mean error per pixel, preview against game (0–255), with "no change" as the baseline:

| Test | No change | Old preview | Now |
|---|---|---|---|
| Firing Range: Simple Red 50, Midtones Saturation 0 | 34.7 | sky 255 76 76 vs 158 106 109 | 5.5 |
| Nuketown: Simple Red 100 | 109.1 | | 7.0 |
| Nuketown: Simple Blue 50 | 27.7 | | 11.4 |
| Nuketown: Simple Brightness 100 | 34.3 | 2× gain, clipped | 11.0 |
| F11: Simple Red 25 | 14.6 | | 5.9 |
| F11: Simple Red 25, Saturation 0 | 15.8 | | 6.6 |
| F11: Simple Saturation 100 | 15.0 | | 9.8 |
| F11: Simple Brightness 0 | 134.0 | | 1.5 |
| F11: Shadows Red 100 | 17.0 | | 8.3 |
| F11: Midtones Red 100 | 90.4 | | 12.6 |
| F11: Highlights Red 100 | 5.8 (frame noise) | | 5.8 |

The Infinix set was compared by percentiles of the same region, because the camera moved slightly between the default and the tests. Mean error per channel percentile, preview against game:

| Infinix GT50 Pro, Max graphics | No change | Now |
|---|---|---|
| Simple swatches at Tint 100 (seven) | 32.7–48.4 | 4.8–8.2 |
| Simple Red 25 | 6.4 | 2.1 |
| Simple Brightness 75 | 18.2 | 2.1 |
| Midtones Red 50 | 18.3 | 2.0 |
| Midtones Brightness 100 | 8.6 | 2.6 |
| Shadows Brightness 100 | 24.3 | 9.9 |
| Midtones Red 100 | 31.5 | 14.7 |

The third set, with the camera held still, compared pixel by pixel (mean error per channel, 0–255):

| F11 Low, Practice Range | No change | Now |
|---|---|---|
| Shadows Red 100, shadows handle at about 470 | 47.6 | 3.5 |
| Shadows Brightness 100 | 24.0 | 5.2 |
| Midtones Cyan 100 | 8.2 | 4.2 |
| Midtones Red 24 | 3.8 | 2.1 |
| Simple Brightness 25 | 22.8 | 4.2 |
| Simple Saturation 25 | 2.9 | 2.0 |
| Kith, imported | 26.4 | 7.4 |
| Infinix: Simple Brightness 25 / Saturation 25 | 25.1 / 3.8 | 3.9 / 2.7 |

The handle positions were read off the Range bar in the screenshots, with each falloff at handle + 100 as the game writes it once a handle moves.

**A real code as a final check.** A code from a Reddit post (`0_1_77_177_512_612_33_153_118_1492_0_55_-84_2000_200_297_210_866_123_97_176_490`, both Range handles moved, every group set) was tried in game on Nuketown's airport. Mean error against the game screenshot: no change 11.3, the old preview 37.8, the calibrated preview with a square-root brightness rise 14.8, and with the straight-line rise 7.2. The square-root rise had fitted the Infinix Brightness 75 shot best (2.1, against 4.1 for the straight line), but it made small brightness steps like this code's 56 and 61 far too bright, so the straight line was kept.

The same model fits both phones and both quality settings, so the preview needs no per-device setting. Midtones Red 100 looked weak on the Infinix only because the Practice Range scene is dark: most of it sits in Shadows.

Known gaps: with the highlights handle moved to about 490, the game tinted only a narrow band of bright, not-quite-white pixels and left white alone, where the preview tints everything above the handle; the Highlights band shape is still a guess (on the default range it is empty either way). Zone darkening is measured for red and cyan only.

The screen-test analyser runs the same model forward, so a known midtones tint or brightness reads back exactly.

The looks derived from footage were tuned against the old preview, so in game they are several times too faint. Re-deriving them is the next step.

## 8. The footage looks, re-derived

The looks measured from gameplay footage were tuned so that the earlier preview matched the footage. With the calibrated preview, those codes no longer give that result in game. Each was re-derived: the six sample scenes were graded with the earlier preview and the old code (the target), and a search found the code whose calibrated, in-game result comes closest. The search sets the Simple group, Shadows and Midtones, and keeps the default Range bar, on which Highlights changes nothing in game.

The owner chose to keep both: the faithful code under the look's own name, and a **(Cranked)** variant, named after the Call of Duty game mode, fitted to twice the difference from typical footage so the look reads clearly in game.

Mean error per channel (0–255) on the six sample scenes against the target. "Footage difference" is how far the target is from the untouched scene; Cranked is measured against its own, doubled target.

| Look | Footage difference | Old code in game | Faithful | Cranked |
|---|---|---|---|---|
| Hajin | 5.7 | 7.2 | 2.6 | 4.8 |
| Apex | 5.8 | 6.6 | 2.5 | 4.5 |
| 2035 | 3.5 | 4.5 | 1.4 | 2.5 |
| Avalon | 3.1 | 2.5 | 1.4 | 2.6 |
| Haven's Hollow | 2.0 | 1.9 | 1.8 | 3.3 |
| Haven's Hollow (Night) | 30.2 | 26.1 | 5.4 | 14.9 |
| Black Ops 6 | 7.3 | 8.8 | 2.7 | 4.6 |
| MWIII | 9.2 | 10.2 | 3.4 | 5.4 |
| Al Mazrah | 3.2 | 2.9 | 1.9 | 2.5 |
| Vondead | 9.0 | 4.4 | 2.2 | 3.7 |
| Caldera | 3.3 | 2.6 | 0.9 | 1.6 |
| Verdansk | 2.7 | 3.1 | 1.5 | 3.0 |

- The footage differences are small, so the faithful codes stay subtle in game; that is what the footage showed. The Cranked variants are an exaggerated take, and their notes say so.
- Haven's Hollow (Night) is the least certain: its darkening leans on zone tint darkening for a blue hue, which has only been measured for red and cyan.
- Each look's comment in `src/lib/codm.ts` keeps its previous code.

## Checks

Every change above was checked with:
- `npm run check`: lint, typecheck and 25 tests
- `npm run build`
- Chromium at desktop and Pixel 7 sizes

GitHub CI and the Cloudflare preview build passed on each push. All downloaded videos were deleted after the frames were taken.

## Still open

- **Test on a phone.** Try the scene picker and the screen test on the [preview](https://claude-merge-codm.kuletxcore.workers.dev), then import one creator look in CODM and compare.
- **Find the handle's real maximum.** Importing a code with the highlights handle at a very large value would show whether the game clamps it or refuses the code.
- **A card for Serotonin.** His video is 360p; a clean screenshot of the look in game would give it a card.
