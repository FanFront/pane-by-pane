# Handcrafted Fantasy Workshop — Visual & Audio Overhaul

Status: **implementation roadmap** · 27 October 2026  
Repository: `FanFront/pane-by-pane`  
Scope: presentation, interaction feedback, and audiovisual experience only. No puzzle-rule or save-format rewrite.

## Vision

Make solving a puzzle feel like assembling a stained-glass window in a quiet fantasy artisan's workshop. Use walnut, parchment, warm brass, jewel-toned glass, and controlled sunlight. Artwork must support puzzle readability and never replace clear gameplay feedback.

### Non-negotiable constraints

- Retain existing engine, solver, generator, imported puzzle catalog, progress, saved boards, hints, undo/redo, hypothesis mode, pinch/rotate touch mapping, and Android Back behavior.
- Preserve `pbp:theme` values (`classic`, `modern`, `dark`), `PlayerState` color indices, and all existing localStorage/save formats. Make new preferences separately versioned.
- Keep everything available offline in the Vite/GitHub Pages and Capacitor APK builds. Only original or appropriately licensed assets.
- Readable clues, sufficient contrast, accessible controls, reduced-motion preference, and no default autoplaying music.
- Prefer Canvas 2D and cached textures; no new rendering engine or runtime framework.

## Engineering baseline (27 October 2026)

- `src/web/board.ts`: Canvas 2D, drawing, input gestures, cached grain/hatch, dynamic lighting, and short completion effects.
- `src/web/boardPalette.ts` + `src/web/theme.ts`: three themes with independently defined canvas colors.
- `src/web/haptics.ts`: Android vibration and iOS switch-based haptic feedback.
- `src/web/renderPerformance.ts`: DPR cap 2, completion effects limited to ~30 FPS and 2.8 s of shine.
- `src/web/main.ts`: single app entry, dialogs and completion UI, `BoardCallbacks`.
- `src/web/style.css` + `index.html`: responsive header, board stage, play toolbar, settings.
- No dedicated sound/music manager observed in the current app code.

## Art specification

### Theme identities

**Classic / Workshop (primary):** walnut and parchment surfaces, bronze accents, rich jewel glass, warm indirect light.  
**Modern:** preserve cool, clean geometry and affordances; adopt the same polished rendering structure, not brown surfaces.  
**Dark:** low-glare blue/charcoal, luminous accents, readable pale clue ink; do not reintroduce bright glass backgrounds.

Initial workshop colors: walnut `#382B28`, parchment `#F0E3CB`, brass `#BA8C46`, sapphire `#517CBA`, sunlight `#FFDCA0`. These are design tokens, not gameplay data.

Use subtle textured fills, material gradients, glass imperfections, small lead highlights, and spare ornamental borders. Symbols and numbered clues render above textures; the boundary hitboxes/geometry must remain unchanged. Empty cells must be recognizable as unfinished glass.

### Canvas pipeline

1. Static/cached texture patterns keyed by theme, cell scale/DPR, and material; deterministic seeds, no per-frame randomness.
2. Main painted-region glass fills, independently readable borders, and user strokes.
3. Clues/markers, errors, active hints/selection always above glass.
4. Temporary ambient/finish light effects, without a permanent animation loop.

Cache invalidation on theme/geometry changes; cap cache size where relevant. Keep `boardDevicePixelRatio` and the existing requestAnimationFrame coalescing. Never use large per-frame CSS blur filters over the canvas.

### Interface

- Workshop-style header, compact readable toolbar, parchment dialogs/cards, lightly embossed buttons, clear pressed/selected/focus states.
- Keep primary tools visible and minimum practical 44 CSS px tap targets.
- Preserve viewport height, board zoom/rotation, touch-action behavior, Android safe insets, and language switching.
- Favor decorative CSS backgrounds and original SVGs/procedural textures over large raster packs.

## Audio and feedback specification

Architecture: `src/web/audio/audioManager.ts` (lifecycle, mixing, gain, unlock), `soundEffects.ts` (short event-driven SFX), `musicPlayer.ts` (optional long compressed looping tracks), `experiencePrefs.ts` (versioned settings), `feedback.ts` (semantic player events).

