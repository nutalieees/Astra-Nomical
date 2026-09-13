# PlanetScene: illustrative surface environments

The existing React Three Fiber renderer consumes `VisualEnvironment`, derived from
`Planet` and the unchanged astronomy module's `PlanetEnvironment`. Planet identity
selects explicitly curated illustration scenarios in the mapper and reproducible seeds in the renderer. Navigation, source data and
AI integration are unchanged. Visual assumptions appear in the science HUD.

## Scientific inputs and artistic treatment

- Gravity remains mass / radius² in Earth units; it bounds exaggerated relief.
- Radius becomes a local curvature radius, compressed by 3500. The continuous
  patch uses the local spherical approximation `y = -(x² + z²) / (2R)`.
  Observation height and nearby geological scale are artistic, not true scale.
- The existing temperature-derived stellar colour is reused. Angular stellar
  radius is `atan(apparentStarSize * 0.00465047)`, multiplied by 1.3 and bounded
  to approximately 0.6–8 degrees. Star placement is composed, not an ephemeris.
- Illumination is compressed logarithmically into directional light and exposure.
  Hemisphere fill preserves shadow detail. Scattering/fog are affordable visual
  approximations, not atmospheric retrievals or radiative-transfer calculations.
- Radius above four Earth radii selects cloud-only rendering. If radius is
  unavailable, giant/mini-Neptune/hot-Jupiter category selects clouds and an
  assumed ten-Earth-radius curvature; otherwise a one-Earth-radius rocky fallback
  is used. Gravity never classifies a gas giant. The rocky cutoff is a rendering
  fallback, not evidence of a solid surface (especially for intermediate radii).
- Cold equilibrium temperatures select weathered grey/brown rock and limited
  frost, not global ice. Temperatures at least 1400 K select hypothetical dark
  volcanic crust with localized molten fissures. Neither is a detected surface.
- WASP-121 b is viewed above three independently advected cloud/haze layers;
  there is no rocky mesh, landing area or walking control. Cloud composition,
  colour, layer spacing and motion are hypothetical.

## Geometry and performance

One nonuniform terrain patch has 240 × 240 cells (115,200 triangles), with dense
foreground samples and a continuous coarse curved distance region. Five seeded
noise octaves, micro-relief and a midground ridge supply different geological
scales. Normals are recomputed; rough procedural materials need no textures.
100–240 rocks use three reused, distorted geometries with instancing, varied
transforms and rough materials. Sampled terrain heights embed their bases.
The same transforms provide conservative movement collision bounds. Molten
channels use their own conforming ribbon geometry and emissive material; solid
crust is non-emissive. The detailed rocky grid is approximately uniform within
±60 units, then coarsens continuously toward the distant horizon.

One `ObserverCamera` owns every camera update. Before interaction it samples the
actual rendered triangles, retaining 2.8 units of rocky clearance (3.5 for the
illustrative crater viewpoint) during bounded
idle drift. The first interaction permanently pauses idle. Primary left-button
or one-finger pointer drag changes unwrapped yaw and pitch bounded to ±85° using
frame-independent damping. YXZ rotation has no roll; drag alone never translates
the observer. WASD/arrows and the compact direction buttons provide movement
relative to horizontal yaw, independent of pitch. Movement uses substeps no
larger than 0.2 units, conservative rock-circle collisions, local slope/height
checks and a 32-unit rocky / 65-unit floating travel radius. There is no orbit,
pointer lock, or automatic return-to-center. Keyboard input is ignored on UI
controls and held input is cleared on focus loss or page visibility changes.
RESET VIEW restores the original position and orientation and leaves idle paused.
Pointer capture supports dragging out of Canvas and cancellation. Atmospheric eye
height is independent of any ground. Reduced motion pauses idle and cloud motion.

Rotation listeners are attached only to Canvas, never HUD panels. HUD input also
pauses idle, but cannot turn the view. Canvas uses `touch-action: none`; scrollable
HUD panels use `pan-y` and contained overscroll. Compact science metrics expand to
all labels/assumptions. On narrow screens science sits below the look controls
and Evolve Life sits at the bottom, each with bounded scrolling. Expanding science
does not hide an active life simulation or its Retry action.

Clouds use three 120 × 120-cell curved layers extending ±5000 scene units beyond
the bounded giant scenarios' tangent horizons, density shaders and differential
motion. The full sky shell lies at 8000 units inside the 10000-unit far plane.
Background stars use one 1,200-point draw, dimmed with sky brightness.
There is one 1024² shadow map, Canvas DPR is bounded to 1–1.5, no post-processing,
no external assets, and no per-frame React state. GPU resources are disposed on
world changes. This is not a full planetary walking simulator or volumetric
weather model; clouds remain visibly stylized, especially at grazing angles.

## Checks

`node --experimental-strip-types scripts/verify-planet-scene.cjs` (Node 24+)
checks featured-world scenarios, deterministic geometry/mappings, finite invalid
input fallbacks, upward unit normals, and independent raycast camera clearance
across a complete repeating motion cycle, plus downward ray coverage in every
15-degree azimuth at shallow, medium, and steep pitches. Also run `npm run typecheck` and
`npm run build`, then inspect each featured demo world through the normal UI.

The checks also cover deterministic rock placement, bounded movement, rock
tunnelling prevention and rejection of steep slopes. The PERFORMANCE disclosure
samples 120 R3F callbacks after 30 warm-up frames, recording median/p95 intervals,
callback rate, viewport, buffer size, renderer and draw/triangle counts. This is
not GPU timing. TEST WEBGL RECOVERY intentionally loses the context through the
standard extension; the error state offers retry and return to the same overview.

## Five illustration scenarios and evidence boundaries

The landscape ideas from `ca61786` were inspected and adapted (not merged) onto
the newer exit-navigation implementation at `9fe90e3`.

- TRAPPIST-1 e: jagged charcoal ridges and fractured rock with limited frost.
- Proxima b: low weathered crater rims/basins, low boulders and an assumed minimal
  atmosphere. This is not a claim that atmospheric loss or craters were observed.
- Kepler-186 f: broad pale ridges and fractured frost-covered formations beneath
  an assumed scattering atmosphere. Ice/water are not inferred from temperature.
- 55 Cancri e: dark solid crust and separate, localized molten channels.
- WASP-121 b: floating above three moving cloud/haze layers, without rocky ground.

These are artistic scenarios, not new scientific discoveries. Primary-source
checks support maintaining that distinction: [NASA on Proxima b](https://science.nasa.gov/exoplanets/big-questions/)
describes the atmosphere as a condition on surface-water possibilities;
[NASA's Kepler-186 f artist-concept notes](https://science.nasa.gov/photojournal/kepler-186f-the-first-earth-size-planet-in-the-habitable-zone-artists-concept/)
distinguish measured size from unknown composition; [Webb's 55 Cancri e report](https://science.nasa.gov/missions/webb/nasas-webb-hints-at-possible-atmosphere-surrounding-rocky-exoplanet/)
reports spectral atmospheric evidence, not a resolved lava map; and
[Hubble's WASP-121 b report](https://science.nasa.gov/missions/hubble/hubble-uncovers-heavy-metal-exoplanet-shaped-like-football/)
reports atmospheric spectral signatures, not the cloud shapes rendered here.
