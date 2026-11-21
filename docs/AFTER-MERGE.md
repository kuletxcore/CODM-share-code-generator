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
| Kith | Kith (youtu.be/FpxFdjQg5bg) | CODM | **Replaced by the owner's in-game replication.** The rebuild had read the midtones tint as 90. In the video Kith raises it to 100 only to show the reddish cast it gives, then says to keep it at 1. A viewer's code (@WisdomSlaps) and a second viewer's list both gave 1. His narration, read from the video's captions, states every value: shadows Cyan, brightness 42→100, hue 66→90, saturation 49→65, tint 13→5; midtones brightness 50→80, saturation 50→65, hue 0→10, tint kept at 1 "to avoid an overly reddish look"; highlights hue and tint left untouched, saturation 30, brightness 50. The owner then set those values in CODM and exported the code. It shows the same numbers in game as the viewer's code, except for the highlights swatch, which is Orange as in the video (the viewer's had Red). |
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
