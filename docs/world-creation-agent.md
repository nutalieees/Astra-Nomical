# Real catalogue worlds and species agents

## Primary feature: extend the existing experience

On `codex/world-creation-agent`, open **EXPLORE MORE REAL WORLDS** on the landing map, search (for example `TRAPPIST-1 f`), and select a result. The server prepares the trusted record and opens its existing overview. ENTER WORLD uses the existing transition, renderer, movement, HUD and Evolve Life panel. EXIT WORLD returns to that same overview; BACK TO MAP returns to the interactive five-system map. Extra planets are searched, not added as thousands of map nodes.

Preparation is deterministic and needs no API key. No LLM invents or overwrites astronomy. Re-entry preserves the prepared configuration; refresh resets application state (no persistence added). Gas giants use the existing atmospheric viewing scenario and floating controls, not a claimed solid surface.

### API and trust boundary

- `GET /api/prepare-world?q=TRAPPIST-1` returns at most 20 matching names/hosts. The extended JSON remains server-side.
- `POST /api/prepare-world` accepts only `{ "planetName": "TRAPPIST-1 f" }` and returns `{ world }`: planet, environment, visualEnvironment, provenance, missingFields, deterministic review and sky policy.
- `POST /api/evolve-life` accepts the same name-only input and independently resolves/prepares server data before running Scientist → Evolution → Critic → Finalize.
- Image and 3D-organism routes still require unexpired signed final-organism tickets. They already support generic validated context; no unsigned input or validation bypass was added.

Canonical local names are identifiers, with case/whitespace normalization only. Unknown or ambiguous names fail closed. Numeric fields are independently validated; invalid/missing fields are omitted from the prepared copy and documented, never patched in source records. No new downloads or external enrichment were needed.

### Provenance and scientific limits

Sources are the existing featured, buffer and extended catalogue files, documented there as NASA `pscomppars` fetched 2026-09-12. Featured qualifiers are preserved. Buffer/extended records do not retain comprehensive measurement-vs-estimate qualifiers; they remain ARCHIVE VALUE, not automatically MEASURED. Missing fields stay absent. AI context includes these caveats and rendering assumptions. Gravity/illumination based on missing inputs are marked assumed in the HUD.

Preparation approves numerical rendering configuration, not scientific truth, habitability or orbital stability. Terrain, atmosphere, ice and observing orientation are scenarios. Radius-based composition is a rendering heuristic, not proof of a solid surface.

Only the original five have prepared destination catalogue skies. Other planets use the existing deterministic illustrative star field, explicitly labelled; even TRAPPIST-1 f does not silently borrow TRAPPIST-1 e's asset. Further host-coordinate/sky enrichment is not implemented.

### Stage conflict fix

Real world preparation completes before the separate Evolve Life action. Species failure preserves the usable world; optional image/scene failure preserves the analysis and supports existing retries.

The separate fictional experiment below now withholds `generateSpecies` from both designer and reviewer input. It is immutable workflow control, not a world property. Instructions explicitly say missing organisms are expected before world approval. One bounded revision remains; downstream species failure preserves an approved fictional world. Regression tests cover this ordering and withheld control.

### Verification, 2026-09-13

- Production build and TypeScript passed; 22 targeted catalogue/world/stream tests passed, plus existing agent, image and scene suites.
- One live TRAPPIST-1 f run completed all four species stages in 78.7 seconds: four pressure factors, five adaptations, final consistency approval. Biology remains speculative, not demonstrated viability.
- Browser verified catalogue selection, overview, transition, visible terrain/HUD, drag-to-look, forward movement, exit to the same overview and re-entry. Forward controls moved the observer from [-0.76, 2.66, 11.63] to [-1.68, 2.67, 11.35].
- Local sample: 120 frames, about 60 R3F callbacks/s, p95 17–17.7 ms, 9 draw calls, 156,576 triangles, Intel Arc 140V, 1280×720 CSS / 1920×1080 drawing buffer. This is callback timing, not GPU timing or a cross-device benchmark.
- Live image/3D-organism generation was not exercised during the single bounded live test. Signed context and rendering contracts are tested with mocks; a full live browser species→image→specimen rehearsal remains.

