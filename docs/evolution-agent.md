# Evolution Agent

The independent second Evolve Life stage takes `Planet`, `PlanetEnvironment`
(including assumptions), and the Scientist's `EnvironmentalPressure[]`. It
returns the existing `CandidateOrganism` contract: name, summary, morphology,
adaptations and survivalStrategy. Morphology covers size, body plan, locomotion,
surface covering and senses; protective mechanisms belong in linked adaptations.

`runEvolutionAgent(planet, environment, pressures)` in `src/lib/ai/evolution-agent.ts`
uses the official Agents SDK with a strict Zod `outputType`, the Responses provider,
one turn and a 60-second abort signal. It does not import/run the Scientist or share
its history. The two agents share only input validation and public data contracts.
See [OpenAI agent definitions](https://developers.openai.com/api/docs/guides/agents/define-agents).

## Pressure references and scientific limits

Each adaptation's `environmentalPressure` is the **exact factor** of one supplied
pressure. Input factors must be unique. A per-run enum restricts references in the
model's output schema, and runtime validation rejects unknown, missing or combined
references. The full pressure remains available by matching its factor. Multiple
adaptations may reference the same pressure.

The prompt requires every adaptive feature in the morphology/strategy to appear in
a linked adaptation entry. It prioritizes a consistent body, movement, energy
budget and protection, rather than visual spectacle. It prohibits adding planetary
conditions and preserves known/derived/assumed/unknown evidence. Unknown requirements
for life must be described as unverified prerequisites, not conditions on the planet.
Dormancy cannot be used to claim unlimited survival in extreme conditions.

Schema validation guarantees shape and reference membership, not the scientific
truth or semantic completeness of an LLM's prose. This is an unreviewed candidate
for the later Critic stage, not a validated organism or evidence of life.

## Inspect or replay TRAPPIST-1 e

Set `OPENAI_API_KEY` in the ignored `.env.local`. Optionally set the separate
server-side `OPENAI_EVOLUTION_MODEL`; it defaults to `gpt-6-astra`.

- `npm run evolution` calls Evolution with the existing Scientist test fixture.
- `npm run evolution -- /absolute/path/to/trappist-pressures.json` replays a saved
  Scientist array instead. The file must belong to TRAPPIST-1 e; pressure arrays
  contain no planet identifier, so the helper cannot verify that association.
- To save a live first-stage result: `npm run --silent scientist > /tmp/trappist-pressures.json`.
  Only replay it if that command succeeds.
- `npm run test:agents` runs both stages' offline tests.

The fixture at `tests/fixtures/trappist-1e-scientist.json` preserves the pressure
content previously used in the Scientist tests. It is **mocked output, not a live
Scientist result**. Both stages test against it, including passing the actual
mocked SDK Scientist result directly into the Evolution SDK runner.

The helper prints only CandidateOrganism JSON to stdout. Fixture notices and safe
errors go to stderr; failures exit nonzero without a fabricated organism. The
implementation uses `server-only`, disables tracing/response storage, and keeps
credentials off the client. No UI changes or new network endpoint are included.
