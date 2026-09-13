# Evolve Life workflow

Use the server-only `evolveLife(planet, environment)` export from
`src/lib/ai/evolveLife.ts`. It runs Scientist → Evolution → Critic → Finalize and
returns `{ pressures, candidate, critique, organism }` on success. `critique`
is the review of the original candidate; finalization also requires a fresh
Critic approval. It preserves the candidate for inspection when a revision is used.

On failure it resolves to `{ error: { code, message, retryable, diagnosticId } }`.
Narrow the result with `"error" in result`. No rejected partial organism, provider
message, credentials, prompts, or raw model prose is returned in an error.
The frontend calls `POST /api/evolve-life` with `{ planetName }`. The server looks
up the featured planet and derives its environment locally; client-supplied
environment overrides are rejected.

The response is an `application/x-ndjson` stream of validated public events:
`progress` (`stage`, `status`), `heartbeat`, and a terminal `result` or `error`.
The browser receives final `pressures` and `organism` in a success event, plus an
optional signed `illustrationToken` containing only that validated organism and
its selected Planet/PlanetEnvironment snapshot.
Candidate drafts, the internal review ledger, prompts, SDK events, and private
model reasoning never enter this transport. Public causal explanations are the
structured adaptation fields returned by the agents.

The Evolve Life panel shows real stage starts/completions and reveals the textual
result immediately when it arrives. Its timeline can
be minimized without stopping the workflow. Results expose pressure-linked
adaptations, morphology, survival strategy, and explicit uncertainty through
disclosures. Failed or disconnected runs offer Retry; Cancel, leaving the world,
and changing planets abort the active request and discard stale results. The
world and HUD stay usable throughout. The browser has a 195-second safety timeout.

Two optional visualizations start independently after the textual result appears.
The default-checked “Place organism in the world” option requests a procedural
specimen through `POST /api/organism-scene`; “Include a field illustration” requests
a 2D concept image through `POST /api/organism-image` and displays it in the panel.
Each has its own loading state and Retry action. A failure never restarts or fails
the analysis or the other visualization. Both requests survive panel minimization.
The 3D specimen focuses the camera when ready while the panel stays open for the
illustration and field notes; “View organism” minimizes it for inspection. Users
can orbit, zoom, hide the specimen or return to exploring the world. See
[organisms in the 3D world](organism-3d.md) and
[field illustrations](organism-illustrations.md).

All stages use the SDK's structured `outputType` and validated `finalOutput`.
There is no extraction of JSON from free-form prose. The implementation follows
the [official Agents SDK running pattern](https://developers.openai.com/api/docs/guides/agents/running-agents).

## Timeouts and errors

- Each model call has a 60-second deadline and one SDK turn.
- The complete workflow has a 180-second deadline, including final review.
- At most one Evolution revision is allowed: four calls when the original
  candidate passes, five when it needs revision. There are no automatic workflow retries.
- Optional server execution options `{ signal, timeoutMs, onProgress }` allow request
  cancellation or a shorter overall deadline (1–180,000 ms).
- Cancellation is forwarded to each SDK call. The caller's wait is bounded even
  if a provider ignores cancellation; no subsequent stage starts afterward.
  An already-sent remote request may still finish at the provider.
- `onProgress` receives only fixed stage names and running/complete statuses.
  Callback failures do not change workflow execution.

Error codes are `INVALID_INPUT`, `NOT_CONFIGURED`, `TIMEOUT`, `CANCELLED`,
`AGENT_FAILED`, and `SCIENTIFIC_REVIEW_FAILED`. Missing server configuration and
invalid input should be fixed rather than retried. Client cancellation is also
non-retryable; other failures may be retried through an explicit user action.

Inputs are validated into one snapshot before execution. Agent output cannot
change Planet or PlanetEnvironment values. A failed scientific review does not
force a fantasy organism into a success response, including on extreme worlds.

## Diagnostics

JSON events on server stderr contain a per-run diagnostic ID, stage, elapsed and
stage durations, pressure/adaptation/uncertainty counts, approval and rejection
counts, and stable error codes. Match a returned error's diagnosticId to these
events. Raw input/output prose and provider errors are excluded. A broken logging
sink does not fail the workflow. Tracing and response storage remain disabled.

## Test both featured worlds

`npm run test:agents` includes offline tests of the real SDK runner for TRAPPIST-1 e
and 55 Cancri e. Model fixtures are chosen by supplied temperature category rather
than planet name; a name-swap test protects data plumbing. They exercise cold versus
extreme heat, different gravity/illumination and linked adaptations, plus failures
and cancellation. These are mocked results, not proof of live model reasoning.

For a live check, set `OPENAI_API_KEY` in `.env.local` and run
`npm run --silent evolve:compare > /tmp/evolve-life-comparison.json`.
The helper runs both worlds, prints every stage's output plus changed morphology
and strategy fields and pressure → adaptation reasoning links. It exits nonzero
if either workflow fails or both outputs are identical. Inspect the linked
reasoning: text differences alone cannot prove environmental causality or
scientific validity. No live result is substituted with a fixture on failure.

`npm run test:frontend` checks the streaming route, split network chunks, safe
error/retry responses, cancellation, rejected client overrides, and the public
output whitelist without using real API credits.

The 55 Cancri e fixture explicitly does not claim an organism can survive its
modeled extreme heating. Its compact/quiescent design is conditional on unverified
tolerable conditions. TRAPPIST-1 e's fixture instead explores a cold-environment
microfilm. Neither is evidence of life; both retain the source assumptions.
