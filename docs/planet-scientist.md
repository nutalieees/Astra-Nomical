# Planet Scientist

Implemented with the official TypeScript Agents SDK (`@openai/agents`): a focused
`Agent`, Zod `outputType`, and a `Runner` using the Responses provider.
See [OpenAI agent definitions](https://developers.openai.com/api/docs/guides/agents/define-agents)
and [SDK quickstart](https://developers.openai.com/api/docs/guides/agents/quickstart).

Server-side usage:

```ts
import { runPlanetScientist } from "./src/lib/ai/planet-scientist";

const pressures = await runPlanetScientist(planet, environment);
// EnvironmentalPressure[]; environment.assumptions is included automatically.
```

Only the selected Planet and PlanetEnvironment (including all its assumptions)
are sent. Extra runtime properties are stripped. No lookup tools, other agent
results, conversation history, or separate provenance dataset are included.
Because Planet has no per-field provenance, the instructions distinguish supplied
archive data from directly measured data. Derived values relying on defaults
must be identified as assumptions.

Each of the 3–6 pressures includes factor, pressure, severity and evidence.
Evidence begins with `Known data:`, `Derived:`, `Assumed:` or `Unknown:`.
`knownValue` is omitted when unknown or assumed. An internal object envelope and
nullable field satisfy API structured-output requirements; callers receive the
existing `EnvironmentalPressure[]` contract. Runtime validation rejects invalid
counts, duplicate categories, missing evidence labels, and assumed known values.
Scientific truth and prompt compliance still require review of live model output;
schema validation alone cannot prove factual accuracy.

This stage only identifies environmental pressures. It does not design an alien
and is not yet connected to the client-side Evolve Life preview.

## Run on TRAPPIST-1 e

1. Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY` there.
2. Run `npm run scientist` to print the validated pressure array.

The default model is `gpt-6-astra`. A server-side `OPENAI_SCIENTIST_MODEL` override
is available for a model your API project can access. Never use `NEXT_PUBLIC_`
for either variable. The helper loads Next.js environment files and exits nonzero
on missing credentials, provider failure, refusal, or invalid output.

`server-only` prevents importing the implementation into a Next.js client bundle.
The helper/test commands use the `react-server` condition to run that module in
Node. Runs have a 60-second abort signal and a one-turn limit. Tracing is disabled,
response storage is disabled, and provider errors are replaced by a safe message.

## Checks

Run `npm run test:scientist`, `npm run typecheck`, and `npm run build`.
Tests use a fake model through the real SDK runner, without network calls or API
charges. They do not certify the quality of a live model's scientific reasoning.
