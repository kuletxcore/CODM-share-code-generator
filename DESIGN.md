# DESIGN.md

Design direction for the CODM Filter Lab. Read this before changing UI. It describes the site as built, the reason for each decision, and the rules that keep it consistent.

## What the site is

An unofficial, fan-made tool for Call of Duty: Mobile colour filter share codes. Visitors either copy a ready-made look or build their own, then paste the 22-number code into CODM (Settings, Audio and Graphics, Graphic Style, Import). Most visitors arrive on a phone, often with the game open in another app.

**Design read:** a companion utility for CODM players, in the visual language of Call of Duty menus (MW4 mode selector), dial **ENERGY 2 / RHYTHM 2 / MOTION 2**.

- ENERGY 2: confident brand type and one loud accent, but the page is a tool, not a poster.
- RHYTHM 2: a cinematic gallery stage, then a dense working area. Two compositions, not a template of identical sections.
- MOTION 2: a slow push-in on the stage, sheet and panel transitions, smoke behind. No scroll choreography.

## Identity

| Decision | Reason |
|---|---|
| Dark theme only (`ink #0a0b0a`) | CODM's own menus are dark and the site is used next to the game; a light page would flash between apps. No theme toggle is shipped, so there is no second mode to keep working. |
| CODM yellow `#ffea3b` as the single accent | Taken from the official wordmark. Used for the primary action on each screen (Copy code, Copy, Done), the active tab or chip, focus rings and the compare divider. Nothing else is yellow. |
| Lime `#a6e22e` for "selected row" and "done" | The selected-row gradient of the MW4 mode list. Also marks completed import steps and the copied state. |
| Hitmarker type family | The Call of Duty brand typeface (Condensed for UI, Text for body, Normal Black for titles), supplied by the owner and self-hosted. Obel Mono (SIL OFL 1.1, chosen by the owner) only for share codes and readouts, so the 22 numbers line up and read as data; self-hosted, subset to ASCII, licence at `public/fonts/ObelMono-OFL.txt`. |
| Cut corners (`.cut`, `.cut-sm`) | The clipped corner of CoD menu panels and buttons. The identity motif, applied to panels, primary buttons and the stage. |
| Scanlines on the stage and tonal scope | A faint HUD texture on the two surfaces that show game imagery, nowhere else. |
| Smoke background (three.js) | Moves slowly behind everything like a menu screen. 24 fps, paused while a pointer is down or the tab is hidden, a third of the resolution on touch screens. |
| Official logo in the header | Used with the owner's approval; the page and the share card both say "Unofficial fan-made". |

## Colour tokens

Defined in `src/app/globals.css` under `@theme`. Core palette: ink, panel, text, CODM yellow, lime. Neutrals do not count against the palette.

| Token | Value | Use |
|---|---|---|
| `ink` | `#0a0b0a` | Page background |
| `panel` / `panel-2` | `#121412` / `#1a1d1a` | Raised surfaces, inactive controls |
| `line` | `#2c302b` | Borders and dividers (never text) |
| `mute` | `#8e948b` | Secondary text |
| `text` | `#e9ece6` | Body text |
| `codm` / `codm-light` | `#ffea3b` / `#fff38a` | Accent, hover of the accent |
| `lime` | `#a6e22e` | Selected row, completed state |

The tonal scope adds two functional colours for the Range handles: shadows `#8fc2ff`, highlights `#ffc46b`. They mark which handle is which and appear nowhere else.

**Measured contrast (WCAG AA needs 4.5:1 for body text):** text on ink 16.5:1, text on panel 15.5:1, mute on ink 6.3:1, mute on panel 6.0:1, mute on panel-2 5.5:1, black on CODM yellow 17.1:1, black on lime 12.5:1. Mute on `line` is 4.3:1, so muted text never sits directly on a `line` fill.

## Type

| Role | Font | Size |
|---|---|---|
| Page title "Filter Lab" | Hitmarker Normal Black, uppercase | 30px phone, 72px from `sm` |
| Section titles, look names | Hitmarker Normal Black, uppercase | 30 to 36px; look names 36 to 96px on the stage, one step smaller for names over 12 characters |
| Controls, labels, buttons | Hitmarker Condensed Bold, uppercase | 14 to 18px |
| Body and descriptions | Hitmarker Text | 14 to 16px |
| Share codes, numeric readouts | Obel Mono, weight 500 | 12 to 14px |

Wide letter spacing is used only for the "Unofficial fan-made tool" marker and small eyebrow labels (tonal range, share code), matching CoD menu labels. Body copy is sentence case.

## Layout and breakpoints

States are set where the content breaks, not by device:

| Width | Header | Gallery | Generator |
|---|---|---|---|
| under 640 | Logo and title on one row, subtitle below | 4:3 stage, filmstrip and game chips scroll sideways; screen-test panel below, one short row | Stacked; preview pinned at the top (27% of the viewport) while controls scroll |
| 640 to 767 | Stacked, large title | 21:9 stage | Stacked, pinned preview |
| 768 to 1279 | Stacked | 21:9 stage | Stacked, pinned preview grows to 38% of the viewport |
| 1280 and up | Stacked | 21:9 stage | Zone list, preview and controls in three columns; preview not pinned |

