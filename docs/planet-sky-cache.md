# Featured-planet sky caches

This is the deterministic geometry and photometry stage described in [the exoplanet sky guide](exoplanet-sky-guide.md). It produces full celestial spheres for the five demo-safe worlds. `CatalogueSky` now renders these buffers with a separate deterministic assumed orientation; the caches themselves remain orientation-independent.

## Reproduce the data

```sh
npm run skies:download
npm run skies:build
npm run skies:test
npm run skies:check
```

To regenerate the exact-HIP audit of the original Arduino catalogue from the same cached raw input, also run `npm run stars:enrich` and `npm run stars:enrich:check`.

`skies:download` obtains the HYG v4.1 CSV from a pinned upstream commit and verifies its SHA-256 before saving it as the ignored file `data/source/sky/hygdata_v41.csv`. The current NASA host-system response is normalized and checked in at `data/source/sky/featured-hosts-nasa.json`, together with the exact TAP query and retrieval date. The browser reads only generated files under `public/data/skies`; it never contacts HYG or NASA.

The generator uses double-precision JavaScript numbers for all catalogue positions, observer translation, distance, magnitude, and flux calculations. Only normalized directions, display colors, destination magnitudes, relative fluxes, and destination distances are quantized to the final little-endian binary records.

## Calculation

HYG and the NASA host coordinates are represented on aligned equatorial J2000 axes. For each star, the generator subtracts the host-system Cartesian position, calculates the destination distance, and normalizes the difference into a full-sphere direction. It derives absolute V magnitude from HYG's Earth-view V magnitude and distance, then applies the distance modulus again at the destination:

```text
M_V = m_V,Earth - 5 log10(d_Earth / 10 pc)
m_V,destination = M_V + 5 log10(d_destination / 10 pc)
relative flux to V=0 = 10^(-0.4 m_V,destination)
```

The destination magnitude filter is applied after translation at V≤10. Because that yields 66,266–99,559 candidates in this Earth-selected catalogue, each runtime cache retains the brightest 20,000 plus required special records. This follows the scene guide's 10,000–30,000-star performance budget. The candidate count before this cap remains in the manifest.

The host itself is excluded by its curated HYG record identity where HYG contains it: Proxima Centauri (`hyg:70666`) and 55 Cancri A (`hyg:43464`). Hosts absent from HYG cannot create a zero-distance record and remain the responsibility of `HostStar`. The HYG Sun is placed exactly at the Solar System origin and retained exactly once in every cache, even when fainter than the display limit.

Alpha Centauri A and B are retained and flagged as significant wide companions in Proxima Centauri b's cache. The known wide companion 55 Cancri B lacks a separate identified record in the pinned HYG input, so it is documented and omitted rather than synthesized. No random or invented stars fill catalogue gaps.

## Files

`public/data/skies/manifest.json` records sources, hashes, observer positions, counts, selection, and assumptions. Each planet has:

- a 560,016-byte `.bin` file containing 20,000 records for rendering;
- a compact `.json` sidecar mapping every binary index to HYG/Hipparcos identity, name, and flags.

The `ASKY` binary header is 16 bytes: ASCII magic, unsigned 16-bit version, unsigned 16-bit record stride, unsigned 32-bit record count, and four reserved zero bytes. Each 28-byte record contains three float32 direction components, RGB uint8 values, one flags byte, float32 apparent V magnitude, float32 relative flux, and float32 destination distance in parsecs. `src/lib/astronomy/cached-sky.ts` validates and decodes this format.

## Scientific limits

- Planetary orbital offsets from the host position are neglected.
- Interstellar extinction is neglected. HYG absolute magnitude is recalculated from its Earth-view magnitude and distance under the same assumption.
- Stellar space motion after J2000 and light-travel-time effects are neglected.
- HYG is selected from Earth and is incomplete for stars that are faint here but bright near a destination.
- HYG's equatorial J2000 axes and NASA's ICRS J2000 coordinates are treated as aligned at this visualisation's precision.
- B−V becomes an approximate blackbody display color; it is not a spectral renderer.
- The caches do not define “up,” surface latitude, local time, atmosphere, or visibility. Those remain explicit rendering scenarios.

At runtime, natural exposure displays records through V=6.5 and enhanced exposure through the cache's V=10 limit. The shader compresses extreme flux ratios logarithmically for visibility; it does not modify the stored magnitudes. The assumed night-side/host-lit rotation moves the catalogue sphere, host direction, and primary light together. The sky group follows camera position only, so observer movement does not add artificial parallax.

The focused checks cover coordinate axes, Earth-origin reconstruction, the five-magnitude/100×-flux distance rule, host exclusion, companion and Sun retention, finite normalized results, byte-for-byte deterministic packing, source checksums, and cache freshness.

## Verification on 13 September 2026

At a 1280×720 viewport in the Codex in-app browser, all five featured worlds reached the surface view and changed the local-sky status from loading to catalogue-backed. TRAPPIST-1 e and 55 Cancri e were visually sampled: the night-side view showed resolved stars behind an occluding terrain horizon, host-lit mode moved the host disc and scene lighting together, enhanced exposure toggled independently, and the controls did not overlap after adjustment. Exit returned to the selected overview, Back to Map restored the system picker, and the Evolve Life result still rendered for Kepler-186 f.

The in-app browser intermittently reported WebGL context loss while still producing frames, so sustained frame rate, full 360-degree inspection, cloud transmission, and long-duration context stability were not measured. Those checks remain for the demo browser and hardware. The five local binaries were independently decoded and validated by the automated cache test.
