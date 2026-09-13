import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { OpenAIProvider, Usage, type Model, type ModelRequest } from "@openai/agents";
import {
  criticContext, criticOutputSchema, parseCriticOutput, critiqueResultSchema, runScientificCritic,
} from "../src/lib/ai/scientific-critic";
import {
  finalizeOrganism, OrganismValidationError, reviewAndFinalizeOrganism, validatedOrganismSchema,
} from "../src/lib/ai/finalize-organism";
import { parseEvolutionPressures, runEvolutionAgent } from "../src/lib/ai/evolution-agent";
import { runPlanetScientist } from "../src/lib/ai/planet-scientist";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveEnvironment } from "../src/lib/astronomy/environment";
import type { CandidateOrganism } from "../src/types/astrobiology";
import pressuresFixture from "./fixtures/trappist-1e-scientist.json";
import candidateFixture from "./fixtures/trappist-1e-candidate.json";

const planet = FEATURED_PLANETS.find((value) => value.name === "TRAPPIST-1 e")!;
const environment = deriveEnvironment(planet);
const pressures = parseEvolutionPressures(pressuresFixture);
const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});

type Ledger = ReturnType<ReturnType<typeof criticOutputSchema>["parse"]>;
function ledger(candidate: CandidateOrganism = candidateFixture): Ledger {
  return { reviews: ["organism", ...candidate.adaptations.map((_, index) => `adaptations[${index}]`)]
    .map((target) => ({ target, assessment: "The proposal is conditional and consistent with the supplied evidence limits.", issues: [] })) };
}
function rejectedLedger(candidate: CandidateOrganism = candidateFixture): Ledger {
  const result = ledger(candidate);
  result.reviews[0].issues.push({
    category: "excessive certainty", reason: "The summary asserts demonstrated viability without evidence.",
    revision: "Remove the viability claim and explicitly preserve unverified prerequisites.",
  });
  return result;
}
function proposed() {
  return { ...structuredClone(candidateFixture), uncertainty: ["Solvent and energy availability are unverified."] };
}
function installReplies(replies: unknown[], onRequest?: (request: ModelRequest, index: number) => void) {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  const requests: ModelRequest[] = [];
  const model: Model = {
    async getResponse(request) {
      const index = requests.length;
      requests.push(request);
      onRequest?.(request, index);
      assert.ok(index < replies.length, "Unexpected extra model call / revision loop");
      return { usage: new Usage(), output: [{
        type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(replies[index]) }],
      }] };
    },
    async *getStreamedResponse() { throw new Error("Streaming is not expected."); },
  };
  mock.method(OpenAIProvider.prototype, "getModel", async () => model);
  return requests;
}
function requestContext(request: ModelRequest) {
  const items = request.input as unknown as { role?: string; content?: string | { text?: string }[] }[];
  const raw = typeof request.input === "string" ? request.input : items
    .filter((item) => item.role === "user")
    .map((item) => typeof item.content === "string" ? item.content : item.content?.map((part) => part.text ?? "").join(""))
    .join("");
  return JSON.parse(raw);
}
function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

test("Critic requires one review for every adaptation and one organism-wide review", () => {
  assert.deepEqual(parseCriticOutput(ledger(), candidateFixture, pressures), {
    approved: true, rejectedTraits: [], revisions: [],
  });
  const missing = ledger();
  missing.reviews.pop();
  assert.throws(() => parseCriticOutput(missing, candidateFixture, pressures));
  const duplicate = ledger();
  duplicate.reviews[1].target = duplicate.reviews[2].target;
  assert.throws(() => parseCriticOutput(duplicate, candidateFixture, pressures));
  const unknown = ledger();
  unknown.reviews[1].target = "adaptations[99]";
  assert.throws(() => parseCriticOutput(unknown, candidateFixture, pressures));
});

