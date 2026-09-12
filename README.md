# Astra-Nomical — Data Prep Package

This package is the **data-prep layer** for Astra-Nomical, done ahead of the
5-hour hackathon window per AGENTS.md. It does not implement the app — it
gives you typed, structured scaffolding so that on the day, filling in real
numbers is a fetch-and-paste exercise instead of a research project.

Everything here is **scaffold-only**: file structure, types, and
deterministic logic are real and usable as-is; every field that requires an
external measurement is currently `undefined` and needs one fetch pass
against the NASA Exoplanet Archive before the app ships.

---

## 1. What's in this package

```text
README.md                                 ← you are here
src/
├── types/
│   ├── planet.ts                         ← Planet interface (+ provenance type)
│   ├── environment.ts                    ← PlanetEnvironment interface
│   └── alien.ts                          ← AlienSimulation interface (Evolve Life contract)
└── lib/
    └── astronomy/
        ├── constants.ts                  ← physical constants + heuristic thresholds
        ├── environment.ts                ← deriveEnvironment() — REAL, working logic
        ├── planets-featured.ts           ← the 5 demo-safe planets (scaffold)
        └── planets-buffer.ts             ← 40 curated buffer planets (scaffold)
docs/
└── eyes-on-exoplanets-data-spec.md       ← spec only, no data — for the stretch orbital-map idea
```

Two things are already fully real and don't need a data pass:

- **`environment.ts`** — `deriveEnvironment()` is fully implemented with
  real formulas (gravity, star color, apparent star size, illumination,
  temperature category, atmosphere preset) and a working fallback
  hierarchy. It runs correctly right now even with every planet field
  `undefined` — try it.
- **`planets-buffer.ts` names/categories/notableFact** — real, curated
  metadata about 40 actual confirmed exoplanets. Only the *numeric* fields
  on each are placeholders.

---

## 2. The single data source: NASA Exoplanet Archive

Use the **Planetary Systems Composite Parameters** table (`pscomppars`) via
the archive's TAP (Table Access Protocol) sync API. This table is specifically
built to give one best-value row per planet (reconciling multiple discovery
papers), which is what you want instead of raw per-publication tables.

Base endpoint:

```
https://exoplanetarchive.ipac.caltech.edu/TAP/sync
```

Example query for a single planet, returned as JSON:

```
https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name,hostname,pl_rade,pl_bmasse,pl_orbsmax,pl_orbper,pl_orbeccen,pl_eqt,st_rad,st_teff,st_spectype,st_mass,sy_dist,disc_year,discoverymethod+from+pscomppars+where+pl_name+=+%27TRAPPIST-1+e%27&format=json
```

For a batch (the 5 featured, or all 40 buffer planets at once), use an `IN (...)`
clause instead of repeated single calls:

```
...where+pl_name+in+(%27TRAPPIST-1+d%27,%27TRAPPIST-1+f%27,%27Kepler-452+b%27,...)&format=json
```

Column → `Planet` field mapping:

| Archive column     | `Planet` field              | Notes                                                    |
|---------------------|------------------------------|-----------------------------------------------------------|
| `pl_name`           | `name`                       |                                                             |
| `pl_rade`           | `radiusEarth`                | already in Earth radii                                     |
| `pl_bmasse`         | `massEarth`                  | "best mass" — may mix true mass and RV minimum mass (m·sin i) |
| `pl_orbsmax`        | `orbitalDistanceAU`          |                                                             |
| `pl_orbper`         | `orbitalPeriodDays`          |                                                             |
| `pl_orbeccen`       | `orbitalEccentricity`        | often null for small/faint planets — safe to leave blank    |
| `pl_eqt`            | `equilibriumTemperatureK`    | archive's own zero-albedo estimate, when available          |
| `hostname`          | `starName`                   |                                                             |
| `st_rad`            | `starRadiusSolar`            |                                                             |
| `st_teff`           | `starTemperatureK`           |                                                             |
| `st_spectype`       | `starSpectralType`           | free-text field, often messy — trim to first letter for lookups |
| `st_mass`           | `starMassSolar`              |                                                             |
| `sy_dist`           | `distanceLightYears`         | archive reports in parsecs (`sy_dist`) — convert: `ly = parsecs × 3.2616` |
| `disc_year`         | `discoveryYear`              |                                                             |
| `discoverymethod`   | `discoveryMethod`            |                                                             |

Gas giants reported in Jupiter units (`pl_radj`, `pl_bmassj`) need converting:
`1 Jupiter radius ≈ 11.21 Earth radii`, `1 Jupiter mass ≈ 317.8 Earth masses`.

Full column reference: https://exoplanetarchive.ipac.caltech.edu/docs/API_queries.html

---

## 3. Fill-in checklist

1. Run the batch query above for the 5 names in `planets-featured.ts`.
2. Run it again (or in one combined `IN (...)` call) for the 40 names in
   `planets-buffer.ts`.
