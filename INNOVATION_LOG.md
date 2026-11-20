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
