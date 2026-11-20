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