3. For each returned row, replace the matching `undefined` field. Convert
   units where noted above.
4. Where the archive returns `null` for a field, **leave it `undefined`** —
   do not invent a number. `deriveEnvironment()` already has a real
   fallback for every field that can be missing (see §5).
5. Update `FEATURED_PLANETS_PROVENANCE` in `planets-featured.ts` if any
   field's actual provenance differs from the pre-filled guess (e.g. if
   the archive shows an eccentricity was actually measured, not assumed).
6. Spot-check anything flagged with a `⚠️` comment in `planets-buffer.ts`
   before it reaches user-facing copy — those are scientifically
   contested points (K2-18 b "biosignature" claims, Kepler-1625 b's
   disputed exomoon), not settled facts.
7. Sanity-check for `NaN`/impossible values (negative radius, temperature
   of 0K, etc.) before shipping — the archive occasionally has data
   entry quirks in edge-case columns.

---

## 4. Measured / derived / assumed / speculative

Per AGENTS.md §6, the app must never claim more certainty than it has.
This package treats those four tiers as:

- **Measured** — came directly from an archive column for that specific
  planet (e.g. `pl_rade` for a well-studied transiting planet).
- **Derived** — computed deterministically from other measured fields
  (e.g. gravity from mass + radius; illumination from stellar luminosity
  and orbital distance). No external lookup, just physics.
- **Assumed** — a scientifically reasonable stand-in used because the
  measurement doesn't exist for this planet (e.g. mass estimated from
  radius via a published mass-radius relation; star temperature estimated
  from spectral type).
- **Speculative** — anything from "Evolve Life" (GPT-6 Astra). Never
  mix this tier with the other three in the UI.

`PlanetFieldProvenance` (in `types/planet.ts`) exists to track tiers 1–3
per field. `PlanetEnvironment.assumptions` (populated automatically by
`deriveEnvironment()`) is the human-readable version already wired up for
the UI.

---

## 5. How `deriveEnvironment()`'s fallback hierarchy actually works

For every input it needs, in order:

1. Use the measured value if present.
2. If missing, compute it from other measured fields (documented inline
   in `environment.ts` — e.g. star color from temperature via a blackbody
   approximation, gravity from a mass-radius relation when mass is
   unmeasured).
3. If that's not possible either, fall back to a scientifically reasonable
   default (`constants.ts` → `SAFE_DEFAULTS`), and log a plain-English
   note into `assumptions[]`.
4. The function is guaranteed to never return `NaN`, an invalid CSS
   color, or a zero/negative value that would break the 3D scene — this
   was tested by calling it with a completely empty planet object.

This means you can safely wire the renderer up against
`planets-featured.ts` and `planets-buffer.ts` **right now**, before any
real data is filled in — everything will render with safe Earth-like
defaults, and get progressively more accurate/differentiated as you fill
in real values.

**One real-physics quirk to expect, not a bug:** a plain Earth analog
(1 R⊕, 1 AU, Sun-like star) categorizes as `"cold"` (~255K), not
`"temperate"`. That's correct — the zero-albedo equilibrium/blackbody
temperature the archive reports is genuinely below freezing; Earth's
actual 288K surface average comes from greenhouse warming, which isn't
modeled here (and generally can't be, since real exoplanet atmospheric
composition is usually unknown — see AGENTS.md §6). If a demo planet's
"temperature category" looks colder than you'd intuitively expect, this
is almost always why — not a math error.

---

## 6. The 40-planet buffer set

`planets-buffer.ts` is a scope-flex safety net, kept deliberately separate
from the 5 production-critical planets. It's curated across 9 categories
(rocky habitable-zone, super-Earth, ultra-hot/lava, ordinary hot Jupiter,
mini-Neptune, directly-imaged, circumbinary, pulsar-planet, and oddities)
so that if scope changes on the day — more planets, a "browse the
catalogue" mode, more visual variety — there's already a scientifically
diverse, real, named set ready to fetch data for, rather than needing to
research new planets under time pressure.

Run `bufferCategoryCounts()` (exported from that file) any time you want
to sanity-check the category balance after edits.

---

## 7. Eyes-on-Exoplanets-style stretch feature

See `docs/eyes-on-exoplanets-data-spec.md`. This is a **spec document only**
— no numeric data has been pulled for it. It exists so that if you decide
mid-hackathon to build an orbital-map browsing layer (closer to NASA's own
"Eyes on Exoplanets" tool), you know exactly what additional fields you'd
need, which of them are commonly missing, and which real multi-planet
systems are well-characterized enough to be worth targeting first.

---

## 8. What this package deliberately does NOT do

- It does not call the NASA Exoplanet Archive for you — no live fetch has
  been run, per your instruction to scaffold only.
- It does not implement `deriveEnvironment()`'s consumers (3D renderer,
  HUD, Evolve Life) — those are app code, not data prep.
- It does not touch the OpenAI/Astra side of things at all.
