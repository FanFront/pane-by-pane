# Workshop glass rendering — PR 2

This implementation replaces the old single hardcoded hand-rolled grain pattern
with a compact deterministic material tile per theme, device DPR and coarse cell-size
bucket. `GlassTextureCache` owns one CanvasPattern at a time. Board loading
invalidates it; theme changes and resolution changes naturally change its key.

- Does not change `PlayerState`, color indices, clue coordinates or gesture mapping.
- Does not animate texture grain, draw extra frames, add remote assets or use WebGL.
- The texture is deterministic, generated from a seeded xorshift RNG.
- Clues, error hatching, hints and borders continue to paint over the glass.
- Classic adopts warmer unpainted glass and lead; Modern and Dark keep their own ink palettes.
- The existing bounded completion lighting remains unchanged.

Inspect thick lead joints, dark-mode clue contrast, and thin rotated boards on
real devices. Texture creation should be visible only on board load or theme/DPR
bucket changes, never every move or every animation frame.

### Validation notes

Before merging, review screenshot baselines for Classic, Modern and Dark; capture
an unpainted board, a mostly painted board and a completed board. Rendering
performance must be measured on a real Android device with a large level,
not inferred only from desktop test results.
