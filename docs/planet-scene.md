# PlanetScene: illustrative surface environments

The existing React Three Fiber renderer consumes `VisualEnvironment`, derived from
`Planet` and the unchanged astronomy module's `PlanetEnvironment`. Planet identity
is used only for reproducible geometry/random seeds. Navigation, source data and
AI integration are unchanged. Visual assumptions appear in the science HUD.

## Scientific inputs and artistic treatment

- Gravity remains mass / radius² in Earth units; it bounds exaggerated relief.
- Radius becomes a local curvature radius, compressed by 3500. The continuous
  patch uses the local spherical approximation `y = -(x² + z²) / (2R)`.
  Observation height and nearby geological scale are artistic, not true scale.
- The existing temperature-derived stellar colour is reused. Angular stellar
  radius is `atan(apparentStarSize * 0.00465047)`, multiplied by 1.8 and bounded
  to approximately 0.6–12 degrees. Star placement is composed, not an ephemeris.
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
220 rocks share one instanced geometry/material and are embedded using sampled
terrain heights. Rocks and ridges surround the observer through all 360 degrees;
rock placement excludes the entire camera corridor.

One `ObserverCamera` owns every camera update. Before interaction it samples the
actual rendered triangles, retaining 2.8 units of rocky clearance during bounded
idle drift. The first interaction permanently pauses idle. Primary left-button
or one-finger pointer drag changes unwrapped yaw and pitch bounded to ±85° using
frame-independent damping. YXZ rotation has no roll; the position stays fixed
after interaction. There is no orbit, pointer lock, or automatic return-to-center.
RESET VIEW restores the original position and orientation and leaves idle paused.
Pointer capture supports dragging out of Canvas and cancellation. Atmospheric eye
height is independent of any ground. Reduced motion pauses idle and cloud motion.

Rotation listeners are attached only to Canvas, never HUD panels. HUD input also
pauses idle, but cannot turn the view. Canvas uses `touch-action: none`; scrollable
HUD panels use `pan-y` and contained overscroll. Compact science metrics expand to
all labels/assumptions; on narrow screens expanded science temporarily occupies
the bottom dock, with Evolve Life available again when collapsed.

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
