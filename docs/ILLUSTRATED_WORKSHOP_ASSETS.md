# Illustrated Workshop assets (October 2026)

This pack makes the Classic theme visually different from the original flat UI.

- `workshop-scene.svg`: original procedural workshop environment with stained-glass side windows, shelves and candlelight, and a quiet center so clues remain readable.
- `workshop-crest.svg`: original leaded-glass pointed-arch brand icon.
- `workshop-chapter.svg`: original illustrated fantasy chapter header with mountains and a cathedral.
- No third-party image downloads, extracted Glimmith artwork, external fonts, or media licenses are required for these vector assets.
- Concept-art inspiration was generated separately; these production SVG assets are original authored graphics.

Integration: Workshop (Classic) only. Modern and Dark retain their previous visual identities. The scenery is a static CSS background and the board frame does not accept pointer input; the canvas, zoom transform, touch hitboxes and saved state are unchanged.

The deterministic glass-rendering changes from #25 are now present on `main` through #26. This art-only branch builds on that rendering baseline without modifying the puzzle engine. See `docs/GLASS_RENDERING.md`.

## Visual QA

Review Android phone 320/390 px portrait, landscape/90-degree rotation, tablet and desktop. In particular test undo/redo, board rotation/reset controls, edge drawing, swiping near the frame, haptic switch overlay on iOS, main goal strip, three themes, rules/settings dialogs and long puzzle completion. Do not merge if visible artwork hides clues or adds input latency.
