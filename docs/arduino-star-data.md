# Arduino star catalogue preparation

This implements the data-preparation stage of [the exoplanet sky guide](exoplanet-sky-guide.md). It does not change the rendered sky or claim to reconstruct an exoplanet viewpoint.

## Regenerate and validate

Run from the project root using the existing Node.js installation; no new dependencies are needed:

```sh
npm run stars:convert
npm run stars:check
npm run stars:test
npm run typecheck
npm run build
```

The default inputs are checked-in, byte-preserved snapshots in `data/source/arduino/`. The original files outside this repository are never written. To regenerate directly from those originals in PowerShell:

```powershell
npm run stars:convert -- --source-dir 'C:/Users/nhze6/Documents/Arduino/final arduino skymap/sky_rendererv3'
```

If intentionally updating the source dataset, also update the two repository snapshots, then regenerate. The converter requires the agreed 904 stars and 674 segments; changing that contract requires explicitly updating the expected counts in the script. `stars:check` compares the entire deterministic generated output against the snapshots without writing files. Source SHA-256 hashes identify the exact input contents; generated timestamps and machine-specific paths are deliberately omitted.

## Files and use

- `scripts/convert-star-data.cjs`: strict, non-executing parser and validator.
- `src/types/sky.ts`: normalized Earth-view star, constellation segment, and catalogue interfaces.
- `src/lib/astronomy/data/arduino-sky.json`: all records, provenance, limitations, and detailed validation results.
- `src/lib/astronomy/arduino-sky.ts`: typed import adapter, checked by TypeScript. It is not imported by the current scene, so the data adds no runtime download to the existing experience.
- `scripts/convert-star-data.test.cjs`: focused conversion/error-handling tests.

Source row order is preserved. Each record has an ID such as `arduino-star-0001`, stable while source order stays unchanged. HIP identifiers are matching keys, not necessarily unique record identities. HIP 0 becomes `hipId: null`; empty labels become `name: null`. Raw segment endpoint HIP values are retained, together with nullable resolved record IDs. Never draw a segment unless both endpoints resolve uniquely.

RGB565 channels expand using nearest-integer scaling from 5/6/5 bits to 8/8/8 bits. Both the original integer and a CSS hex color are retained. These are display colors of unspecified original calibration, not measured spectra or linear-light shader values.

## Results for the supplied headers

| Check | Result |
| --- | --- |
| Declared and parsed stars | 904 / 904 |
| Declared and parsed constellation segments | 674 / 674 |
| Stars without a HIP ID | 24; distinct source-row IDs retained |
| Duplicated nonzero HIP IDs | 0 |
| Invalid coordinate ranges or nonfinite magnitudes | 0 |
| Apparent visual magnitude range | −1.46 to 4.50 |
| Unresolved endpoint occurrences | 188 |
| Segments with at least one unresolved endpoint | 157 |
| Fully resolved segments | 517 |

The unresolved endpoints are references to HIP IDs absent from this sample. No stars are invented to complete them. The JSON validation section lists every affected segment and endpoint. Missing and ambiguous associations are warnings; malformed rows, inconsistent counts, invalid coordinates, invalid RGB565, and nonfinite magnitudes stop conversion before output is written.

## Scientific scope and provenance

The headers supply Earth-view RA/Dec in degrees and visual apparent magnitudes. Distance, coordinate epoch, precise coordinate-frame realization, and exact photometric passband are not supplied. Unknown distance and epoch are explicitly `null`, never zero or guessed J2000. No Cartesian stellar positions or absolute magnitudes are calculated at this stage.

`sky_math.h` was inspected as reference only. Its UTC-to-sidereal-time routine is Earth-specific, and its sky projection targets a 240-pixel Arduino display. Neither is imported into the Three.js scene. The next stage needs catalogue distance/epoch enrichment and a separate destination-relative transform.

The source headers identify `generate_headers.py` as their generator but contain no underlying catalogue attribution or licence. Record those from the original generator/source catalogue when available; this conversion does not assign a new dataset licence or assume a Hipparcos ID establishes provenance.
