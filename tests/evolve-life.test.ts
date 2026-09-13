import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { OpenAIProvider, Usage, type Model, type ModelRequest, type ModelResponse } from "@openai/agents";
import { evolveLife } from "../src/lib/ai/evolveLife";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveEnvironment } from "../src/lib/astronomy/environment";
import type { CandidateOrganism } from "../src/types/astrobiology";
import type { EvolveLifeResult, EvolveLifeSuccess } from "../src/types/evolve-life";
import trappistPressures from "./fixtures/trappist-1e-scientist.json";
import trappistCandidate from "./fixtures/trappist-1e-candidate.json";
import cancriPressures from "./fixtures/55-cancri-e-scientist.json";
import cancriCandidate from "./fixtures/55-cancri-e-candidate.json";

const trappist = FEATURED_PLANETS.find((planet) => planet.name === "TRAPPIST-1 e")!;
const cancri = FEATURED_PLANETS.find((planet) => planet.name === "55 Cancri e")!;
const originalKey = process.env.OPENAI_API_KEY;
let logs: string[] = [];
beforeEach(() => {
  logs = [];
  mock.method(console, "error", (line: string) => { logs.push(line); });
});
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});

function context(request: ModelRequest) {
  const items = request.input as unknown as { role?: string; content?: string | { text?: string }[] }[];
  const raw = typeof request.input === "string" ? request.input : items
    .filter((item) => item.role === "user")
    .map((item) => typeof item.content === "string" ? item.content : item.content?.map((part) => part.text ?? "").join(""))
    .join("");
  return JSON.parse(raw);
}
function review(candidate: CandidateOrganism, reject = false) {
  return { reviews: ["organism", ...candidate.adaptations.map((_, index) => `adaptations[${index}]`)]
    .map((target) => ({ target, assessment: "Fixture assessment of supplied conditions and explicit uncertainties.",
      issues: reject && target === "organism" ? [{ category: "excessive certainty", reason: "Fixture requires stronger qualifications.",
        revision: "Keep the functional traits and qualify all unverified prerequisites." }] : [] })) };
}
function response(output: unknown): ModelResponse {
  return { usage: new Usage(), output: [{ type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
}
function success(result: EvolveLifeResult): EvolveLifeSuccess {
  assert.equal("error" in result, false, JSON.stringify(result));
  return result as EvolveLifeSuccess;
}
function installModel(reply: (request: ModelRequest, index: number) => ModelResponse | Promise<ModelResponse>) {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  const requests: ModelRequest[] = [];
  const model: Model = {
    async getResponse(request) {
      const index = requests.length;
      requests.push(request);
      return reply(request, index);
    },
    async *getStreamedResponse() { throw new Error("Streaming is not expected."); },
  };
  mock.method(OpenAIProvider.prototype, "getModel", async () => model);
  return requests;
}
// A deterministic test double routes by ENVIRONMENT, never by planet name.
// This verifies orchestration/data plumbing, not live scientific reasoning.
function fixtureReply(request: ModelRequest, reject = false) {
  const input = context(request);
  const extreme = input.environment.temperatureCategory === "extreme";
  const instructions = request.systemInstructions ?? "";
  if (instructions.startsWith("You are the Planet Scientist")) {
    const pressures = extreme ? cancriPressures : trappistPressures;
    return response({ pressures: pressures.map((pressure) => ({ ...pressure, knownValue: pressure.knownValue ?? null })) });
  }
  if (instructions.startsWith("You are the Evolution Agent") && instructions.includes("This is a revision pass of the Evolution Agent.")) {
    return response({ ...(extreme ? cancriCandidate : trappistCandidate), uncertainty: ["Solvent and energy supply remain unverified."] });
  }
  if (instructions.startsWith("You are the Evolution Agent")) return response(extreme ? cancriCandidate : trappistCandidate);
  if (instructions.startsWith("You are the Scientific Critic")) return response(review(input.candidate, reject));
  throw new Error("Unexpected agent role.");
}

test("complete workflows return all four outputs with environment-linked differences for both featured worlds", async () => {
  const requests = installModel((request) => fixtureReply(request));
  // Parallel calls must not share agent state or the selected world.
  const [first, second] = await Promise.all([
    evolveLife(trappist, deriveEnvironment(trappist)), evolveLife(cancri, deriveEnvironment(cancri)),
  ]);
  const cold = success(first);
  const hot = success(second);
  assert.equal(requests.length, 8); // Four SDK calls per approved workflow.
  assert.deepEqual(Object.keys(cold).sort(), ["candidate", "critique", "organism", "pressures"]);
  assert.deepEqual(cold.pressures, trappistPressures);
  assert.deepEqual(hot.pressures, cancriPressures);
  assert.equal(cold.pressures.find((pressure) => pressure.factor === "gravity")!.knownValue, "0.818 g (derived)");
  assert.equal(hot.pressures.find((pressure) => pressure.factor === "gravity")!.knownValue, "2.273 g (derived)");
  assert.notDeepEqual(cold.organism.morphology, hot.organism.morphology);
  assert.notEqual(cold.organism.survivalStrategy, hot.organism.survivalStrategy);
  assert.match(hot.organism.survivalStrategy, /No viable active strategy/);
  assert.match(hot.organism.adaptations[1].reasoning, /support and movement/);
  assert.match(cold.organism.adaptations[1].reasoning, /cold intervals/);
  for (const result of [cold, hot]) {
    assert.ok(result.organism.adaptations.every((adaptation) => result.pressures.some((pressure) => pressure.factor === adaptation.environmentalPressure)));
    assert.ok(result.organism.uncertainty.some((text) => text.includes("not evidence of life")));
  }
  for (const request of requests) {
    const input = context(request);
    const expectedPlanet = input.planet.name === trappist.name ? trappist : cancri;
    assert.deepEqual(input.planet, expectedPlanet);
    assert.deepEqual(input.environment, deriveEnvironment(expectedPlanet));
    assert.deepEqual(request.tools, []);
    assert.deepEqual(request.handoffs, []);
    assert.equal(request.modelSettings.store, false);
    assert.equal(request.tracing, false);
  }
  const events = logs.map((line) => JSON.parse(line));
  const ids = [...new Set(events.map((event) => event.diagnosticId))];
  assert.equal(ids.length, 2);
  for (const id of ids) {
    assert.deepEqual(events.filter((event) => event.diagnosticId === id && event.event === "stage_completed").map((event) => event.stage),
      ["scientist", "evolution", "critic", "finalize"]);
  }
});

test("swapping display names does not swap the supplied environment or fixture organism", async () => {
  installModel((request) => fixtureReply(request));
  const renamedCold = success(await evolveLife({ ...trappist, name: cancri.name }, deriveEnvironment(trappist)));
  const renamedHot = success(await evolveLife({ ...cancri, name: trappist.name }, deriveEnvironment(cancri)));
  assert.deepEqual(renamedCold.organism.morphology, trappistCandidate.morphology);
  assert.deepEqual(renamedHot.organism.morphology, cancriCandidate.morphology);
});

test("the initial candidate/critique stay inspectable when finalization revises", async () => {
  const requests = installModel((request, index) => fixtureReply(request, index === 2));
  const result = success(await evolveLife(trappist, deriveEnvironment(trappist)));
  assert.equal(requests.length, 5);
  assert.deepEqual(result.candidate, trappistCandidate);
  assert.equal(result.critique.approved, false);
  assert.ok(result.organism.uncertainty.includes("Solvent and energy supply remain unverified."));
});

test("invalid input and missing configuration resolve as controlled errors without model calls", async () => {
  const requests = installModel(() => { throw new Error("Must not run."); });
  const invalid = await evolveLife({ ...trappist, radiusEarth: NaN }, deriveEnvironment(trappist));
  assert.ok("error" in invalid);
  assert.equal(invalid.error.code, "INVALID_INPUT");
  delete process.env.OPENAI_API_KEY;
  const unconfigured = await evolveLife(trappist, deriveEnvironment(trappist));
  assert.ok("error" in unconfigured);
  assert.equal(unconfigured.error.code, "NOT_CONFIGURED");
  assert.equal(unconfigured.error.retryable, false);
  assert.equal(requests.length, 0);
});

test("provider failure at every stage is controlled, stops the sequence, and logs no secret prose", async () => {
  for (const failIndex of [0, 1, 2, 3]) {
    const requests = installModel((request, index) => {
      if (index === failIndex) throw new Error("Provider raw prose test-only-not-a-real-key");
      return fixtureReply(request);
    });
    const result = await evolveLife(trappist, deriveEnvironment(trappist));
    assert.ok("error" in result);
    assert.equal(result.error.code, "AGENT_FAILED");
    assert.equal(requests.length, failIndex + 1);
    assert.equal("organism" in result, false);
    assert.equal(JSON.stringify(result).includes("test-only-not-a-real-key"), false);
    assert.ok(logs.some((line) => line.includes(result.error.diagnosticId)));
    mock.restoreAll();
    mock.method(console, "error", (line: string) => { logs.push(line); });
  }
  assert.equal(logs.join("\n").includes("test-only-not-a-real-key"), false);
  assert.equal(logs.join("\n").includes("Provider raw prose"), false);
  assert.equal(logs.join("\n").includes(trappistCandidate.summary), false);
});

test("malformed structured output and unresolved scientific rejection return controlled errors", async () => {
  installModel(() => response("Unstructured model prose"));
  const malformed = await evolveLife(trappist, deriveEnvironment(trappist));
  assert.ok("error" in malformed);
  assert.equal(malformed.error.code, "AGENT_FAILED");
  mock.restoreAll();
  mock.method(console, "error", (line: string) => { logs.push(line); });
  const requests = installModel((request) => fixtureReply(request, true));
  const rejected = await evolveLife(cancri, deriveEnvironment(cancri));
  assert.ok("error" in rejected);
  assert.equal(rejected.error.code, "SCIENTIFIC_REVIEW_FAILED");
  assert.equal(requests.length, 5);
});

test("overall timeout cancels a hanging SDK call and later output cannot resume the workflow", async () => {
  let finish: (value: ModelResponse) => void = () => {};
  const requests = installModel(() => new Promise<ModelResponse>((resolve) => { finish = resolve; }));
  const result = await evolveLife(trappist, deriveEnvironment(trappist), { timeoutMs: 20 });
  assert.ok("error" in result);
  assert.equal(result.error.code, "TIMEOUT");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].signal?.aborted, true);
  finish(fixtureReply(requests[0]));
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(requests.length, 1);
});

test("request cancellation, including during finalization, stops internal calls", async () => {
  const cancelled = new AbortController();
  cancelled.abort();
  const before = installModel(() => { throw new Error("Must not run."); });
  const result = await evolveLife(trappist, deriveEnvironment(trappist), { signal: cancelled.signal });
  assert.ok("error" in result);
  assert.equal(result.error.code, "CANCELLED");
  assert.equal(before.length, 0);
  mock.restoreAll();
  mock.method(console, "error", (line: string) => { logs.push(line); });
  const active = new AbortController();
  const requests = installModel((request, index) => {
    if (index === 3) active.abort(); // Cancel the Evolution revision.
    return fixtureReply(request, index === 2);
  });
  const during = await evolveLife(trappist, deriveEnvironment(trappist), { signal: active.signal });
  assert.ok("error" in during);
  assert.equal(during.error.code, "CANCELLED");
  assert.equal(requests.length, 4); // No final Critic after cancellation.
});

test("a broken diagnostic sink cannot crash the workflow", async () => {
  installModel((request) => fixtureReply(request));
  mock.method(console, "error", () => { throw new Error("Logging sink unavailable."); });
  success(await evolveLife(trappist, deriveEnvironment(trappist)));
});
