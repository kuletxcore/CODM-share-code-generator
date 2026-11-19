# DESIGN.md

Design direction for the CODM Filter Lab. Read this before changing UI. It describes the site as built, the reason for each decision, and the rules that keep it consistent.

## What the site is

An unofficial, fan-made tool for Call of Duty: Mobile colour filter share codes. Visitors either copy a ready-made look or build their own, then paste the 22-number code into CODM (Settings, Audio and Graphics, Graphic Style, Import). Most visitors arrive on a phone, often with the game open in another app.

**Design read:** a companion utility for CODM players, in the visual language of Call of Duty menus (MW4 mode selector), dial **ENERGY 2 / RHYTHM 2 / MOTION 2**.

- ENERGY 2: confident brand type and one loud accent, but the page is a tool, not a poster.
- RHYTHM 2: one large game frame, then a dense working area beside or under it. Two compositions, not a template of identical sections.
- MOTION 2: the filter wipes across the frame once, looks cross-fade, sheet and panel transitions, smoke behind. No scroll choreography.

## Identity

| Decision | Reason |
|---|---|
| Dark theme only (`ink #0a0b0a`) | CODM's own menus are dark and the site is used next to the game; a light page would flash between apps. No theme toggle is shipped, so there is no second mode to keep working. |
| CODM yellow `#ffea3b` as the single accent | Taken from the official wordmark. Used for the primary action on each screen (Copy code, Try it on the frame, Done), the active tab or chip, the name tag on the filtered side of the frame, focus rings and the compare divider. Nothing else is yellow. |
| Lime `#a6e22e` for "selected row" and "done" | The selected-row gradient of the MW4 mode list. Also marks completed import steps and the copied state. |
| Hitmarker type family | The Call of Duty brand typeface (Condensed for UI, Text for body, Normal Black for titles), supplied by the owner and self-hosted. Obel Mono (SIL OFL 1.1, chosen by the owner) only for share codes and readouts, so the 22 numbers line up and read as data; self-hosted, subset to ASCII, licence at `public/fonts/ObelMono-OFL.txt`. |
| Cut corners (`.cut`, `.cut-sm`) | The clipped corner of CoD menu panels and buttons. The identity motif, applied to panels, primary buttons and, beside the controls, the frame. |
| Scanlines on the look panel and tonal scope | A faint HUD texture on two surfaces that carry game imagery, nowhere else. Never on the frame, which has to show colours as they are. |
| Smoke background (plain WebGL) | Moves slowly behind everything like a menu screen. One fragment shader on a full-screen quad: 24 fps, paused while a pointer is down or the tab is hidden, half the resolution on desktop and a third on touch screens, a single still frame under reduced motion. |
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
| Page title "Filter Lab" | Hitmarker Normal Black, uppercase | 20 to 24px phone, 36px from `sm`; kept small so the frame gets the height |
| Section titles, look names | Hitmarker Normal Black, uppercase | 24 to 30px; look names 36 to 48px, one step smaller for names over 12 characters |
| Controls, labels, buttons | Hitmarker Condensed Bold, uppercase | 14 to 20px; panel titles 24 to 30px; 10 to 12px for eyebrow labels and the tags on the frame |
| Body and descriptions | Hitmarker Text | 14 to 16px |
| Share codes, numeric readouts | Obel Mono, weight 500 | 12 to 14px; 10px on the tone map's axis |

