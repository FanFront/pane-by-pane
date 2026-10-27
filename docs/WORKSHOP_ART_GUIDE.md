# Workshop visual art guide

Visual north star: an intimate fantasy stained-glass workshop, not a copy of another game's assets.

## Materials

- Walnut: dark handcrafted frame and background accents.
- Parchment: readable UI cards and settings in Classic.
- Brass: focused actions and delicate separator highlights.
- Jewel glass: saturated but translucent panes; the clue numbers must stay legible.
- Light: soft sunrise tones that intensify briefly on a verified win.

The Classic theme receives the full workshop treatment. Modern remains clean and cool;
Dark remains low-glare with readable pale clues. All three reuse a consistent UI hierarchy.

## Artwork implementation and asset rights

This first iteration uses original procedural CSS gradients and Canvas patterns only,
so no third-party image packs or fonts need attribution. Any later image/music asset must
have an explicit provenance and license entry before being committed.

Do not put textures over clue ink, increase line thickness enough to interfere with
edge interpretation, animate the board indefinitely, or use CSS filters that degrade
Android canvas performance. Honor reduced-motion and UI focus visibility.

## Visual QA

Review Classic, Modern, Dark at 320px, 390px and desktop widths. Check all rule
symbols, panel overlays, rotation/zoom, completion, hint errors, Android safe area
and large irregular boards. Compare idle and active drawing performance.
