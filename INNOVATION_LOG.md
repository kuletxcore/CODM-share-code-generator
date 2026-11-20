# Innovation log — 100 look → innovate loops

This file records every loop of the exercise. Before each change I re-read the
state of the app (source, rendered structure, or the diff of the previous
iteration); after each change I ship it as its own commit. The branch is
`arena/5a181f54-codm-share-code-generator`.

**Initial look:** a fan-made Next.js static export with four surfaces — a
cinematic look gallery, a generator with GPU preview and tone map, a screenshot
converter, and an import checklist. The hard parts of the journey are: finding
a look fast, getting the 22-number code onto a phone in game, and understanding
what the numbers do. Most of the opportunities are in those three gaps, plus
performance and accessibility of the dense editor.

### 1. Global toast channel

- **Look:** Notices were scattered: inline errors, a copied-label, and the guide's toast each had their own UI. Nothing could offer an undo or a one-tap follow-up.
- **Ship:** Added a single event-bus toast system with actions, tones, auto-dismiss, a11y role and reduced-motion support.

### 2. Failure-tolerant persistence layer

- **Look:** Saved state was about to be added, but direct localStorage calls would crash in private mode and on quota errors.
- **Ship:** Added a guarded storage module with JSON helpers, typed preferences and a saved-look schema.

### 3. Decoupled action bus

- **Look:** UI pieces were being threaded through props: the palette, shortcuts and future overlays would each need a new prop on FilterLab.
- **Ship:** Added a typed app-action event bus and useActions hook so any control can request a shell action without prop drilling.

### 4. Code understanding utilities

- **Look:** The 22 numbers are the product, yet the app showed them as an opaque string; no normalization, explanation, diff or classification existed.
- **Ship:** Added code normalization, a 22-field human-readable breakdown, diffs, exact look lookup, computed mood tags and a seeded random-grade generator.

### 5. Command palette

- **Look:** With 12 looks, two editor modes and a 22-number code, the fastest actions were buried below the fold and required scrolling.
- **Ship:** Added a Cmd/Ctrl+K palette with fuzzy search over looks and actions, paste-a-code detection, arrow-key navigation and direct action dispatch.

### 6. Palette wired into the shell

- **Look:** The palette existed but no route to it, and the toast host was mounted nowhere, so neither could reach a visitor.
- **Ship:** Mounted the toast host at the root, added a header Quick find trigger, and connected the palette to the code loader through the action bus.

### 7. Global hotkeys and a discoverable shortcut sheet

- **Look:** The app had no keyboard entry points beyond sliders and tab focus, so power users had to scroll the long editor to reach every tool.
- **Ship:** Added app-wide shortcuts that ignore text inputs, plus a ? shortcut sheet listing them all.

### 8. Undo/redo history for settings

- **Look:** Every slider change overwrote the only copy of a grade; a mistaken drag was unrecoverable, and the URL hash did not help.
- **Ship:** Added a bounded edit history with gesture coalescing, undo/redo actions and exposed canUndo/canRedo state.

### 9. History and hotkeys wired into the editor

- **Look:** The new hooks were dormant; the visitor still had no visible undo and no way to trigger shortcuts from the shell.
- **Ship:** Connected the history hook to settings, added visible undo/redo/help controls, wired action dispatch and mounted the shortcut sheet.

### 10. Clipboard code detection

- **Look:** Codes travel through chat and notes; visitors had to focus a small paste field at the bottom of the page to use one.
- **Ship:** Added a global paste listener that spots a 22-number code anywhere and offers a one-tap Load toast.

### 11. Fix overlay action typing

- **Look:** The build caught a union mismatch between the shortcut sheet and the action bus.
- **Ship:** Added the missing close-overlays action to the typed union so overlays can be dismissed programmatically.

### 12. My Looks library

- **Look:** A copied code disappeared as soon as the tab closed; there was no way to keep a favourite grade or return to an earlier experiment.
- **Ship:** Added a local library drawer with saved, favourited and recent looks, inline rename/delete, JSON import/export and a one-tap Save current code.