Wide letter spacing is used only for the "Unofficial fan-made tool" marker and small eyebrow labels (tonal range, the frame's caption and tags, the look name in the code bar), matching CoD menu labels. Body copy is sentence case.

## Layout and breakpoints

States are set where the content breaks, not by device:

| Width | Header | Looks | Frame and controls |
|---|---|---|---|
| under 640 | Logo, marker and title on one row | Game chips and the look strip scroll sideways | Stacked. The frame is pinned at the top, 16:9 across the full width (26% of the height of a 390 by 844 screen), and everything else scrolls under it |
| 640 to 1023 | The same, larger; a short description joins at 768 | Chips fit on one row; the strip scrolls sideways | Stacked, pinned frame, never taller than 46% of the viewport |
| 1024 to 1279 | One row | Three rows of four under the frame | Two columns. Left, pinned: frame, chips and looks. Right, scrolling: the look, Copy code and the controls |
| 1280 and up | One row | Two rows of six | The same two columns |

- Beside the controls the frame's height comes from `--frame-h` in `globals.css`, sized so the header, frame, chips and every row of looks fit the window without scrolling (checked from 1024 by 570 and 1280 by 500 up to 2560 by 1300). The frame never goes under 240px tall, so a shorter window cuts the last row of looks.
- In a short window that column is narrower than the row of game chips, so the chips tighten up (12px type, 6px padding) instead of wrapping.
- On a phone the first screen holds the frame, the chips, the strip, the look's name and Copy code (checked at 320 by 568, 360 by 640, 375 by 553 and 390 by 664). The frame's caption and "Use my screenshot" sit under the code there; beside the controls they sit under the frame.
- On screens under 480px tall (a phone on its side) the frame is not pinned and may take 68% of the height.
- The share-code bar docks to the bottom edge only while the main Copy code button cannot be pressed: scrolled away, under the pinned frame, or cut by the fold. The page keeps bottom padding for it so nothing hides behind it.
- The frame takes the picture's own shape (16:9 for the sample, the screenshot's ratio between 2:5 and 3:1 otherwise), so it is never pillarboxed.
- No horizontal overflow at 320, 360, 390, 768, 1024, 1366, 1440, 1920 or 2560 (checked).
- Every touch target is at least 44 by 44px: range inputs are 44px tall with a 6px visible track, number fields grow to 44px on coarse pointers, and the Simple/Advanced switch has a 72 by 44px hit area around its smaller visual. Chips, zone tabs, preset slots and the tone map's handles are 44px or more; Clear carries a 44px hit area around its small label, and so does Use my screenshot on coarse pointers.

## Components

- **Frame.** The one preview on the page: a sample game frame, or the visitor's own screenshot, with the current filter right of a divider and the untouched original left of it, graded on the GPU. Every look, slider and pasted code shows here, so the frame, the controls, the code and the URL never disagree and Copy code copies what is on screen. Drag the divider, or anywhere on the frame, to compare; a finger only takes hold after a deliberate sideways pull (8px), so vertical scrolling still works on phones. A tap sends the divider to the finger, arrow keys move it, double-click recentres it.
- **Look strip and look panel.** The twelve looks as tabs, with the owner's stills as thumbnails (click or arrow keys). Picking one loads it into the frame. The panel beside the controls names the look, says what it was derived from and, on wide screens, shows the still it is chasing. Nothing auto-plays.
- **Your mix.** A filter that is not one of the looks is the visitor's own mix. It takes the first tab in the strip, is remembered in the browser and stays when a look is picked, so trying looks never throws work away.
- **Game chips.** Filter the looks by the game they come from (MW4, Black Ops 7, MWII, Vanguard, MW 2019, Cold War). Games are facts checked against sources, unlike mood labels. A chip that hides the look on the frame loads the first look of that game; a code from another game puts the filter back to All; the mix tab always stays.
- **Tune it.** Simple/Advanced switch, zone tabs (Shadows, Midtones, Highlights), and controls that mirror the in-game Customize Color screen: 8 hue swatches plus a 0 to 100 slider, Tint, Saturation, Brightness. Parity with the game matters more than a novel control, because players reproduce or tweak these values in CODM. A pasted code is loaded here.
- **Tone map (the in-game Range bar).** Under the zone tabs in Advanced mode: a luminance histogram of the whole frame with the filter applied, with the two Range handles on top. It replaces the old Range panel and its two sliders, so the split between zones is in view while any zone is edited. Draggable and keyboard operable (arrows, Shift for bigger steps, Home, End); each handle writes edge = handle + 100, as the game does. Hidden in Simple mode, where the range does not apply. On phones it scrolls with the controls, under the pinned frame, so the frame stays the same height. The tone map and all four sliders of a zone fit one screen together from 1280 by 600 up and on a tall phone (390 by 844); a short phone has to scroll between them.
- **Copy code and the code bar.** One primary button under the look's name. The same button, with the code, docks to the bottom edge when the main one is out of reach.
- **Import guide.** Opens after any copy and stays until Done or Esc: the seven in-game steps as a checklist, the code with Copy again, a QR that opens this page with the code on a phone (shown from `sm` up, since a phone visitor is already on their phone), and Save look card. "Skip the steps next time" switches to a short toast. A look hands over its name, note and still; a mix goes as an unnamed custom grade.
- **Look card.** A 1200 by 630 PNG with the look's image, name, code and a QR back to the site, marked "Fan-made filter lab". Shared through the system share sheet when the browser has one, downloaded otherwise.
- **Match a screenshot.** Turns a reference screenshot into a starting code; "Try it on the frame" loads it like any other code.

