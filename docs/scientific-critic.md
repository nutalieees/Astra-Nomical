# Scientific Critic and finalization

`runScientificCritic(planet, environment, pressures, candidate)` is the independent
server-side third agent. It returns the existing `CritiqueResult`: approval,
rejectedTraits, and actionable revisions. It checks pressure support, contradictions,
atmospheric assumptions, counterproductive traits, excessive certainty and merely
aesthetic features. Inputs cannot grant it tools or override its instructions.

The SDK's internal structured output is a review ledger: exactly one assessment
for each `adaptations[index]` plus one organism-wide assessment of morphology,
summary, strategy and cross-trait consistency. Runtime checks reject incomplete
or duplicate reviews. Public approval/findings are derived from this ledger, so
an approval flag cannot disagree with the listed issues. Rejection targets are
zero-based paths into the original candidate, with `organism` for broader issues.
Unknown pressure references are also flagged deterministically, even if a model
overlooks them. Semantic scientific judgments still depend on model quality.

This follows the official [Agents SDK structured-output pattern](https://developers.openai.com/api/docs/guides/agents/define-agents).

## Bounded revision and finalization

`finalizeOrganism(planet, environment, pressures, candidate, critique)` returns
`ValidatedOrganism` only after a fresh Critic approval:

1. If the original critique approves, preserve the candidate without a rewrite.
2. Otherwise make **one** revision call to the existing Evolution Agent, retaining
   defensible ideas and revising/removing flagged claims throughout the organism.
3. Validate the output shape and all pressure references. Preserve environment
   assumptions and assumed/unknown pressure evidence in the uncertainty list.
4. Run the Critic again on the proposed organism. Include the uncertainty claims
   in its review copy of the summary, so that list cannot conceal unsupported claims.
5. If still rejected, throw `OrganismValidationError` with the final critique and
   revised candidate for inspection. Do not return a validated result or loop.

`reviewAndFinalizeOrganism(...)` combines initial critique and finalization and
returns `{ critique, organism }`. It takes one snapshot for the entire flow.
This uses two calls for an approved candidate, or three for a revised candidate.
Each call has one SDK turn and a 60-second abort signal; there are no automatic
agent discussion loops. The final Critic also gates separately supplied approval
flags passed directly to `finalizeOrganism`.

`ValidatedOrganism` means a hypothetical proposal passed this consistency review,
not that its existence or viability has been scientifically established. The
uncertainty list always makes that distinction. If no defensible organism can be
produced, the workflow fails explicitly instead of fabricating a successful result.

## Immutable evidence and credentials

All inputs are validated and copied before awaits. Neither model receives mutable
objects, update tools, or an output field for replacing Planet, PlanetEnvironment,
their calculations or pressure inputs. Strict output schemas reject such fields.
Revision instructions cannot authorize environmental edits. Original inputs remain
unchanged even after errors; all stages use the original snapshot.

Modules use `server-only`; credentials, SDK state and provider errors are not sent
to a client. Tracing and response storage are disabled. Set `OPENAI_API_KEY` in
`.env.local`; `OPENAI_CRITIC_MODEL` defaults to `gpt-6-astra`. Revisions use the
existing `OPENAI_EVOLUTION_MODEL`. No UI or HTTP endpoint is added here.

## Run and inspect

- `npm run critic`: review/finalize the existing TRAPPIST-1 e test fixtures.
- `npm run critic -- /path/to/pressures.json /path/to/candidate.json`: replay saved
  stage outputs. Both must belong to TRAPPIST-1 e; the helper cannot verify their
  origin because these output contracts contain no planet ID.
- `npm run test:agents`: offline SDK-runner tests for the entire workflow.

The helper prints `{ critique, organism }` JSON to stdout on success and safe
errors to stderr on failure. Fixture notices are explicit: fixtures are mocked
test data, not recorded live model results. Tests verify control flow, complete
coverage, validation, preserved good traits, removals and immutable inputs. They
do not certify an actual model's scientific reasoning; that requires a live run.
