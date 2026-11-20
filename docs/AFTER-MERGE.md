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
| Warzone, Range | Both handles at the right end of the bar | shadows 974, highlights **1084** | Changed a rule (below) |

**What the evidence confirms:**
- the order of the four value groups
- hue = swatch × 125 + slider × 1.25
- tint ÷ 10
- saturation ÷ 20
- brightness offset from 0 = 50
- the game displays values rounded to whole numbers

**One quirk, left alone.** In the MW2022 video, midtones and highlights show **Tint 1** where the code has 0. The game probably never displays a tint below 1. The codec stays as it is: it would be guessing to change it, and 0 round-trips cleanly.

## 4. The rule that changed: Range handles past 1000

**The problem.** `decode()` rejected any Range handle above 1000, because the README listed 0–1000 as confirmed. DisasterNinja's code has the highlights handle at 1084, so the site could not load it.

**The evidence.** Every other value in that code matches the video's settings screen exactly, and the game draws both handles at the right end of the bar. So the game itself writes, and accepts, handles past the end. AGENTS.md rule 3 allows codec changes only with in-game evidence, and this is that evidence.

**The change.**
- `decode()` now only requires the two handles to be non-negative, which is the rule the falloffs already followed. Their upper limit isn't known.
- The tone map draws a handle past 1000 at the end of the bar, as the game does. Grading already clamped it.
- A shared link keeps such a code unchanged.
- Hue, tint, brightness and saturation stay strictly range-checked.

## 5. Six more looks, two new ways of sourcing them

The creators shared their codes for their communities to use, and each look credits its creator, so no separate permission step was taken.

### Rebuilt from on-screen settings

None of these four videos posts a code in its description or pinned comment. Each one shows the in-game Customize Color pages, though. Sections 3 and 4 confirmed how the code maps to those numbers, so each code is rebuilt from what the screen shows.

- The game displays rounded numbers, so a rebuilt code can differ from the creator's own by about one raw step. It still shows the same numbers in game.
- `src/lib/codm.test.ts` checks that every rebuilt code reads back as the on-screen values.

| Look | Creator | Chip | What the video shows |
|---|---|---|---|
| Verdansk Low-End | Mr.CODM_PRO_YT (youtu.be/kRGy1BqMwgo) | CODM | Simple: Blue, Hue 94, Tint 12, Saturation 51, Brightness 44. A companion long video (youtu.be/Daevpv9sPao) is gameplay only, with no settings shown, so it was not used. |
| MW2019 (HunterRafi) | HunterRafi (youtu.be/vi1WYrsuXDs) | MW 2019 | All four pages, plus Preset #2. The Range bar has no numbers, so its handles were measured in pixels at about 17.5% and 89%, calibrated on the MW2022 video, whose handles are known. |
| Kith | Kith (youtu.be/FpxFdjQg5bg) | CODM | His walkthrough changes values as he talks, so the final state of each page is used. Later footage showing other values is background footage. |
| Serotonin | Serotonin (youtu.be/MvEatDU4eiE) | CODM | A tutorial that tries several colours. The look is the state he saves in the closing recap, plus the last Shadows page shown. No card: the video is 360p, so the look shows on the preview scene. |

**Filing.** Verdansk Low-End went under the new **CODM** chip rather than MW 2019, because it was made for CODM's own Verdansk, not to imitate MW 2019.

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

**No cards for MWIII and Black Ops 6.** Every MWIII frame carries HUD, objective markers and player names, and the Black Ops 6 frames carry weapon HUD. Both show on the preview scene, labelled "Preview", until there are clean screenshots.

**IMFDB access.** The live IMFDB pages serve a Cloudflare bot check to scripts, and it was not bypassed. The stills came from the archived copies instead (above).

**New chips.** `GAMES` gained **CODM**, **MWIII** and **Black Ops 6**.

## Checks

Every change above was checked with:
- `npm run check`: lint, typecheck and 25 tests
- `npm run build`
- Chromium at desktop and Pixel 7 sizes

GitHub CI and the Cloudflare preview build passed on each push. All downloaded videos were deleted after the frames were taken.

## Still open

- **Test on a phone.** Try the scene picker and the screen test on the [preview](https://claude-merge-codm.kuletxcore.workers.dev), then import one creator look in CODM and compare.
- **Find the handle's real maximum.** Importing a code with the highlights handle at a very large value would show whether the game clamps it or refuses the code.
- **Cards for MWIII, Black Ops 6 and Serotonin.** Clean screenshots of your own would give them cards. The IMFDB stills were kept to analysis only.
- **The deferred list** in [ARENA-MERGE-2.md](ARENA-MERGE-2.md#deferred): recent and favourite codes, per-look pages, a docking code bar, "Needs tweaking" and duel links.