### 13. Library wired into the shell

- **Look:** The drawer had no trigger and saving from a shortcut did nothing; the feature was unreachable.
- **Ship:** Connected My Looks to the action bus and header, exposed a shared save helper, and kept the code memo above the handler dependencies.

### 14. First-visit chooser

- **Look:** The landing page opened into a long visual gallery with two editor modes below the fold; a visitor had to guess where to start.
- **Ship:** Added a first-run chooser with three clear routes — copy a look, build a filter, or convert a screenshot — remembered after the first visit.

### 15. Chooser wired to the page

- **Look:** The onboarding overlay was disconnected from the converter mode and not mounted.
- **Ship:** Mounted the chooser in the shell and connected its converter route to the existing mode switch.

### 16. Favourites and recently viewed

- **Look:** A look that worked was impossible to find again: there was no star, no history, and the only record was a code string.
- **Ship:** Added per-look favourites on the stage and filmstrip, plus a recently-viewed list that feeds My Looks whenever a look is picked or copied.

### 17. Favourites filter chip

- **Look:** With twelve looks and six game chips, a small set of favourite grades was still buried in the same long strip.
- **Ship:** Added a Favourites filter chip with a live count so the chosen looks become their own gallery.

### 18. Empty states and honest chip counts

- **Look:** An empty favourites filter left the stage showing an unrelated look, and chips hid how many looks they contained.
- **Ship:** Added a proper empty state with a reset action, per-chip counts, and a guard against undefined look selection.

### 19. Resume and Surprise me

- **Look:** Returning visitors had to scan twelve titles again, and there was no low-friction way to explore.
- **Ship:** Added a Resume shortcut to the last viewed look and a Surprise me button that jumps to a random look with one tap.

### 20. Shareable look links

- **Look:** A visitor could copy a code but could not send someone to the exact look they were looking at; sharing meant describing it in words.
- **Ship:** Added #look= deep links, a Copy link button on the stage, a reusable clipboard helper, and navigation that leaves editor codes untouched.

### 21. Forgiving code entry

- **Look:** A code copied with spaces or newlines was rejected by the paste field even though it was valid; the error gave no clue.
- **Ship:** Added normalization that accepts spaces, dashes and line breaks before validating a 22-number code.

### 22. Share-code inspector

- **Look:** The 22 numbers were the product but never explained; the only documentation lived in the README.
- **Ship:** Added a decoded inspector that groups all 22 values by in-game screen, highlights changes from default, and offers copy or open-in-generator.

### 23. Inspector wired into the code bar

- **Look:** The decoder had no entry point from the main code surface.
- **Ship:** Added a decode button beside Copy and connected inspector state to the action bus.

### 24. Computed character filters

- **Look:** Game filters answer where a look came from, not what it looks like; with twelve looks the useful question is warm, cool, vivid or muted.
- **Ship:** Added computed character chips derived from each code's own values, combined with game/favourite filters and a live result count.

### 25. Fix duplicate import

- **Look:** The character-filter change broke the build because decode was imported twice in the gallery.
- **Ship:** Removed the duplicate import and restored a green build before continuing the loop.

### 26. Copy from the filmstrip

- **Look:** Copying a look required waiting for the stage: the filmstrip could only select, so comparing twelve options meant twelve visits to the big card.
- **Ship:** Added a quick-copy button directly on every thumbnail so any visible look can be copied without changing the stage.

### 27. A/B look comparator

- **Look:** Choosing between two looks meant copying one code, closing the guide, opening the other, and trying to remember the first frame.
- **Ship:** Added a full A/B compare stage with a wipe divider, inline codes, copy/link/edit actions and keyboard dismissal.

### 28. Downloadable look sheet

- **Look:** Players share looks by sending screenshots one at a time; there was no way to hand a squad a single reference of all the options.
- **Ship:** Added a canvas-rendered, labelled look sheet of the current filtered set and a one-click PNG download.

### 29. Bulk copy codes