Checks: `node --conditions=react-server --import tsx --test tests/catalogue-world.test.ts tests/world-creation.test.ts tests/evolve-life-stream.test.ts`, `npm run test:agents`, `npm run test:images`, `npm run test:scenes`, `npm run typecheck`, `npm run build`.

No authentication, public rate limiting or persistence was added. Keep credentials server-side in ignored `.env.local`; apply deployment usage controls before wider launch. Main remains untouched.

---

# Separate fictional-world experiment (not used by catalogue search)

The original fictional endpoint remains backend-only and separate from real catalogue preparation. The following bounds and caveats apply only to fictional designs.

## Call

POST `/api/create-world` with JSON:

```json
{
  "brief": "A cold rocky world with a hypothetical thin atmosphere",
  "hostStar": "red-dwarf",
  "worldType": "rocky",
  "equilibriumTemperatureK": 230,
  "generateSpecies": true
}
```

Hosts: `red-dwarf`, `sunlike`, `warm-f-star`. Types: `rocky`, `icy`, `volcanic`, `gas-giant`. Temperature: 80–2200 K; icy requires <=260 K, irradiation-driven volcanic requires >=1400 K. No ocean renderer is promised. `generateSpecies` defaults to true; set false for a faster world-only request.

Set `OPENAI_API_KEY` server-side; optional `OPENAI_WORLD_MODEL` overrides `gpt-6-astra`. Existing species model settings continue to apply. Uses the project's OpenAI Agents SDK with Responses, not a newly provisioned persistent Agents API resource.

## Pipeline

1. Structured designer proposes name, description, bounded mass/radius, assumptions.
2. Code calculates orbital distance for the requested equilibrium temperature, orbital period, gravity, illumination, and renderer parameters.
3. AI consistency reviewer approves or requests one revision. Two rejected proposals fail without a fabricated result.
4. Optional existing Evolve Life pipeline returns reviewed species. A species error is nested in `species.error`; the successfully created world remains available. `species: null` means explicitly skipped.

Result contains `world` (`planet`, `environment`, `visualEnvironment`, field `provenance`, `sky` policy), `review`, and `species`. All invented inputs are assumed. Orbital distance/period are derived **from fictional assumptions**. No observed discovery/date/distance or catalogue coordinates are added.

## Scientific boundaries

Stellar templates are illustrative main-sequence choices, not catalogue stars. Orbit uses uniform reradiation, Bond albedo 0.3, no greenhouse warming; equilibrium temperature is not surface temperature. Density bounds and a three-stellar-radius clearance are coarse checks, not complete physical or orbital-stability validation. AI review is consistency review, not scientific certification. Frost and terrain are scenarios. Species are speculative adaptation hypotheses, not simulations of evolutionary history.

## Integration boundary

No fictional Create World button was added. Any future fictional UI must show fictional labels/provenance and an illustrative sky; no destination catalogue exists. This fictional endpoint does not issue organism illustration tickets or automatically generate images/3D organisms. The real catalogue flow above does reuse the existing signed-ticket pathway.

## Reliability / verification

Total deadline: 240 seconds including species; cancellation propagates to model requests. `maxDuration=260` is a deployment hint, not a guarantee on every hosting plan. Error responses are sanitized. No database/persistence, public abuse throttling, or image generation was added. Apply the same access and usage controls as the existing AI endpoints before wider public launch.

Run:

```sh
node --conditions=react-server --import tsx --test tests/world-creation.test.ts
npm run typecheck
npm run build
```

Tests mock the provider but exercise the real SDK runner and strict output validation. Live model quality and cost require a configured-key test; passing mocked tests does not establish empirical science or rendered visual quality.