## Motion

- Frame: on load the filter wipes in once (the divider sweeps from the right edge to the middle in 1.25 s), so the divider reads as something to drag. A new look cross-fades over the old one in 0.3 s.
- The code bar and the import guide slide in, the guide on a spring.
- Every motion is optional: `prefers-reduced-motion` removes the wipe, the cross-fade and transitions.
- Nothing is animated by scrolling. The code bar slides in when the main Copy code button leaves the screen.

## Accessibility

- Visible yellow focus ring on everything (`:focus-visible`), never removed without a replacement.
- Pointer cursor on every enabled control (set in the base layer, since Tailwind v4 resets buttons to the default cursor); `not-allowed` when disabled.
- Custom controls use the right roles: the look strip is a `tablist`, the game chips and preset slots are toggle buttons (`aria-pressed`), the mode control is a `switch`, the compare divider and the scope handles are focusable `role="slider"` elements with values and labels.
- The share code under Copy code is an `output`, so a change is announced once; its copy in the docked bar is plain `code`.
- The import guide is a dialog that takes focus when it opens and closes with Esc.

## Content rules

- No numbers, testimonials or claims without a source. Footage-based looks say what they were derived from and that the result is subtle and should be tested in game.
- Game and map attributions are checked against published sources.
- Card images from gameplay videos are cropped so no other player's gamer tag is visible.
- "Unofficial fan-made tool" appears in the header, the footer disclaimer and on every look card.
- The sample frame is an AI-generated stand-in, not a CODM capture, and is labelled as one: "Sample frame · approx. preview" under it, the footer note and the README. Replace the three files in `public/sample/` to use a real capture.

## Performance

- Grading runs in a WebGL fragment shader that matches the CPU version within 1/255 (checked on a colour chart for all twelve looks). On first use it grades a grey pixel and reads it back; a driver that draws nothing falls back to the CPU path.
- No three.js: the frame and the smoke are plain WebGL. The QR encoder and the card renderer load with `import()`, off the critical path.
- The sample frame is in the static HTML at high fetch priority, in two sizes (800 and 1280px wide), so it paints before any script runs. The look strip uses 352px thumbnails at low fetch priority.
- The tone map and the mix thumbnail are graded on the CPU from small copies of the frame (160 by 90 and 176 by 80), so they keep up with a dragged slider.
- Backdrop blur only on the docked code bar, the one translucent element that sits over scrolling content.
- The page at load uses five font files: Normal Black, Condensed Bold and Black, Text Regular and Obel Mono. Each further weight (Condensed Medium, Text Medium or Bold) is another 50 KB file fetched for whatever text asks for it, so small marks are drawn as SVG rather than typed in a new weight.

## What was merged from the arena remakes, and what was not

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
| All looks shown graded on one 3D frame instead of their images | 947ec79d, ed32f292 | Honest comparison, but the stills were chosen by the owner and the subtle footage-based looks all look alike on the sample scene. |
| Editor as a full-screen mode and a single "bench" page | 947ec79d, ed32f292 | Large restructures of a layout that was just tuned for phones (pinned viewfinder); the gain did not justify the churn. |
| Hash-restore fix under React StrictMode | 2431d576 | Only affects development builds; production runs effects once. |

### Revisited: the live try-on

A later change (branch fae6c3f0, built on top of the merge above) reopens two rows of the Dropped table. Everything in the Picked table is kept; the tone map now sits with the controls it belongs to, under the zone tabs, rather than directly under the preview.

| Dropped row | What is different this time |
|---|---|
| All looks shown graded on one 3D frame instead of their images | The frame is a photoreal game frame, not the 3D scene, and it is added to the stills rather than replacing them: the stills stay as the strip thumbnails, on the look panel and on the look card. The frame is there so that Copy code copies what the visitor is looking at. The subtle footage-based looks are still subtle on it; the divider is what shows them. |
| Editor as a full-screen mode and a single "bench" page | One page with one preview instead of a gallery stage and a separate generator preview. The phone layout that had just been tuned is kept: the frame is the pinned viewfinder and the tone map scrolls under it. |