test("all six issue categories map to rejected traits and actionable revisions", () => {
  const report = ledger();
  const categories = ["unsupported pressure", "trait contradiction", "unsupported atmosphere",
    "counterproductive", "excessive certainty", "aesthetic only"] as const;
  report.reviews[0].issues = categories.map((category) => ({
    category, reason: `Fixture finding: ${category}.`, revision: `Correct the organism's ${category} issue.`,
  }));
  const result = parseCriticOutput(report, candidateFixture, pressures);
  assert.equal(result.approved, false);
  assert.equal(result.rejectedTraits.length, 6);
  categories.forEach((category, index) => assert.ok(result.rejectedTraits[index].reason.startsWith(category)));
  assert.equal(result.revisions.length, 6);
  assert.equal(critiqueResultSchema.safeParse({ ...result, approved: true }).success, false);
});

test("unknown pressure references are reviewable and cannot receive approval", async () => {
  const candidate = structuredClone(candidateFixture);
  candidate.adaptations[0].environmentalPressure = "oxygen atmosphere";
  installReplies([ledger(candidate)]); // Deliberately simulate a missed finding.
  const result = await runScientificCritic(planet, environment, pressures, candidate);
  assert.equal(result.approved, false);
  assert.ok(result.rejectedTraits.some((trait) => trait.trait === "adaptations[0]"));
});

test("full mocked TRAPPIST-1 e workflow retains good ideas and removes a rejected aesthetic trait", async () => {
  const candidate = structuredClone(candidateFixture);
  candidate.adaptations.push({ environmentalPressure: "gravity", consequence: "None supported.",
    adaptation: "Decorative glowing spikes.", reasoning: "Visual appeal only." });
  const critique = ledger(candidate);
  critique.reviews.at(-1)!.issues.push({ category: "aesthetic only", reason: "Spikes have no supplied functional basis.",
    revision: "Remove decorative spikes and any related claims; retain the functional microfilm traits." });
  const replies = [
    { pressures: pressuresFixture.map((pressure) => ({ ...pressure, knownValue: pressure.knownValue ?? null })) },
    candidate, critique, proposed(), ledger(),
  ];
  const requests = installReplies(replies);
  const supplied = await runPlanetScientist(planet, environment);
  const designed = await runEvolutionAgent(planet, environment, supplied);
  const result = await reviewAndFinalizeOrganism(planet, environment, supplied, designed);
  assert.equal(requests.length, 5);
  assert.equal(result.critique.approved, false);
  assert.deepEqual(result.organism.adaptations, candidateFixture.adaptations);
  assert.deepEqual(result.organism.morphology, candidateFixture.morphology);
  assert.equal(JSON.stringify(result.organism).includes("spikes"), false);
  assert.ok(environment.assumptions.every((assumption) => result.organism.uncertainty.includes(assumption)));
  assert.ok(result.organism.uncertainty.some((value) => value.includes("Unknown:")));
  assert.ok(result.organism.uncertainty.some((value) => value.includes("not evidence of life")));
  assert.match(requests[2].systemInstructions!, /Scientific Critic/);
  assert.match(requests[3].systemInstructions!, /revision pass/);
  const revisionInput = requestContext(requests[3]);
  assert.deepEqual(revisionInput.critique, result.critique);
  assert.match(requestContext(requests[4]).candidate.summary, /Final uncertainty statements/);
  assert.equal(result.organism.summary, candidateFixture.summary);
});

test("an approved candidate is preserved and still gets a final independent review", async () => {
  const requests = installReplies([ledger(), ledger()]);
  const result = await reviewAndFinalizeOrganism(planet, environment, pressures, candidateFixture);
  assert.equal(requests.length, 2);
  assert.equal(result.critique.approved, true);
  const { uncertainty, ...candidate } = result.organism;
  assert.deepEqual(candidate, candidateFixture);
  assert.ok(uncertainty.length > 0);
});

test("a failed revision cannot be returned as ValidatedOrganism and does not loop", async () => {
  const requests = installReplies([rejectedLedger(), proposed(), rejectedLedger()]);
  await assert.rejects(reviewAndFinalizeOrganism(planet, environment, pressures, candidateFixture), (error: unknown) => {
    assert.ok(error instanceof OrganismValidationError);
    assert.equal(error.critique.approved, false);
    assert.deepEqual(error.revisedCandidate, candidateFixture);
    return true;
  });
  assert.equal(requests.length, 3);
});