- **Look:** Trying several looks meant copying codes one at a time from the stage.
- **Ship:** Added Copy all, which puts every visible look's code on the clipboard as named, newline-separated entries.

### 30. Share the tool, revisit the tour

- **Look:** The footer ended with disclaimers; there was no way to send the tool to a friend or replay the first-visit guidance.
- **Ship:** Added a footer action strip with native share (clipboard fallback), a replayable tour and a shortcuts link.

### 31. One-tap grade moves

- **Look:** The editor exposed eleven precise sliders but no way to say a direction like warmer or softer; every adjustment started from scratch.
- **Ship:** Added six computed grade moves plus a neutralizer that work in the same in-game value space as the sliders.

### 32. Quick moves wired into the editor

- **Look:** The tweak library was not connected to the generator.
- **Ship:** Mounted QuickTweaks above the zone sliders, with labelled history entries so a whole move undoes in one step.

### 33. Zone value clipboard

- **Look:** Dialling in one zone and wanting it in another meant writing four numbers down; the UI offered no transfer.
- **Ship:** Added Copy/Paste values per zone using a small JSON payload, with validation and clear feedback.

### 34. Double-click slider reset

- **Look:** Returning a single value to neutral required dragging a precise slider back to its centre, with no visual marker for neutral.
- **Ship:** Added double-click-to-reset on hue, tint, saturation and brightness sliders, plus tooltips advertising the gesture.

### 35. Keyboard zone navigation

- **Look:** Keyboard users could reach the zone list but had no way to move between its three items without tabbing through the whole page.
- **Ship:** Added Up/Down arrow navigation with focus follow in the zone list.

### 36. Pinned before/after

- **Look:** The compare wipe only showed the untouched scene, so it could not answer 'is this edit better than where I started?'.
- **Ship:** Added a pinned-before snapshot composited into the wipe's original side, with a labelled badge and clear action.

### 37. Fullscreen preview

- **Look:** On a phone the pinned viewfinder is only 27% of the viewport; fine grading details were hard to judge.
- **Ship:** Added a fullscreen preview action reachable from the preview controls, the palette and the F key.

### 38. Pixel loupe

- **Look:** Subtle footage-based grades are hard to read at a thumbnail size, and there was no way to inspect a single region without uploading and zooming the image elsewhere.
- **Ship:** Added a toggleable 4× loupe that follows the pointer over the live graded preview.

### 39. Two more preview scenes

- **Look:** Every look was judged on one street scene; subtle warm and cool grades read differently against sky, skin and sand.
- **Ship:** Added procedural desert-range and operator-portrait preview scenes alongside the original urban sample.

### 40. Scene switcher persisted

- **Look:** The extra scenes had no route into the preview.
- **Ship:** Added a scene switcher in the preview controls, kept the 3D scene only for urban, and persisted the choice across visits.

### 41. Match strength control

- **Look:** The converter returned one fixed answer; a strong measurement often looked wrong in game and the visitor had no way to dial it back.
- **Ship:** Added an intensity control that blends the measured grade from neutral from 25% to 150%.

### 42. Copy the converted code directly

- **Look:** A converted grade had to be opened in the generator before it could be copied and tried in game.
- **Ship:** Added a direct Copy this code action to the converter result.

### 43. Drop a reference anywhere

- **Look:** The converter's two small panels were the only drop targets; dropping a screenshot on the rest of the section did nothing.
- **Ship:** Added section-wide drag and drop for reference images with an explicit hint.

### 44. More code actions

- **Look:** Copy was the only thing to do with a code; sending the grade as a link, a text file or through the share sheet required leaving the tool.
- **Ship:** Added an expandable code action panel with link copy, native share, .txt download and Save look.

### 45. Code validity and diff signals

- **Look:** The paste field gave no sign that a pasted code was well-formed until submit, and there was no indication of how far the current code had moved from default.
- **Ship:** Added a live valid/invalid border, a changed-values counter on the code output and a tooltip with detail.

### 46. Tactile confirmation

