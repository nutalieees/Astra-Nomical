# Fictional world creation agent

Backend-only feature on `codex/world-creation-agent`, based on main's organism and catalogue-sky integration. Existing explorer, NASA records, renderer, and Evolve Life endpoints are unchanged.

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

No Create World button or navigation was added. A future UI may mount the existing renderer with returned world props, but must show fictional labels and pass returned provenance rather than the featured NASA provenance. It must use an explicitly illustrative sky: no destination catalogue exists. Do not reuse a real planet's cached sky or imply that a fallback catalogue error describes a measured fictional sky. Organism image/scene endpoints currently have their own featured-world validation and tickets; this feature does not bypass those contracts or automatically generate images/3D organisms. The returned species contract can support a later scoped integration.

## Reliability / verification

Total deadline: 240 seconds including species; cancellation propagates to model requests. `maxDuration=260` is a deployment hint, not a guarantee on every hosting plan. Error responses are sanitized. No database/persistence, public abuse throttling, or image generation was added. Apply the same access and usage controls as the existing AI endpoints before wider public launch.

Run:

```sh
node --conditions=react-server --import tsx --test tests/world-creation.test.ts
npm run typecheck
npm run build
```

Tests mock the provider but exercise the real SDK runner and strict output validation. Live model quality and cost require a configured-key test; passing mocked tests does not establish empirical science or rendered visual quality.