- The share-code bar is fixed to the bottom on every width; the page reserves its height with bottom padding so nothing hides behind it.
- The preview frame shrinks to the picture's width below `xl`, so it is never pillarboxed.
- No horizontal overflow at 390, 768, 1024 or 1440 (checked).
- Every touch target is at least 44 by 44px: range inputs are 44px tall with a 6px visible track, number fields grow to 44px on coarse pointers, and the Simple/Advanced switch has a 72 by 44px hit area around its smaller visual.

## Components

- **Look stage and filmstrip.** One look fills the stage with a slow push-in; the filmstrip below switches looks (click or arrow keys) and auto-plays every 7 s until the visitor picks one, hovers or copies. Reduced motion turns off autoplay and the zoom.
- **Screen test.** A panel below the gallery takes one screenshot (drop, file picker, or paste anywhere on the page; a portrait shot is centre-cropped to a landscape frame). From then on the stage, the filmstrip and the generator preview are graded on the visitor's own frame, labelled "Your screen · approx.", and a Compare button on the stage, held down, shows the ungraded frame (holding it stops autoplay). Its button is secondary so Copy stays the one yellow action; when it is on, it says that saved look cards will show the screenshot, which can contain names. The screenshot is a fallback preview source: an image uploaded in the preview itself wins, and "Sample scene" returns to the screen test, then "Remove screen test" to the sample. Nothing leaves the browser.
- **Stage label.** Says what the picture is: "In game" when it is a CODM capture with that exact code applied (the creator-shared looks), "Inspiration" when it is a reference the look was built from, "Preview" when the look is graded onto a built-in scene, and "Your screen · approx." during a screen test.
- **Game chips.** Filter the looks by the game they come from (MW4, Black Ops 7, MWII, Vanguard, MW 2019, Cold War). Games are facts checked against sources, unlike mood labels.
- **Generator.** Simple/Advanced switch, Undo and Redo, a zone list (Shadows, Midtones, Highlights), and controls that mirror the in-game Customize Color screen: 8 hue swatches plus a 0 to 100 slider, Tint, Saturation, Brightness. Parity with the game matters more than a novel control, because players reproduce or tweak these values in CODM.
- **Tone map (the in-game Range bar).** Directly under the preview in Advanced mode: a luminance histogram of what the preview shows, with the two Range handles on top. It replaces the old Range panel and its two sliders, so the split between zones is always in view while any zone is edited. Draggable and keyboard operable (arrows, Shift for bigger steps, Home, End); each handle writes edge = handle + 100, as the game does. Hidden in Simple mode, where the range does not apply. On phones it scrolls with the controls, so the pinned viewfinder stays the same height.
- **Preview.** The look applied to a real CODM frame or to the visitor's own screenshot, graded on the GPU. Five built-in scenes are stills from MorganPixy's Season 10 weapons showcase, recorded on the default filter with no HUD, picked so each has deep shade, sky and saturated colour: Shipment 2019 (Modern Warfare 2019), Combine (Black Ops III), Hijacked (Black Ops II), Armada Strike (Black Ops Cold War) and Crossfire (Call of Duty 4), map names checked against Activision and press coverage. A row of 44px buttons switches between them (lime marks the chosen one), with the source credited under it. The row hides while an upload or the screen test supplies the frame. Drag sideways across it (or use the Compare slider) to see the original; the drag only starts after a deliberate sideways pull so vertical scrolling still works on phones. Double-click resets the split.
- **Undo and redo.** Share codes are the steps. A drag settles into one step after 400 ms; loading a look or a pasted code is a step; the code a shared link opens with is the starting point, not a step. Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y, except while typing in a field. Up to 50 steps, kept for the visit only.
- **Code bar.** Copy says "Copied" only when the clipboard took the code and "Blocked" when the browser refused. The paste field finds a code inside surrounding text (a look name, a share link, numbers separated by spaces), then the strict codec decides whether it is valid.
- **Import guide.** Opens after any copy and stays until Done or Esc: the seven in-game steps as a checklist, the code with Copy again, a QR that opens this page with the code on a phone (shown from `sm` up, since a phone visitor is already on their phone), and Save look card. "Skip the steps next time" switches to a short toast.
- **Look card.** A 1200 by 630 PNG with the look's image (or the visitor's graded screenshot during a screen test), name, code and a QR back to the site, always marked "Fan-made filter lab". Shared through the system share sheet when the browser has one, downloaded otherwise.

## Motion

- Stage: opacity cross-fade and a push-in lasting the 7 s dwell.
- Sheets and the import guide: spring slide.
- Every motion is optional: `prefers-reduced-motion` removes the push-in, autoplay and transitions.
- Nothing else animates on scroll.

## Accessibility

