# Reconstructing an exoplanet sky for Astra-Nomical

Prepared 13 September 2026. Implementation guide; the application has not been modified.

Build a catalogue-backed celestial sphere: locate stars in 3D, move the observer to the selected planetary system, recalculate directions and brightness, then render that sky through an explicitly assumed atmosphere. Start with cached skies for the five featured worlds.

The result can credibly show how familiar star patterns change. It cannot uniquely predict the view from a planet's surface without its spin orientation, observing location, local time, and atmosphere. Offer an **assumed clear night** and an **enhanced exposure** option so a rich star field has an honest explanation.

## 1. Where this fits in the existing project

I inspected the local checkout whose origin is `https://github.com/nutalieees/Astra-Nomical.git`. GitHub's page was unavailable through the research browser, so these findings describe the local files rather than a verified remote HEAD.

| Existing implementation | Proposed change |
| --- | --- |
| `src/components/scene/PlanetScene.tsx`, `Starfield` | Replace 1,200 name-seeded random points on the upper hemisphere with catalogue-derived directions, individual colors, and fluxes. |
| `Starfield` currently uses `v.starColor` for every point | Give each background star its own color; the host star does not tint other stars. |
| `Sky` draws a gradient; `HostStar` is separate | Retain those components, adding visibility/transmission shared with the star renderer. |
| `src/lib/astronomy/visual-environment.ts` | Replace the global star-opacity heuristic with local sky brightness/exposure controls. Host position is currently fixed; size is artistically enlarged and clamped. |
| `src/types/planet.ts` | Add host astrometry or associate a separate system-position record. Distance alone cannot locate the observer in 3D. |
| `observer-camera.tsx` | Keep drag-to-look. It already allows pitch to 85 degrees; optionally add a “Look up” action. |

Keep `deriveEnvironment()` focused on environmental properties. Add a deterministic `deriveSky()` or an offline equivalent, with no LLM-generated star coordinates.

## 2. Datasets to obtain

### Required: NASA Exoplanet Archive — destination positions

Use `pscomppars` through the [NASA TAP service](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html). Retrieve `pl_name`, `hostname`, `ra`, `dec`, `sy_dist`, and distance uncertainties. Retain `st_rad`, `st_teff`, and `pl_orbsmax` for the local host-star disk. NASA documents angular coordinates in degrees and system distances in parsecs in its [column definitions](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html).

Example query:

```sql
SELECT pl_name, hostname, ra, dec, sy_dist,
       sy_disterr1, sy_disterr2, st_rad, st_teff, pl_orbsmax
FROM pscomppars
WHERE pl_name IN (
  'TRAPPIST-1 e', 'Proxima Cen b', '55 Cnc e',
  'WASP-121 b', 'Kepler-186 f'
)
```

Run against `https://exoplanetarchive.ipac.caltech.edu/TAP/sync` using URL-encoded `query` and `format=json` parameters. Confirm returned canonical names and map them to the app's display names. Fail data preparation if any featured world is missing. These example queries were not executed for this guide.

Store retrieval dates, references, units, and coordinate epochs. Prefer cross-matched host astrometry from the same catalogue/epoch as the background stars; NASA's composite fields can come from different references.

### Fast prototype: HYG — manageable star catalogue