test("a caller-provided approved flag cannot bypass the final Critic", async () => {
  const requests = installReplies([rejectedLedger()]);
  await assert.rejects(finalizeOrganism(planet, environment, pressures, candidateFixture, {
    approved: true, rejectedTraits: [], revisions: [],
  }), OrganismValidationError);
  assert.equal(requests.length, 1);
});

test("fixed Planet and PlanetEnvironment survive all stages without mutation", async () => {
  const fixed = freezeDeep(structuredClone({ planet, environment, pressures, candidate: candidateFixture }));
  const snapshot = structuredClone(fixed);
  const requests = installReplies([rejectedLedger(), proposed(), ledger()]);
  await reviewAndFinalizeOrganism(fixed.planet, fixed.environment, fixed.pressures, fixed.candidate);
  assert.deepEqual(fixed, snapshot);
  requests.forEach((request) => {
    const input = requestContext(request);
    assert.deepEqual(input.planet, snapshot.planet);
    assert.deepEqual(input.environment, snapshot.environment);
    assert.deepEqual(input.pressures, snapshot.pressures);
    assert.deepEqual(request.tools, []);
    assert.deepEqual(request.handoffs, []);
    assert.equal(request.tracing, false);
    assert.equal(request.modelSettings.store, false);
    assert.ok(request.signal);
    assert.equal(JSON.stringify(input).includes("test-only-not-a-real-key"), false);
  });
});

test("the workflow snapshot survives caller edits during an in-flight review", async () => {
  const mutablePlanet = structuredClone(planet);
  const mutableEnvironment = structuredClone(environment);
  const requests = installReplies([rejectedLedger(), proposed(), ledger()], (_, index) => {
    if (index === 0) {
      mutablePlanet.massEarth = 999;
      mutableEnvironment.gravityEarth = 999;
      mutableEnvironment.assumptions.push("A later caller edit.");
    }
  });
  const result = await reviewAndFinalizeOrganism(mutablePlanet, mutableEnvironment, pressures, candidateFixture);
  requests.forEach((request) => {
    assert.deepEqual(requestContext(request).planet, planet);
    assert.deepEqual(requestContext(request).environment, environment);
  });
  assert.equal(result.organism.uncertainty.includes("A later caller edit."), false);
});

test("output schemas reject environmental patches and invalid revised pressure references", () => {
  assert.throws(() => parseCriticOutput({ ...ledger(), planet: { massEarth: 999 } }, candidateFixture, pressures));
  const schema = validatedOrganismSchema(pressures);
  assert.equal(schema.safeParse({ ...proposed(), environment: { gravityEarth: 999 } }).success, false);
  const revised = proposed();
  revised.adaptations[0].environmentalPressure = "new conditions";
  assert.equal(schema.safeParse(revised).success, false);
  assert.equal(schema.safeParse({ ...proposed(), uncertainty: [] }).success, false);
  const checked = criticContext({ ...planet, privateExtra: "strip me" } as typeof planet,
    environment, pressures, candidateFixture);
  assert.equal("privateExtra" in checked.planet, false);
});

test("malformed Critic output fails closed through the real SDK runner", async () => {
  const malformed = ledger();
  malformed.reviews.pop();
  installReplies([malformed]);
  await assert.rejects(runScientificCritic(planet, environment, pressures, candidateFixture), /complete valid review/);
});

test("missing credentials and provider errors do not leak secrets", async () => {
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(runScientificCritic(planet, environment, pressures, candidateFixture), /Set OPENAI_API_KEY/);
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  mock.method(OpenAIProvider.prototype, "getModel", async () => { throw new Error("Provider includes test-only-not-a-real-key"); });
  await assert.rejects(runScientificCritic(planet, environment, pressures, candidateFixture), (error: Error) => {
    assert.equal(error.message, "Scientific Critic could not return a complete valid review. Please retry.");
    assert.equal(error.cause, undefined);
    return true;
  });
  await assert.rejects(finalizeOrganism(planet, environment, pressures, candidateFixture,
    parseCriticOutput(rejectedLedger(), candidateFixture, pressures)), /Organism revision could not return a valid result/);
});
