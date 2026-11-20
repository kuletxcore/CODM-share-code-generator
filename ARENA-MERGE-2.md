# Arena round 2: what was merged and why

Nine more remakes were produced in arena.ai, most of them running a variation of the make-it-better prompt ("make one bold change that improves conversions, intuitiveness, optimisation and look and feel"). This file records how they were judged, what landed on the `claude-merge` branch and what did not. [DESIGN.md](DESIGN.md) holds the resulting design rules; this is the history behind them.

| Branch | PR | Headline |
|---|---|---|
| 5a181f54 | #29 | "100 look → innovate loops": about 100 commits, 4.5k lines |
| 28efe1cc | #28 | Blend Atlas: 100 split-tone codes |
| 35a5bc8c | #27 | Vibe Finder and Mission Console |
| 4d4b3931 | #26 | Review plus 21 improvements |
| 12264238 | #25 | Wall of looks, agent instructions, CI |
| 6c718d40 | #24 | Codec hardening, accessibility, tests, CI |
| fae6c3f0 | #23 | Live try-on: one frame for everything |
| 9a3eb115 | #32 | Duel: two looks on one frame |
| c7b90aa5 | #31 | Screen test: every look on your own screenshot |

The first seven were cut from `b111356`. The last two were cut from `ca029bc` (after PR #30, which added strict share-code validation, tests and CI).

## Method: elephant and goldfish

This round used the [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model) (EGM). The "elephant" holds the project context and makes the decisions. The "goldfish" reviewers see only the material and none of the earlier conversation, so they don't inherit its assumptions.

1. **Build every branch.** Each branch was checked out on its own and run through lint, its tests and `next build`. All nine build. Their test status:
   - Two had no tests: 5a181f54 and fae6c3f0.
   - 28efe1cc and 35a5bc8c ran no tests either.
   - 4d4b3931 switched the test runner to vitest, so its tests did not run under the repo's runner.
2. **Goldfish review, one per branch.** Nine fresh-context reviewers each got the same brief:
   - the branch diff and commit log
   - the build result
   - DESIGN.md and the README
   - an instruction to be adversarial, cite file and line, and judge each feature separately on user value, correctness, design-rule violations, honesty (unsourced claims, invented data), cost and separability

   Each feature got PICK, PICK-WITH-FIXES or DROP.
3. **Elephant synthesis.** The verdicts were weighed against the project's history: what the owner already rejected, what main already does, and what the game actually accepts. Ideas that several branches reached independently counted for more.
4. **Port, then fix what the reviewers found.** Each pick was re-checked in Chromium at desktop and phone sizes where it touches the UI.

## Where the branches agreed

| Idea | Branches | Outcome |
|---|---|---|
| Open Graph link preview | 35a5bc8c, 4d4b3931, 5a181f54, 6c718d40, fae6c3f0 | Picked |
| Looks on the visitor's own frame | c7b90aa5, fae6c3f0, 12264238 | Picked (c7b90aa5's version) |
| Undo/redo | 4d4b3931, 5a181f54 | Picked, rewritten |
| Clipboard write before any async work | c7b90aa5, 9a3eb115 | Kept as `copyText` |
| Recent and favourite codes | 35a5bc8c, 5a181f54 | Deferred |
| Service worker for offline use | 4d4b3931, 5a181f54 | Dropped: both broken |
| Tests and CI | 4d4b3931, 6c718d40, 12264238 | Already on main (PR #30) |

## Picked

| What | From | Why, and what was fixed on the way in |
|---|---|---|
| **Screen test.** Drop, pick or paste one screenshot; the stage, filmstrip and generator preview are graded on it, with hold-to-compare | c7b90aa5 | Fixes the gallery's main weakness: choosing a subtle look from stills of other maps. Three branches arrived at it. The fixes are listed below this table. |
| **Undo/redo.** Buttons plus Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z (or Ctrl+Y) | 4d4b3931, 5a181f54 | Rewritten, because both versions had bugs: a drag became 60 steps, loading a code wiped the history, an unstable dependency cancelled the commit timer, and the link restore could be undone. Now share codes are the steps, a drag settles into one step after 400 ms, loads and pastes are steps, and the shared link's code is the starting point. Checked in Chromium. |
| **Link preview card** | metadata from 6c718d40 | Codes travel as links in chats. The branch's image used a generic font, so it was redrawn in the brand fonts from the owner-approved Hajin still: 85 KB, marked "Unofficial fan-made tool", with a real share code. |
| **Faster CPU grade** (`gradePlan`/`paintGrade`) | 12264238 | Builds the per-zone constants once instead of per pixel, skips zones that change nothing, and returns early for the reset code. Its oracle test keeps the original loop and asserts identical pixels on every look, every preset and random settings. Speed matters now that the screen test grades every look on the CPU. |
| **Paste a code inside surrounding text** (`extractCode`) | 5a181f54 (`normalizeCode`), reworked | Text such as "Hajin: 0_1_…", a share link or space-separated numbers now loads. It only finds the 22 numbers; `decode` stays strict, as AGENTS.md requires. The branch's version would have glued together numbers from unrelated text. |
| **Honest copy result** | 4d4b3931 | Copy said "Copied" even when the browser blocked the clipboard. The bar now says "Blocked", the import guide heading says "Copy blocked · select the code below", and screen readers get a status message. |
| **Screen-reader fixes** | 6c718d40 | The autoplaying stage and the 22-number code readout were live regions, so a screen reader re-read them every 7 s and on every slider step. Now only a deliberate pick is announced. Focus inside the stage pauses autoplay, and Home and End work on the filmstrip. |
| **Hue 1000 is Magenta at slider 100** | 6c718d40 | `hueParts` wrapped 360° to Red at 0, which showed the wrong swatch and rewrote the hue on the next drag. |
| **Screenshot analysis skips empty tonal ranges** | 6c718d40 | A frame with no shadows no longer gets an invented shadow grade. The threshold is 0.5% of pixels, not exactly zero, because zone weights are smooth. |
| **Uploads capped on the long side** | fae6c3f0 | A portrait phone screenshot (1080×2400) exceeded the 2048px texture limit some phone GPUs have, which left the preview empty. |
| **A cancelled share no longer downloads** | 6c718d40, fixed | Only `AbortError` counts as a cancel. iOS throws `NotAllowedError` when the tap is too old after the card render, and that case still falls back to a download so the card isn't lost. |
| **Focus returns after the import guide closes** | 4d4b3931, adapted | The guide is a non-modal sheet, so it gets focus return rather than the branch's focus trap. The fallback copy no longer leaves focus on the page body. |
| **One set of agent instructions** | 12264238's idea, simpler form | Covered under [Agent-agnostic repo](#agent-agnostic-repo). |

### Fixes applied to the screen test

- The screenshot is a fallback preview source and is no longer copied into the upload slot, so "Sample scene" works again.
- Labels keep "approx.".
- The look card keeps the "Fan-made filter lab" marker. The branch had replaced it with "On your screen", but every card must carry the marker.
- The panel warns that saved cards show the screenshot, which may contain gamer tags.
- The panel moved below the gallery, so the looks stay on the first phone screen. Its button is secondary, so Copy remains the one yellow action.
- The Ctrl V hint is hidden on touch screens.
- Grades run one per task. A replaced screenshot's cached pixels are freed; they used to leak several MB per size.
- The cache comment no longer claims the stage frame is "pinned".
- Holding Compare stops autoplay.

Profiling showed no long tasks after an upload once page start-up is excluded.

## Dropped

| What | From | Why |
|---|---|---|
| Blend Atlas: 100 mixed codes | 28efe1cc | Mechanical pairings of the 11 looks, never previewed, and the captions are wrong: the second look also contributes the Range and whole-image group. Presented as a curated "field archive". |
| Vibe Finder | 35a5bc8c | Six invented grades described as "tuned by hand", with gameplay claims like "spotting enemies at range". That breaks the content rule against unsourced claims. A no-slider path is a good idea, but it would need looks tested in game. |
| Mission Console | 35a5bc8c | A panel that opens itself at up to 62% of the viewport over the phone layout, plus a second import UI and a progress row that never advances. |
| Wall of looks | 12264238 | Every look on the sample scene, which the owner already rejected because the subtle looks look alike there. It also said "your screenshot" when no screenshot existed, and had 20px buttons and a dozen yellow ones. The screen test is the version of this idea that works. |
| Generated agent-instruction mirrors and sync script | 12264238 | About 450 lines of copies to keep in sync; imports do the same job. |
| Duel: two looks split on one frame, `#d=` links, duel card | 9a3eb115 | Copying inside the duel opens the import guide hidden behind it [P1]. The highlighted button steers players to Default. It adds a third copy of the grading shader with no self-test and about 600 lines on the critical path, and it revives the sample-scene comparison. The `#d=` link format and its tests were sound; worth revisiting on top of the screen test. |
| Live try-on page rewrite | fae6c3f0 | One graded frame for everything, starting on a real look. Strong, but it is a whole-page rewrite (−1269 lines in FilterLab) that reverses two owner decisions, makes an AI-generated frame the hero and preview image, and loses the visitor's own mix whenever any code loads. Its separable parts (upload cap, preview metadata) were taken. |
| Plain-WebGL smoke, removing three.js | fae6c3f0 | Only pays off together with the rewrite; main's preview still renders its sample scene with three.js. |
| Clamping `decode` and a vitest suite | 4d4b3931 | Silently coercing an out-of-range code is exactly what AGENTS.md rule 2 forbids, and a runner dependency goes against the repo's `node:test` convention. |
| Falloff cap of 1500 in `decode` | 6c718d40 | An invented limit. The game's maximum isn't known, so real codes could be rejected. |
| Service workers and "offline" | 4d4b3931, 5a181f54 | Both cache-first with no bound and serve stale payloads after a deploy. 5a181f54 never caches the JavaScript, so its "installable and offline" claim is false. |
| Auto-match score | 4d4b3931 | Shows a "%" from its own model, which the hill-climber then maximises, so it always looks good. A second Auto-match silently reverts. |
| Code inspector | 5a181f54 | Misstates brightness (a neutral value shows as −50), in the tool meant to explain the code. |
| Code anatomy | 4d4b3931 | Useful idea, but 36×24 px cells, hard-coded colours and text below AA contrast. |
| Onboarding modal, "What's new", local rating, scroll tools, scan sweep, density toggle | 5a181f54 | Friction for a player with the game open. Nine backdrop blurs against a limit of two, constant animation, a rating that goes nowhere, and a density toggle that shrinks tap targets below 44px. About half the branch's commits only edit its own log, and its docs describe features that don't exist. |
| Workers and "match strength" | 5a181f54 | The workers offload nothing (the work still runs on the main thread). The strength slider can produce codes the game's ranges don't allow. |
| Typecheck workaround and docs | 6c718d40 | Main already fixed this with `next typegen`. |

## Final review of the merged branch

A fresh-context goldfish reviewed the combined diff of `claude-merge` against `main`. All seven findings were real and are fixed, with tests where the logic is pure. Both new tests fail on the code before the fix.

| Finding | Fix |
|---|---|
| [P1] "Copy again" in the import guide used only the clipboard API, ignored the error and showed "Copied ✓" | It uses the same `copyText` as every other copy and shows "Blocked" on failure |
| [P2] The toast shown to visitors who turned the guide off always said "Code copied" | It says "Copy blocked" when the copy failed |
| [P2] `extractCode` accepted a code with a stray number before or after it separated by a space or comma, shifting every value one slot | The match must not touch another number on either side; four new test cases |
| [P2] Ctrl/Cmd+Z did nothing while a slider had focus, which is right after every edit | Only text fields and editable regions keep their own undo; checked in Chromium with focus on the slider |
| [P2] A slow screenshot load could replace a newer one, or come back after Remove | Each load gets a ticket; a newer load or Remove makes older ones stale, and caches are dropped only when a shot is accepted. Checked in Chromium |
| [P3] The screen-test cache (14) was smaller than one autoplay cycle (12 looks at two sizes), so stage frames were regraded every 7 s | 28 entries |
| [P3] The empty-band threshold in `analyse` was 4× too strict, because it compared against all pixels while `zoneStats` samples every fourth | Compared against the sampled total; new test with a 1% dark strip |

Unhandled rejections in the screen-test frame are now caught.

## Deferred

These are worth doing; this round stayed focused on the clear picks.

- **Recent and favourite codes on this device** (35a5bc8c, 5a181f54). Both had bugs, such as stale names, saved names ignored, or a localStorage write on every slider tick.
- **A page per look at `/look/<slug>`** (4d4b3931). Each look gets an indexable, shareable URL. Needs a lazy-loaded card renderer and an honest fallback image.
- **A code bar that docks only when Copy is out of view** (fae6c3f0).
- **"Needs tweaking"** (5a181f54): after import, reopen the editor with the imported grade pinned for comparison. The pin wipe needs its inverted clip fixed first.
- **Duel links** (9a3eb115), on top of the screen test.

## Follow-up: real scenes instead of the three.js scene

fae6c3f0's one-frame preview used an AI-generated stand-in. The idea was right, since a believable frame shows a grade better than a low-poly scene, but the image was not a CODM capture. The owner supplied a clean, HUD-free showcase video instead, and the preview now uses five real CODM stills from it (Shipment 2019, Combine, Hijacked, Armada Strike, Crossfire; names checked against published sources), recorded on the default filter, credited to the channel, and checked for gamer tags. `src/lib/scene.ts` and the three.js preview render are gone; three.js now only draws the smoke background.

## Agent-agnostic repo

[AGENTS.md](AGENTS.md) is now the one set of instructions for any coding agent. Codex, Copilot, Cursor, Windsurf, Jules and others read it directly. `CLAUDE.md` and `GEMINI.md` import it with `@AGENTS.md`, `.github/copilot-instructions.md` points to it, and `.aider.conf.yml` loads it as read-only context. Nothing is generated, so nothing can drift.