- **Look:** Copying a code gave a visual label but no physical confirmation while the visitor's eyes were moving towards the game.
- **Ship:** Added a short vibration on successful copy across the clipboard helper and code guide (where supported).

### 47. Mode-aware import steps

- **Look:** The guide always said 'pick a mode tab', but DMZ: Recon has no Customize Color and the steps a player sees differ by mode.
- **Ship:** Added MP/BR/DMZ selection in the guide with mode-specific step text and hints, persisted across visits.

### 48. Checklist progress per code

- **Look:** Closing the guide lost every ticked step, so switching away to CODM and back meant starting the checklist again.
- **Ship:** Added per-code progress persistence with restore on open and an indicator that progress is remembered.

### 49. Post-import feedback loop

- **Look:** The guide ended at 'Apply' with no confirmation that the code worked, so the highest-intent moment of the visit went nowhere.
- **Ship:** Added a completion state that asks whether the imported grade looks right and records the answer locally.

### 50. Needs tweaking → pinned editor

- **Look:** A grade that looked wrong in game meant starting over: the visitor had to find the editor and rebuild from memory.
- **Ship:** Wired 'Needs tweaking' back into the generator with the imported grade pinned as the before state for immediate comparison.

### 51. Installable app manifest

- **Look:** A tool used beside a game was still just a browser tab with no home-screen presence or shareable app identity.
- **Ship:** Added a web app manifest with brand colours, shortcuts to looks and the converter, and the yellow mark as an icon.

### 52. Offline service worker

- **Look:** A spotty mobile connection could leave the page blank between the lobby and the range; nothing was cached.
- **Ship:** Added a versioned service worker that caches the shell, fonts and look art, serves the app offline and cleans old caches.

### 53. Connectivity notice

- **Look:** Offline mode would otherwise fail silently and look like a broken page.
- **Ship:** Added a one-time offline notice explaining that saved grades and the generator keep working, plus registration wiring.

### 51. Installable app manifest

- **Look:** A tool used beside a game was still just a browser tab with no home-screen presence or shareable app identity.
- **Ship:** Added a web app manifest with brand colours, shortcuts to looks and the converter, and the yellow mark as an icon.

### 52. Offline service worker

- **Look:** A spotty mobile connection could leave the page blank between the lobby and the range; nothing was cached.
- **Ship:** Added a versioned service worker that caches the shell, fonts and look art, serves the app offline and cleans old caches.

### 53. Connectivity notice

- **Look:** Offline mode would otherwise fail silently and look like a broken page.
- **Ship:** Added a one-time offline notice explaining that saved grades and the generator keep working, plus registration wiring.

### 54. Rich metadata and structured data

- **Look:** Links to the tool in chats showed a bare URL and search engines had no description of what the app does.
- **Ship:** Added Open Graph/Twitter metadata, canonical URL, an app JSON-LD block with the fan-made disclaimer, and accessible viewport settings.

### 55. Crawler files

- **Look:** There was no sitemap or robots policy for a tool indexed by players searching for a code.
- **Ship:** Added static robots.txt and sitemap.xml for the Cloudflare Worker export.

### 56. Critical font preload

- **Look:** The custom display and mono fonts were discovered only after CSS loaded, causing a visible type swap on the title and every code.
- **Ship:** Preloaded the three typefaces used above the fold.

### 57. Adjacent thumbnail preload

- **Look:** Scrolling the filmstrip showed blank cards for a moment while each new thumbnail was fetched.
- **Ship:** Added idle preloading of neighbouring look thumbnails so selecting the next look feels instant.

### 58. Idle scene rendering

- **Look:** The three.js scene imported and rendered during first paint, competing with the fonts and gallery the visitor sees immediately.
- **Ship:** Deferred scene rendering to browser idle time with a timeout fallback, and kept the flat sample as the first frame.

### 59. GPU render dedupe

- **Look:** Every React re-render of the preview re-uploaded 22 uniforms and redrew the full frame, even when nothing changed.
- **Ship:** Added a code/split signature cache in the GPU grader so identical frames skip the draw.

