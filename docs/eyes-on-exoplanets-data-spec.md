# Eyes-on-Exoplanets-style Feature — Data Spec (no data pulled yet)

Status: **spec only**. Nothing in this document has been fetched or
verified against live data. This exists so that *if* an orbital-map /
browsing layer becomes worth building mid-hackathon, the field list and
known gotchas are already worked out.

## What this feature actually is

NASA's real "Eyes on Exoplanets" is a navigable 3D map of thousands of
real star systems with orbits animated in real time — you fly between
systems, and confirmed planets visibly orbit their stars at the correct
relative speed and shape. It's built directly on the NASA Exoplanet
Archive and updates as new planets are confirmed.

This is a **different product shape** than Astra-Nomical's core loop
(choose one planet → stand on its surface → Evolve Life). An
Eyes-on-Exoplanets-style feature would most naturally sit as an enhanced
"front door" browsing screen before a user drills into a specific
planet's surface — not a replacement for the surface experience, and not
connected to the Evolve Life / biology reasoning at all.

## Additional fields needed beyond the core `Planet` model

The core `Planet` type (see `../src/types/planet.ts`) is one star per
planet, with a static orbital distance. This feature needs more:

| Field | Why | Availability caveat |
|---|---|---|
| Full Keplerian orbital elements: eccentricity, inclination, argument of periapsis, longitude of ascending node, epoch of periastron passage | To animate the planet actually moving along its real orbit over time, not just sit at a fixed distance | Frequently incomplete. Eccentricity/inclination are often measured for well-studied systems but unconstrained (defaulted to 0/assumed) for smaller or fainter ones. Longitude of ascending node is often undefined/degenerate for single-planet systems since it depends on viewing geometry that isn't always solvable. |
| Star right ascension (RA) + declination (Dec) | To place each star system at a real position in a navigable 3D sky/map | Available for essentially all archive entries (`ra`, `dec` columns) |
| Star distance (already have `sy_dist`, but needed in a coordinate-frame-ready form, not just light-years for display) | To convert RA/Dec/distance into actual XYZ coordinates for 3D placement | Available for the vast majority of confirmed-planet host stars |
| Grouping of planets by host star (one-to-many) | Real systems often have multiple planets (TRAPPIST-1 has 7); the core `Planet` model is flat | Not a data availability issue — a modeling change (group by `hostname`) |
| Stellar luminosity (or derivable via Stefan-Boltzmann from `st_rad` + `st_teff`, already in the core model) | Needed to compute habitable-zone boundaries | Derivable from existing fields, not a new fetch |
| Discovery method + facility (`discoverymethod`, `disc_facility`) | Info-panel flavor text, matches the real tool's UI | Directly available, already listed as an optional field in the core `Planet` type |
| Solar system's own orbital elements | For the "compare orbits" overlay | Well-known constants, not fetched from the archive |

## Math needed beyond `deriveEnvironment()`

1. **Kepler orbit propagation** — given the elements above and a
   timestamp, solve Kepler's equation (`M = E - e·sin(E)`, solved
   iteratively for eccentric anomaly `E`) to get the true anomaly, then
   convert to a 3D position relative to the star. This is what makes the
   orbit animate correctly instead of just drawing a static ellipse. This
   is the one piece of real implementation risk here — it's a standard
   astrodynamics routine, not exotic math, but it's meaningfully more
   work than anything in the core `deriveEnvironment()` pipeline.
2. **Habitable-zone boundary calculation** — given stellar luminosity and
   temperature, compute inner/outer HZ radii in AU. The commonly cited
   reference is Kopparapu et al. (2013)'s conservative/optimistic
   boundary formulas; a simpler flux-based approximation
   (`r_inner ≈ sqrt(L / 1.1)`, `r_outer ≈ sqrt(L / 0.53)`, L in solar
   units) is a reasonable stylized stand-in if the full formula isn't
   worth the implementation time.
3. **RA/Dec/distance → XYZ** — standard spherical-to-Cartesian
   conversion, trivial once distance is in consistent units.

## Candidate systems worth targeting first (names only, no data pulled)

These are well-characterized, visually distinct, multi-planet systems
that would be reasonable first targets if this feature gets picked up —
chosen because their orbital elements tend to be relatively
well-constrained compared to the average confirmed system:

- **TRAPPIST-1** (7 planets, tightly packed, dramatic to animate)
- **Kepler-90** (8 planets — same planet count as our own solar system)
- **HR 8799** (4 directly-imaged planets — unusually, these have actual
  imaged positions over multiple years rather than purely inferred orbits)
- **55 Cancri** (5 planets, already have one featured — good "zoom out"
  moment from the demo)
- **HD 219134** (multiple rocky planets, one of the nearest such systems)
- **TOI-178** (6 planets in an unusual orbital resonance chain — visually
  interesting orbit geometry)
- **Kepler-11** (6 planets, extremely compact — all closer to their star
  than Venus is to the Sun)

## Recommendation

Treat this as a genuine stretch item (AGENTS.md P2 territory), and only
after the core journey is fully working. If pursued, start with a
stylized, non-real-time arrangement of systems using only fields already
in the core `Planet` model (orbital distance, radius, star temperature) —
that alone gets most of the visual "browse many worlds" value. Only add
the full Kepler-orbit-propagation math if there's spare time and the
live-animated-orbit effect specifically is worth the build risk.