[HYG](https://codeberg.org/astronexus/hyg) combines existing stellar catalogues in a convenient format. Its [archived field documentation](https://github.com/astronexus/HYG-Database/blob/main/hyg/README.md) describes `x,y,z` positions in parsecs, `mag`, `absmag`, color index `ci`, spectral type, names, and velocities. Use Cartesian positions to avoid angular-unit mistakes. Reject `dist >= 100000`, which flags dubious/missing distances, rather than treating those stars as accurately positioned. The documented coordinates use epoch 2000.0.

Use this to get the first working translated sky, then improve completeness with Gaia. HYG is an Earth-selected sample and cannot guarantee every star visible at another system. Preserve attribution and the [CC BY-SA 4.0 licence](https://github.com/astronexus/HYG-Database/blob/main/LICENSE) with derived catalogue assets.

### Recommended upgrade: Gaia DR3 — deeper astrometry and photometry

Get a subset through the [Gaia Archive](https://gea.esac.esa.int/archive/), rather than shipping the full survey. DR3 provides extensive astrometry and photometry, but has a bright limit around G=3 and is not a complete bright-star replacement. Keep curated bright stars and companions missing from Gaia. See [ESA's release summary](https://www.cosmos.esa.int/web/gaia/dr3).

Retrieve these fields from `gaiadr3.gaia_source`:

```text
source_id, ref_epoch, ra, dec
parallax, parallax_error, parallax_over_error
pmra, pmdec, radial_velocity
phot_g_mean_mag, phot_bp_mean_mag, phot_rp_mean_mag, bp_rp
ruwe
```

The [Gaia data model](https://gea.esac.esa.int/archive/documentation/GDR3/Gaia_archive/chap_datamodel/sec_dm_main_source_catalogue/ssec_dm_gaia_source.html) defines their units and conventions. Store `source_id` as a string: JavaScript numbers cannot safely represent every 64-bit catalogue identifier. G is a photometric band, not the green display channel; BP−RP is not HYG's B−V.

An intentionally incomplete seed query is:

```sql
SELECT source_id, ref_epoch, ra, dec, parallax,
       parallax_error, parallax_over_error, pmra, pmdec,
       radial_velocity, phot_g_mean_mag, bp_rp, ruwe
FROM gaiadr3.gaia_source
WHERE phot_g_mean_mag < 12
  AND parallax_over_error > 10
```

Those thresholds are engineering choices for a prototype, not a completeness claim. Do not use a small cone around the host as the whole sky: the observer needs stars in every direction.

### Distance estimates and nearby-star coverage

For uncertain parallaxes, use [Bailer-Jones geometric/photogeometric distance estimates](https://bailer-jones.www3.mpia.de/gedr3_distances.html), available in ESA's `external.gaiaedr3_distance`. Retain median distance and lower/upper bounds; these are inferred distances, not exact measurements. Verify catalogue identifiers when joining releases.

The [Gaia Catalogue of Nearby Stars](https://www.cosmos.esa.int/web/gaia/edr3-gcns) is a useful supplement around the Sun. It is not a catalogue centred on every destination and cannot alone cover the more distant featured systems.

### Optional later: dust and bright-star supplements

For more accurate brightness, [Edenhofer et al.'s 3D dust dataset](https://zenodo.org/records/8187943) supplies spatial dust information over a bounded region around the Sun. This is a substantial offline upgrade. Integrate local differential dust density along the destination-to-star path; an Earth-centred cumulative extinction value cannot simply be reused for another observer. Respect map coverage and uncertainty.

[Hipparcos](https://www.cosmos.esa.int/web/hipparcos/catalogues) can supplement bright stars. Deduplicate against Gaia/HYG with catalogue cross-identifiers and epoch-aware positions. Preserve each download's attribution and usage terms.

## 3. Transform the catalogue into the destination sky

These equations define the proposed geometric approximation. Use one inertial frame, one epoch, and parsecs throughout preprocessing.

### Convert position to Cartesian coordinates

For right ascension α and declination δ in radians, and distance d in parsecs:

```text
x = d cos(δ) cos(α)
y = d cos(δ) sin(α)
z = d sin(δ)
```

Convert NASA/Gaia degrees to radians first. With precise positive parallax, `d ≈ 1000 / parallax_mas` is a useful approximation; it is unreliable for noisy or nonpositive parallax. Use inferred distances or omit uncertain objects from the measured 3D layer instead of inventing precise distances.

Choose a fixed catalogue epoch for the demo. If mixing epochs, propagate both stars and hosts consistently. [Astropy's space-motion support](https://docs.astropy.org/en/latest/coordinates/apply_space_motion.html) can handle proper motion and radial velocity; missing radial velocity introduces an assumption. A catalogue snapshot does not model light-travel-time differences or thousands of years of travel.

### Translate the observer

Let `S` be a background star's position and `P` the host-system position:

```text
relative = S - P
distanceFromPlanet = length(relative)
direction = relative / distanceFromPlanet
```

For ordinary background stars, approximate the planet's position by its host system. Orbital offsets are usually tiny compared with interstellar distances. Close companions and other bodies in the same system need separate treatment.

Remove the host by identifier before normalizing: otherwise the host becomes a zero-distance singularity. Render it with `HostStar`, using the assumed orbital configuration. Handle binary companions separately when significant. Add the Sun at the Solar System origin if the chosen catalogue does not already include it, with photometry appropriate to the selected band.

### Recalculate apparent brightness

In one consistent photometric band:

```text
M = mEarth - 5 log10(dEarth / 10) - AEarth
mPlanet = M + 5 log10(dPlanet / 10) + APlanet
relativeFlux = 10^(-0.4 * (mPlanet - referenceMagnitude))
```

`A` is interstellar extinction in that band. For the first implementation, assume negligible extinction and state that limitation. Without extinction estimates, the inferred absolute magnitude contains Earth-line-of-sight attenuation. Do not combine Gaia G and HYG V magnitudes as though identical; use a documented photometric conversion or keep separate labelled approximate rendering calibrations.

A useful unit test: moving ten times closer makes a star five magnitudes brighter and increases flux by 100 times.

### Select stars after moving the observer

An Earth-faint star may be bright near the destination. Build candidates from the union of:

1. An all-sky bright-star sample.
2. A deeper 3D neighbourhood around each host.
3. Curated host companions and missing bright stars.

For the deeper query, use an angular cone plus distance bounds only as a coarse prefilter, then filter by actual 3D separation. If the neighbourhood contains the Sun, its angular footprint may be the entire sky. Increase neighbourhood size/depth until the bright destination sample stabilizes, and report remaining incompleteness.

For each featured planet, recalculate destination magnitudes, filter to the chosen exposure limit, sort, and cache. Never fill gaps with random stars labelled as measured.

## 4. Define what “looking up” means

Translation produces a full celestial sphere. To turn it into a surface view, define an observer's up vector and north/east basis in the same inertial frame. This requires a spin axis, surface location, and rotation phase; orbital inclination alone does not determine them.

For a demo, choose a deterministic assumed orientation per planet, store it explicitly, and label it “Surface orientation assumed.” Derive both background-sky orientation and host-star direction consistently from that scenario. Do not independently rotate the star map and move the host to a convenient spot while presenting the result as an exact view.

If E, U, and N are orthogonal east/up/north vectors, one right-handed Three.js convention is:

```text
sceneDirection = [dot(direction, E), dot(direction, U), -dot(direction, N)]
altitude = asin(dot(direction, U))
```

Render the full sphere and let terrain/the horizon occlude it. A flat-horizon approximation hides negative-altitude stars; observer height and curvature can refine this later. Do not use Earth's sidereal-time/AltAz transform unchanged for an exoplanet.

## 5. Make the sky visually rich without misleading the user

Use a clear-night scenario for the strongest star reveal. A dense atmosphere, bright dayside, or luminous cloud deck may conceal stars. Orbital irradiation alone is insufficient to decide visibility: local host altitude, scattering, clouds, glare, and exposure matter.

Offer two presentation choices:

- **Night sky:** restrained exposure, physically motivated star visibility within the assumed atmosphere.
- **Enhanced exposure:** reveal fainter catalogue stars, with an unobtrusive exposure label.

Start by trying limiting magnitudes around 6 and 9–10 respectively; treat these as tunable display targets, not predictions of alien eyesight. Do not force every world to show an equally dense sky. For a giant planet, describe the observer as above/in a hypothetical cloud layer rather than on a solid surface.

Map each star's color index or temperature to a restrained display color with a documented calibration. Most stars should appear nearly white; strong saturation is an artistic choice. Let brightness vary greatly while apparent point size varies modestly. Apply only subtle atmospheric scintillation, and none for an airless scenario.

A Milky Way panorama photographed from Earth is not a reconstructed view from another system. Start with resolved stars alone; add a labelled approximate diffuse background later. An accurate band requires modelling unresolved stellar emission and dust from the new viewpoint, not merely rotating an Earth texture.

## 6. Render efficiently in the current Three.js scene

Use one `Points` object with a `BufferGeometry` and a custom point-sprite shader, rather than a React component per star. Three.js exposes these primitives in its [official documentation](https://threejs.org/docs/). Upload direction, linear color, and flux as attributes; update exposure/visibility through uniforms.

Implementation decisions for this project:

- Perform astronomical subtraction in CPU float64, then upload normalized float32 directions. Do not upload enormous absolute stellar positions and subtract them in a low-precision shader.
- Place points on a camera-centred shell within the existing camera far plane of 10,000. Copy camera translation, not its rotation, so the stars stay fixed as users look around and do not drift with camera sway.
- Draw gradient/background first, star sprites next, then foreground terrain/cloud occlusion with explicit depth/blending rules. Disable depth writes for stars; verify terrain hides them. Do not inherit terrain distance fog for the celestial shell.
- Attenuate starlight by atmospheric transmission and local sky contrast. The current opaque gradient does not itself provide a physical transmission model.
- Use small soft circular sprites with flux-based brightness. Avoid arbitrary perspective attenuation based on the invented shell radius. Honour device pixel ratio and point-size limits; instanced quads are a fallback if needed.
- Keep exposure and tone mapping consistent with `ObserverCamera`, which currently sets renderer exposure. Avoid applying exposure twice.
- Try 10,000–30,000 stars as a performance budget, then profile on the demo laptop. Cache typed arrays and dispose replaced geometry/materials.

## 7. Suggested files and offline pipeline

```text
scripts/build-star-catalogue.py       # fetch, normalize, validate, cross-match
scripts/build-planet-skies.py         # translate, recalculate, filter, export
src/types/sky.ts                     # observer, provenance, render data
src/lib/astronomy/sky.ts             # pure coordinate/brightness functions
src/components/scene/catalogue-sky.tsx
public/data/skies/trappist-1-e.bin    # one compact cached sky per featured world
public/data/skies/manifest.json      # layout, sources, epoch, assumptions
```

Proposed record contracts:

```ts
interface StellarRecord {
  id: string;
  positionPc: [number, number, number];
  absoluteMagnitude: number;
  band: "V" | "G";
  colorIndex?: number;
  colorIndexKind?: "B-V" | "BP-RP";
  epochYear: number;
  distanceMethod: "parallax" | "inferred";
}

interface CachedSky {
  directions: Float32Array;
  linearColors: Float32Array;
  relativeFluxes: Float32Array;
  assumptions: string[];
}
```

Keep source IDs/provenance in a sidecar for picking and explanations. The manifest should also record catalogue version, query, checksum, coordinate frame, quality cuts, source count, photometric calibration, and orientation assumptions. Download catalogues during preparation, not when a visitor clicks Enter World. If a cached sky is unavailable, retain a clearly labelled illustrative fallback and preserve the surface experience.

## 8. Build order and acceptance checks

1. **First working version:** NASA destination positions + HYG; translate/recalculate offline; cache the five worlds; replace `Starfield`; expose assumed night/enhanced exposure.
2. **Visual polish:** individual color/brightness, stable camera-centred sky, atmospheric attenuation, and a short star reveal when looking up.
3. **Scientific upgrade:** Gaia destination neighbourhoods, distance uncertainties, companions, catalogue deduplication, and optional dust.

Verify these before calling the reconstruction ready:

- At the Solar System origin, valid catalogue stars reproduce their input directions and magnitudes under the same extinction assumptions.
- Synthetic stars on the coordinate axes verify handedness; a tenfold distance change verifies magnitude and flux.
- No duplicated host, division by zero, invalid distance, NaN, or string-to-number corruption of IDs.
- Re-entering a world gives identical stars; switching worlds changes derived directions/brightness, not a random seed.
- Camera translation does not shift stars; rotation reveals the sky; terrain and clouds occlude correctly.
- Bright catalogue stars survive quality cuts or have a documented reason for exclusion; assess completeness separately for every featured destination.
- The HUD distinguishes catalogue-derived positions, assumed orientation/atmosphere, and enhanced exposure.
- Run the existing full demo flow for TRAPPIST-1 e and 55 Cancri e, check all five cached skies offline, then production build, TypeScript, browser errors, and frame rate.

A concise in-product explanation could read: “Star positions reconstructed from a stellar catalogue at this system's location. Clear-night atmosphere and surface orientation assumed. Enhanced exposure enabled.”