### 60. Idle histogram sampling

- **Look:** The tone map reallocated its sample canvas and sampled pixels on a fixed 800ms timer for the whole session.
- **Ship:** Reused the sample canvas, resized only when needed, and moved periodic sampling to idle callbacks while the tab is visible.

### 61. Error boundary

- **Look:** A WebGL driver failure or a bad image could throw inside the editor and leave a blank page with no recovery.
- **Ship:** Added a branded error boundary with the error text and a reload action around the app.

### 62. Focus trapping helper

- **Look:** Several overlays were dialogs visually but keyboard focus could leave them and land on the page behind.
- **Ship:** Added a reusable focus-trap hook that restores focus on close.

### 63. High-contrast support

- **Look:** Muted text and thin borders were hard to see for visitors with high-contrast or forced-colour settings.
- **Ship:** Added high-contrast token overrides, forced-colour fallbacks and a global reduced-motion override.

### 64. Motion preference gate

- **Look:** Motion was controlled only by the OS setting; there was no in-app way to turn animation off.
- **Ship:** Added a motion gate that applies system and in-app preference to both CSS and Motion components.

### 65. Dialogs trap focus, motion is switchable

- **Look:** The new focus-trap helper and motion gate had no UI or consumers, so keyboard focus could still escape overlays and animation had no in-app switch.
- **Ship:** Applied focus traps to every dialog and added a Reduce animation toggle to the shortcut sheet.

### 66. Scroll orientation

- **Look:** The page runs from a cinematic stage into a dense editor; there was no indicator of position and no quick way back from the footer.
- **Ship:** Added a thin progress bar and a back-to-top button that appears after the first screen.

### 67. Inline FAQ

- **Look:** The same how-to questions were repeated in the footer prose and the import guide, with no scannable answer format.
- **Ship:** Added a compact four-question accordion covering legitimacy, in-game steps, preview accuracy and privacy.

### 68. What's new drawer

- **Look:** A long list of features accumulated with no way for a returning visitor to see what changed.
- **Ship:** Added a changelog drawer summarising the new capabilities, with focus trapping and keyboard dismissal.

### 69. Screen-reader code announcements

- **Look:** A code changes on every slider move, but nothing announced the result to assistive technology.
- **Ship:** Added a polite live region announcing how far the current code has moved from the in-game default.

### 70. Local rating widget

- **Look:** There was no signal of whether the tool helped a player get a code into the game, and no unobtrusive way for them to say so.
- **Ship:** Added a three-tap rating dialog that stores the answer locally and thanks the visitor without analytics or network calls.

### 71. Off-thread screenshot analysis

- **Look:** Analysing a large screenshot read and scanned every pixel on the main thread, stalling the preview while the visitor dragged images in.
- **Ship:** Added a dedicated web worker that measures the reference and baseline images and returns the panel values, with the CPU path as fallback.

### 72. Worker-based preview fallback

- **Look:** Browsers without WebGL graded half a million pixels on the main thread on every slider move, making the editor stutter.
- **Ship:** Added a CPU grading worker with request IDs to discard stale frames, keeping the synchronous path as a fallback.

### 73. Saved looks with thumbnails

- **Look:** A library row showed a long code and name but no visual reminder of the grade it held.
- **Ship:** Added a small captured preview to each saved look, taken from the live preview canvas at save time.

### 74. Query-string deep links

- **Look:** Only hash links worked; codes and looks sent as ?code= or ?look= links were ignored.
- **Ship:** Added query-string restore for both the editor code and the gallery look, alongside the existing hash format.

### 75. Closest-look hint

- **Look:** A hand-tuned grade had no anchor: players could not tell which built-in look it resembled or jump back to one.
- **Ship:** Added a weighted nearest-look chip in the code bar that loads the look and offers a one-tap undo.

### 76. Paste autocomplete

- **Look:** Typing a look name in the paste field gave no suggestions and looked like an invalid code.
- **Ship:** Added a live suggestion list of matching looks that loads a code directly on click.
