# Astra-Nomical — Explore Real Exoplanets

A cinematic exoplanet experience built with Next.js, TypeScript, React
Three Fiber and the OpenAI Agents SDK. Explore a real planet's data, enter
an illustrative 3D environment, and ask Astra how hypothetical life might
adapt to its environmental pressures.

This README describes `codex/world-creation-agent`. Its additional-world
workflow has not been merged into main.

## Run locally

Use Node.js 22 and npm. From this branch's checkout:

```sh
npm ci
```

Copy `.env.example` to `.env.local`. For AI features, set exactly one
`OPENAI_API_KEY` entry in `.env.local`; leave the existing model settings
unless you intentionally configure alternatives. Never commit this file
or paste credentials into chat. Planet browsing and preparation do not
require an API key; species, image and organism-model generation do and
may incur API charges.

```sh
npm run dev -- --port 3014
```

Open [localhost:3014](http://localhost:3014/). To test a production build,
stop the development server before running:

```sh
npm run build
npm run start -- --port 3014
```

## Explore a world

1. Select one of the five featured systems on the interactive map, or open
   **EXPLORE MORE REAL WORLDS** and search the local catalogue.
2. Try **TRAPPIST-1 f** to explore a planet outside the original five.
3. Inspect its overview and choose **ENTER WORLD**.
4. Drag for a 360° view; use WASD, arrow keys or onscreen movement buttons
   to move within the scene's limited range. Gas-giant scenarios float
   through an atmosphere rather than claim a solid surface.
5. Select **EVOLVE LIFE** for environment → pressure → adaptation reasoning.
   Optional image and 3D-specimen generation use the approved organism.
6. **EXIT WORLD** returns to that same planet's overview. **BACK TO MAP**
   returns to the interactive landing map.

## World preparation and agents

Real catalogue records are resolved server-side by canonical local name.
Unknown or ambiguous names and client-supplied physical overrides are
rejected. Deterministic code prepares:

```text
Catalogue Planet → PlanetEnvironment → VisualEnvironment → existing 3D scene
```

World preparation needs no LLM. After preparation, Evolve Life runs
Scientist → Evolution → Critic → Finalize. Species failure preserves the
world; optional image/model failures preserve the analysis. Image and
3D-organism requests require signed, expiring final-organism tickets.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/prepare-world?q=TRAPPIST-1` | Search up to 20 matching local records |
| `POST /api/prepare-world` | Prepare `{ "planetName": "TRAPPIST-1 f" }` without model calls |
| `POST /api/evolve-life` | Generate speculative biology using that same name-only input |
| `POST /api/organism-image` | Optional illustration from a signed token |
| `POST /api/organism-scene` | Optional procedural organism specification from a signed token |

`POST /api/create-world` remains a **separate fictional-world experiment**,
not the catalogue workflow. Its world reviewer no longer treats deferred
species generation as a failed world design. See the
[implementation guide](docs/world-creation-agent.md) for contracts and limits.

## Scientific and demo limits

- Terrain, atmosphere and surface orientation are illustrative scenarios,
  not observed reconstructions. Equilibrium temperature is not surface temperature.
- Only the five featured planets have prepared destination-relative
  catalogue skies. Additional planets show a labelled illustrative sky,
  never a renamed copy of a featured planet's catalogue.
- Archive values can include estimates. Buffer/extended records lack
  comprehensive field qualifiers and are labelled **ARCHIVE VALUE**, not
  automatically **MEASURED**. Missing inputs and visual defaults stay explicit.
- Species are speculative hypotheses, not evidence of life or simulated evolution.
- Re-entry preserves the prepared world; page refresh resets selection.
  No accounts, persistence or public API rate limiting were added. Configure
  deployment access and spending controls before broad public use.

## Verification

On 2026-09-13, the branch passed production build, TypeScript and 88 tests
across catalogue preparation, agent stages, streaming, images and organism
scenes. Browser checks covered TRAPPIST-1 f selection, terrain/HUD,
drag-to-look, movement, exit/re-entry and back-to-map navigation.

One live TRAPPIST-1 f species run completed in about 79 seconds with four
pressure factors and five adaptations. Live image/3D-organism generation
was **not** exercised in that bounded test; those contracts were tested with
mocks. A local 120-frame sample measured about 60 R3F callbacks/sec on an
Intel Arc 140V—not a guarantee for other devices.

```sh
node --conditions=react-server --import tsx --test tests/catalogue-world.test.ts tests/world-creation.test.ts tests/evolve-life-stream.test.ts
npm run test:agents
npm run test:images
npm run test:scenes
npm run typecheck
npm run build
```

## Data preparation reference

The sections below document the original data-preparation package, now
consumed by the working application.

**Status: real data, not a scaffold.** Every numeric field in the three
planet datasets below was fetched from the NASA Exoplanet Archive on
2026-09-12 (composite parameters table, `pscomppars`, 6,366 confirmed
planets at time of fetch). Where the archive itself has no value for a
field, it's left `undefined` — never invented — and `deriveEnvironment()`'s
fallback hierarchy (§5) takes over safely at render time.

---

## 1. What's in this package

```text
README.md
src/
├── types/
│   ├── planet.ts                    ← Planet interface (+ provenance type)
│   ├── environment.ts               ← PlanetEnvironment interface
│   └── alien.ts                     ← AlienSimulation interface (Evolve Life contract)
└── lib/
    └── astronomy/
        ├── constants.ts             ← physical constants, RECALIBRATED against real data (see §6)
        ├── environment.ts           ← deriveEnvironment() — real, tested logic
        ├── planets-featured.ts      ← 5 demo-safe planets, REAL data
        ├── planets-buffer.ts        ← 40 curated buffer planets, REAL data
        ├── planets-extended.json    ← 6,271 remaining confirmed planets, REAL data
        └── planets-extended.ts      ← typed loader for the JSON above
docs/
└── eyes-on-exoplanets-data-spec.md  ← spec only, no data — for the stretch orbital-map idea
```

---

## 2. The three planet datasets

All three come from the same source and the same fetch pass, just at
different levels of curation:

**`planets-featured.ts` (5 planets)** — TRAPPIST-1 e, Proxima Centauri b,
55 Cancri e, WASP-121 b, Kepler-186 f. Every field is real, plus a
hand-checked `FEATURED_PLANETS_PROVENANCE` table and a `notableFact` per
planet. This is what the demo must never depend on the network for —
these values ship hardcoded.

**`planets-buffer.ts` (40 planets)** — curated across 9 categories (rocky
habitable-zone, super-Earth, ultra-hot/lava, ordinary hot Jupiter,
mini-Neptune, directly-imaged, circumbinary, pulsar-planet, oddities), each
with a real `notableFact` and category tag, for scope-flex if you want more
variety on the day. `bufferCategoryCounts()` sanity-checks the balance.
A couple of entries carry a `⚠️` caution note (K2-18 b's contested
"biosignature" claims, Kepler-1625 b's disputed exomoon, HR 8799 c/e's
`equilibriumTemperatureK` actually reflecting measured intrinsic heat from
a young still-forming planet rather than insolation) — read those before
they reach user-facing copy.

**`planets-extended.json` / `planets-extended.ts` (6,271 planets)** — every
other confirmed planet in the archive with at least a measured radius (50
planets had no radius at all and were dropped entirely, per your call).
Shipped as JSON, not a TypeScript literal — at this size a `.ts` file would
be a multi-megabyte, slow-to-compile source file for no benefit; JSON
loaded via `import`/`fetch` is the normal way to ship a static dataset this
large. Import `planets-extended.ts` to get it back out as typed `Planet[]`.

Two honest trade-offs at this scale, versus the curated 45:

- No hand-written `notableFact` per planet — not feasible for 6,271 entries.
- `category` is **auto-derived** from radius/temperature/discovery method
  (see the classifier logic embedded in the build step — reproduced below),
  not hand-picked. `name`/`starName` are the archive's own strings verbatim,
  not cleaned up into nicer display forms the way the curated 45 were.

Category breakdown of the extended set:

| category | count |
|---|---|
| mini-neptune | 2,277 |
| gas-giant | 1,044 |
| ultra-hot | 980 |
| hot-jupiter | 956 |
| super-earth | 878 |
| directly-imaged | 90 |
| rocky-habitable-zone | 42 |
| pulsar-planet | 4 |

Classifier logic (discovery method checked first, then radius/temperature):

```
Pulsar Timing            → pulsar-planet
Imaging                  → directly-imaged
radius ≤ 1.8 R⊕:
  200K ≤ eqT ≤ 320K       → rocky-habitable-zone
  eqT > 1000K             → ultra-hot
  else                    → super-earth
1.8 < radius ≤ 4 R⊕:
  eqT > 1500K             → ultra-hot
  else                    → mini-neptune
radius > 4 R⊕:
  eqT > 1500K             → ultra-hot
  eqT ≥ 500K              → hot-jupiter
  else                    → gas-giant
```

Note `circumbinary` doesn't appear here — it can't be auto-detected from
the columns fetched (would need a different archive field), so it only
exists in the hand-curated 40.

---

## 3. Data source & methodology

**NASA Exoplanet Archive**, Planetary Systems Composite Parameters table
(`pscomppars`), fetched via the TAP sync API on 2026-09-12. This table
gives one best-value row per confirmed planet (reconciling multiple
discovery papers), rather than one row per publication.

Column → `Planet` field mapping used throughout:

| Archive column | `Planet` field | Notes |
|---|---|---|
| `pl_name` | `name` | archive's own string for extended set; cleaned up for the curated 45 |
| `pl_rade` | `radiusEarth` | already in Earth radii |
| `pl_bmasse` | `massEarth` | "best mass" — mixes true mass, RV minimum mass (m·sin i), and in some cases model estimates |
| `pl_orbsmax` | `orbitalDistanceAU` | |
| `pl_orbper` | `orbitalPeriodDays` | |
| `pl_orbeccen` | `orbitalEccentricity` | often null/unconstrained for small or faint planets |
| `pl_eqt` | `equilibriumTemperatureK` | archive's zero-albedo estimate; for young directly-imaged giants this can reflect measured intrinsic heat instead — see HR 8799 caveat above |
| `hostname` | `starName` | |
| `st_rad` | `starRadiusSolar` | |
| `st_teff` | `starTemperatureK` | |
| `st_spectype` | `starSpectralType` | free-text, ~62% null across the full archive; safe to leave blank |
| `st_mass` | `starMassSolar` | |
| `sy_dist` | `distanceLightYears` | archive reports parsecs (`sy_dist`) — converted here via `ly = parsecs × 3.2616` |
| `disc_year` | `discoveryYear` | |
| `discoverymethod` | `discoveryMethod` | |

If you need to re-fetch or extend this later, the same query pattern works
for any batch of names:

```
https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name,hostname,pl_rade,pl_bmasse,pl_orbsmax,pl_orbper,pl_orbeccen,pl_eqt,st_rad,st_teff,st_spectype,st_mass,sy_dist,disc_year,discoverymethod+from+pscomppars+where+pl_name+in+(%27<name1>%27,%27<name2>%27)&format=json
```

or, with no `WHERE` clause at all, the full table (what the extended
dataset was built from). Full column reference:
https://exoplanetarchive.ipac.caltech.edu/docs/API_queries.html

**Naming gotcha worth remembering:** the archive uses abbreviated
constellation/catalog names, not common names — e.g. `55 Cnc e` not
"55 Cancri e", `51 Peg b` not "51 Pegasi b", `bet Pic b` not
"Beta Pictoris b", `Proxima Cen b` not "Proxima Centauri b". The curated 45
map their nicer display names to the correct archive key; if you look up
something new, use the archive's own search box rather than guessing.

---

## 4. Measured / derived / assumed / speculative

Per AGENTS.md §6, the app must never claim more certainty than it has:

- **Measured** — explicitly identified as a measurement by the available
  provenance; appearing in an archive column alone is not sufficient.
- **Archive value** — supplied by the catalogue, but its measurement or
  estimation status is not established by the retained field qualifiers.
- **Derived** — computed deterministically from other measured fields
  (gravity from mass+radius, illumination from stellar luminosity and
  orbital distance). Pure physics, no external lookup.
- **Assumed** — a scientifically reasonable stand-in used because the
  measurement doesn't exist (mass from a radius relation, star temperature
  from spectral type).
- **Speculative** — anything from "Evolve Life" (GPT-6 Astra). Never mix
  this tier with the other three in the UI.

`FEATURED_PLANETS_PROVENANCE` in `planets-featured.ts` tracks this per
field for the 5 demo planets, confirmed against the actual fetch (e.g.
Kepler-186 f's mass is flagged `"derived"` — the archive's own value for it
is a model-based estimate, not a direct measurement). `PlanetEnvironment.assumptions`
(auto-populated by `deriveEnvironment()`) is the runtime, human-readable
record of calculation fallbacks. It does not recover missing source
qualifiers. The extended set retains archive values with unknown
measurement status and separate, explicit rendering assumptions.

---

## 5. How `deriveEnvironment()`'s fallback hierarchy works

For every input it needs, in order: use the measured value if present;
else compute it from other measured fields (star color from temperature
via blackbody approximation, gravity from a mass-radius relation when mass
is unmeasured); else fall back to a physically reasonable default
(`constants.ts` → `SAFE_DEFAULTS`) and log a plain-English note into
`assumptions[]`. It's guaranteed to never return `NaN`, an invalid CSS
color, or a zero/negative value — tested against an empty planet object, a
partial planet (radius only), and a fully-specified Earth analog, all
passing.

**One real-physics quirk to expect, not a bug:** a plain Earth analog
(1 R⊕, 1 AU, Sun-like star) categorizes as `"cold"` (~255K), not
`"temperate"`. This estimate assumes an Earth-like Bond albedo of 0.3,
not zero albedo; Earth's actual 288K surface average also depends on
greenhouse warming, which isn't modeled here (real exoplanet atmospheric
composition is usually unknown — AGENTS.md §6). Not a math error.

---

## 6. Recalibration against the full archive (2026-09-12)

Two things were checked against the real, full 6,366-planet population
before finalizing `constants.ts`:

**Mass-radius relation — recalibrated.** Previously used a textbook
piecewise fit (Weiss & Marcy 2014). Replaced with a log-log linear
regression fit directly against the archive: rocky regime (R ≤ 1.5 R⊕,
n=1,012 planets with both mass and radius measured) gives
`M ≈ 1.204 × R^2.569`; sub-Neptune regime (1.5 < R ≤ 4 R⊕, n=2,847) gives
`M ≈ 1.685 × R^1.654`. This was preferred because it's also more
self-consistent at the regime boundary (R=1.5 R⊕: the two pieces agree to
within ~7%, versus ~37% disagreement using the literature fit) and
reproduces Neptune's real mass reasonably well at its actual radius.
Caveat, documented in `constants.ts`: the archive's "best mass" column
mixes measurement quality tiers (true mass, RV minimum mass, TTV, model
estimates), so treat this as a practical empirical approximation, not a
rigorously derived law.

**Temperature categories and atmosphere-heuristic thresholds — checked,
deliberately left unchanged.** The population's median equilibrium
temperature is ~756K (transit/RV surveys are best at finding close-in, hot
planets — strong detection bias), and 5th-percentile surface gravity is
0.65g (low-gravity small planets are the hardest to detect at all). Both
findings confirmed that re-centering these thresholds on population
percentiles would just re-encode detection bias as physics, not improve
the science. They stay anchored to absolute reference points (Earth,
Venus, Mercury) instead — the full reasoning is documented inline in
`constants.ts`.

---

## 7. Eyes-on-Exoplanets-style stretch feature

See `docs/eyes-on-exoplanets-data-spec.md` — spec only, no data pulled.
Documents the additional fields (full Keplerian orbital elements, star
RA/Dec, multi-planet grouping) and math (Kepler orbit propagation,
habitable-zone boundaries) needed if you build an orbital-map browsing
layer closer to NASA's own tool, plus a candidate list of well-characterized
multi-planet systems worth targeting first.

---

## 8. Further documentation

- [Real catalogue worlds and species agents](docs/world-creation-agent.md)
- [Exoplanet sky implementation guide](docs/exoplanet-sky-guide.md)
- [Orbital-map data specification](docs/eyes-on-exoplanets-data-spec.md)
- [Project instructions and priorities](AGENTS.md)

The working app includes the renderer, HUD and AI workflow. The orbital-map
specification remains a separate reference, not a claim of precise live
orbital simulation.