Events: `pane-place`, `pane-erase`, `wall-add`, `wall-remove`, `undo`, `redo`, `hint`, `puzzle-complete`, `chapter-complete`. Trigger on actual logical changes, never on draw. Rate-limit drag SFX (~80–100 ms), cap concurrent voices, avoid sound storms on auto-finalize.

Short effects use Web Audio with envelopes; long music uses compressed streaming media. Resume only after an explicit user gesture and handle visibility/pause/resume. Sound effects and music have independent enabled/volume settings; haptics and effect intensity are separately configurable. Start music **off** by default; no network requests.

Recommended tonal palette: delicate glass ticks, soft solder taps, gentle paper/brush erasure, warm three-note glass-completion chime, quiet harp/piano/woodwind ambience.

## Rollout and PR boundaries

### PR 1 — Workshop visual foundation

- Introduce Workshop material tokens and visual style primitives with `classic` as the enhanced workshop identity.
- Refine header, buttons, settings/dialogs and toolbar styling without layout/input rewrites.
- Improve CSS focus/reduced-motion treatment and add independent design-token tests.
- Document art constraints and future asset provenance in the repo.
- Acceptance: modern/dark remain distinct; mobile interactions work; existing save files unchanged; screenshot baselines reviewed.

### PR 2 — Glass rendering and caches (stack on PR 1)

- Extract reusable deterministic glass surface treatment, including seed-based translucent texture and lead highlight parameters.
- Cache expensive per-theme/per-resolution patterns or layers and invalidate them correctly.
- Integrate into existing `Board.draw` without altering clue rendering, paint-color assignment, touch geometry, or completion detection.
- Add tests covering deterministic texture parameters, cache invalidation, palette readability and reduced-motion behavior.
- Acceptance: no extra continuous render loop, mobile board remains responsive, board presentation retains legibility at various sizes.

### PR 3 — Sound effects and preferences

- Add audio event bridge and manager; SFX controls, haptic toggle, mute/background handling.
- Ensure no unintended events on hint highlighting, redraw, load, reveal, undo/redo replay or completion auto-fill.
- Unit tests for sound throttling, preferences and lifecycle.

### PR 4 — Interaction and completion polish

- Integrate light and chimes using bounded timelines, reduced-motion support and background cancellation.
- No continuous particles during normal play.

### PR 5 — Music and progression artwork

- Original loopable ambient track(s), lazy media load, optional playback, chapter illustrations/badges, asset license ledger.

### PR 6 — Performance and release verification

- Visual regression screenshots, Android physical-device passes, CI builds and offline APK verification.

## Performance targets (targets, not current measurements)

| Area | Target |
| --- | --- |
| Normal gameplay | Responsive to 60 Hz touch on target mid-range Android hardware |
| Typical draw budget | Aim for <16.7 ms; instrument sustained slow frames |
| Completion | Retain bounded ~30 FPS/2.8 s shine (or faster graceful fallback) |
| Idle | No recurring animation frames |
| Canvas resolution | Current DPR cap of 2 by default |
| Audio | No overlapping audio storms, no errors with disabled/autoplay-blocked AudioContext |
| UI | Readable clues, accessible focus and practical 44×44 CSS px targets |
| Offline | Art and music bundled locally, no CDN calls |

## Verification per PR

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Check long/tall boards, 0/90/180/270 rotation, zoom and touch alignment, classic/modern/dark, English/Korean/Chinese, iOS overlay-haptic interactions, Android Back and safe area, first-level coach/tutorial overlays, stage completion and undo after completion. Extend `scripts/ui-drive.mjs` screenshots and `tests/render-performance.test.ts`.

## Implementation discipline

Do not merge multiple visual feature sets blindly. Open small PRs with before/after screenshots and performance notes. Do not edit puzzle rules or import formats. Update `AGENTS.md` to explicitly allow presentation-only work while retaining upstream/Android compatibility, with no attribution removal. Record origin/license for every image or audio asset.
