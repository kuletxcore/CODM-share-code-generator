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