- Visible yellow focus ring on everything (`:focus-visible`), never removed without a replacement.
- Pointer cursor on every enabled control (set in the base layer, since Tailwind v4 resets buttons to the default cursor); `not-allowed` when disabled.
- Custom controls use the right roles: the filmstrip is a `tablist`, the mode control is a `switch`, the scope handles are focusable `role="slider"` elements with values and labels.
- The import guide is a non-modal dialog: it takes focus when it opens, closes with Esc, and hands focus back to the control that opened it. When the copy was blocked its heading says so.
- Nothing that changes on its own is a live region. The autoplaying stage and the code readout are silent; a look the visitor picks is announced once, and copy results go to a status message. Focus inside the stage pauses autoplay. The filmstrip takes arrow keys, Home and End.

## Content rules

- No numbers, testimonials or claims without a source. Footage-based looks say what they were derived from and that the result is subtle and should be tested in game.
- Game and map attributions are checked against published sources.
- Card images from gameplay videos are cropped so no other player's gamer tag is visible.
- "Unofficial fan-made tool" appears in the header, the footer disclaimer and on every look card.

## Performance

- Grading runs in a WebGL fragment shader that matches the CPU version within 1/255. On first use it grades a grey pixel and reads it back; a driver that draws nothing falls back to the CPU path.
- three.js (smoke background only), the QR encoder and the card renderer load with `import()`, off the critical path. The preview scenes are 41 to 51 KB WebP stills loaded one at a time, which replaced a three.js scene (about 185 KB gzipped plus a render on the phone).
- The CPU grade (fallback preview, thumbnails, screen test, cards) builds its per-zone constants once per grade and skips zones that change nothing; `src/lib/grade.test.ts` keeps the original loop as an oracle and asserts identical pixels.
- Screen-test grades run one per task, are cached per size (28 entries: a thumb and a stage frame for every look), and a replaced screenshot's cached pixels are freed.
- Uploads are scaled so the long side is at most 1280px, which keeps a portrait phone screenshot under a 2048px GPU texture limit.
- A link preview image (`public/og.jpg`, 85 KB, brand fonts, marked fan-made) is fetched only by chat and social unfurlers.
- The filmstrip uses 352px thumbnails, lazy-loaded.
- Backdrop blur only on the two elements that sit over scrolling content: the fixed code bar and the pinned phone viewfinder.

## What was merged from the arena remakes, and what was not

Round 2 (nine remakes, judged with fresh-context reviewers) is written up in [ARENA-MERGE-2.md](ARENA-MERGE-2.md). It added the screen test, undo/redo, the link preview card, honest copy results, the screen-reader fixes and a faster CPU grade, and dropped the Blend Atlas, Vibe Finder, Duel, the wall of looks, the live-frame rewrite and both service workers. The tables below are round 1.

Eight remakes branched from the same commit. Ideas that several of them reached independently were weighted more.

| Picked | From | Why |
|---|---|---|
| QR hand-off to a phone and the look card | d55d3f96 (cards also in 947ec79d and 2cad37b9) | The code has to end up on a phone; on desktop that hop was missing. Code-split, so it costs nothing until used. |
| Tone map in place of the Range sliders, under the preview | d55d3f96 and ed32f292 | Makes the least understood control visible, and keeps it in view while editing any zone. The owner asked for it to replace the Range bar sliders. |
| Drag across the preview to compare, after a deliberate pull | ed32f292, d55d3f96, 2cad37b9 | Three remakes converged on it; the pull threshold keeps phone scrolling intact. |
| GPU self-test before trusting the shader | ed32f292 | Cheap guard against a preview that silently never grades. |
| Filter chips for the looks | 49aa1fc3 and 2cad37b9 (as moods) | Twelve looks need a filter; game names replace subjective mood tags. |
| One-row header on phones | 49aa1fc3 | Saves about a third of the first phone screen. |

| Dropped | From | Why |
|---|---|---|
| Fake tactical HUD chrome: clock, "SYS ONLINE", "STATUS: ACTIVE", "V2.0" | 321859aa | Decorative text that claims a system state that does not exist. |
| Cyber HUD and "audio-reactive" UI | 63bf5f71 | Does not build (unclosed brace in `scene.ts`); decoration without a job. |
| Page-wide ambient tint from the active filter | 2431d576 | Clever, but recolours the accent and text with every grade, which puts contrast at the mercy of the look; adds constant GPU work. |
| Colour wheels for hue and tint | d55d3f96, 2cad37b9 | Hide the 8-swatch plus slider structure players see in game. |
| Fifteen-feature console: telemetry HUD, macros, blend lab, loadouts, shortcuts overlay | 2cad37b9 | Feature count over clarity; most panels restate the same settings. |
| "Find your visual edge" marketing hero | 49aa1fc3 | Marketing copy for a free tool; the header already says what the site does. |
| All looks shown graded on one 3D frame instead of their images | 947ec79d, ed32f292 | Honest comparison, but the stills were chosen by the owner and the subtle footage-based looks all look alike on the sample scene. (Round 2's screen test does this on the visitor's own screenshot instead, which is where the comparison is meaningful.) |
| Editor as a full-screen mode and a single "bench" page | 947ec79d, ed32f292 | Large restructures of a layout that was just tuned for phones (pinned viewfinder); the gain did not justify the churn. |
| Hash-restore fix under React StrictMode | 2431d576 | Only affects development builds; production runs effects once. |
