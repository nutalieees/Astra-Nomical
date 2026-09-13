import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { OpenAIProvider, Usage, type Model, type ModelRequest } from "@openai/agents";
import { POST } from "../src/app/api/organism-scene/route";
import { buildOrganismSceneInput, generateOrganismScene, parseOrganismScene, ORGANISM_SCENE_MODEL, ORGANISM_SCENE_TIMEOUT_MS } from "../src/lib/ai/organism-scene";
import { issueOrganismImageToken } from "../src/lib/ai/organism-image-ticket";
import type { OrganismSceneSpec } from "../src/lib/evolve-life/organism-scene";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveEnvironment } from "../src/lib/astronomy/environment";
import type { ValidatedOrganism } from "../src/types/astrobiology";

const planet = FEATURED_PLANETS.find((item) => item.name === "TRAPPIST-1 e")!;
const environment = deriveEnvironment(planet);
const organism: ValidatedOrganism = {
  name: "Conditional resting multicellular sheet",
  summary: "A hypothetical multicellular sheet; active survival is not established.",
  morphology: {
    size: "A microscopic sheet, illustratively 200 micrometres across.",
    bodyPlan: "A thin multicellular sheet with a connected cell layer.",
    locomotion: "No whole-body locomotion and no legs or cilia.",
    surfaceCovering: "A soft repairable outer layer without plates or mineral armor.",
    sensorySystems: "Diffuse molecular thermal sensors, without antennae or sensory pits.",
  },
  adaptations: [{ environmentalPressure: "gravity", consequence: "Mass needs support.",
    adaptation: "A thin multicellular sheet limits the support and movement budget.", reasoning: "Simple connected tissues distribute support at a transport cost." }],
  survivalStrategy: "Conditional dormancy; solvent availability remains unverified and dormancy does not establish heat tolerance.",
  uncertainty: ["Hypothetical specimen, not evidence of life or a viable active habitat."],
};
function scene(): OrganismSceneSpec {
  return { organization: "multicellular", form: "sheet", proportions: { length: 1.8, width: 1.4, height: 0.22 },
    surface: "soft", segments: 7, appendages: { kind: "none", count: 0 }, senses: "diffuse", motion: "sessile", activity: "dormant", scale: "microscopic",
    grounding: [
      { feature: "organization", quote: organism.morphology.bodyPlan },
      { feature: "form", quote: organism.morphology.bodyPlan },
      { feature: "proportions", quote: organism.morphology.size },
      { feature: "surface", quote: organism.morphology.surfaceCovering },
      { feature: "appendages", quote: organism.morphology.locomotion },
      { feature: "senses", quote: organism.morphology.sensorySystems },
      { feature: "motion", quote: organism.morphology.locomotion },
    ] };
}
const originalKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_ORGANISM_SCENE_MODEL;
let logs: string[];
beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  delete process.env.OPENAI_ORGANISM_SCENE_MODEL;
  logs = [];
  mock.method(console, "error", (line: string) => { logs.push(line); });
  mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network call in an offline test."); });
});
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.OPENAI_ORGANISM_SCENE_MODEL; else process.env.OPENAI_ORGANISM_SCENE_MODEL = originalModel;
});
function installModel(reply: (request: ModelRequest) => unknown | Promise<unknown> = () => scene()) {
  const requests: ModelRequest[] = [], modelNames: unknown[] = [];
  const model: Model = {
    async getResponse(request) {
      requests.push(request);
      return { usage: new Usage(), output: [{ type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(await reply(request)) }] }] };
    },
    async *getStreamedResponse() { throw new Error("Streaming is not expected."); },
  };
  mock.method(OpenAIProvider.prototype, "getModel", async (name: unknown) => { modelNames.push(name); return model; });
  return { requests, modelNames };
}
function request(body: unknown, signal?: AbortSignal, headers?: HeadersInit) {
  return new Request("http://localhost/api/organism-scene", { method: "POST", body: JSON.stringify(body), signal, headers });
}

test("3D model input contains only final organism, planet and environment, preserving unknowns", () => {
  const input = buildOrganismSceneInput({ ...planet, candidate: "PRIVATE DRAFT" } as typeof planet,
    { ...environment, critique: "PRIVATE REVIEW" } as typeof environment, organism);
  assert.deepEqual(JSON.parse(input), { planet, environment, organism });
  assert.doesNotMatch(input, /PRIVATE|test-only-not-a-real-key/);
  assert.throws(() => buildOrganismSceneInput(planet, environment, { ...organism, privateReasoning: "PRIVATE" } as ValidatedOrganism));
});

test("drawing output requires seven unique exact anatomical source quotations", () => {
  assert.deepEqual(parseOrganismScene(scene(), organism), scene());
  const invalidQuotes = [
    { ...scene(), grounding: scene().grounding.map((entry) => ({ ...entry, feature: "form" })) },
    { ...scene(), grounding: scene().grounding.map((entry) => entry.feature === "surface" ? { ...entry, quote: "Invented armored plates." } : entry) },
    { ...scene(), grounding: scene().grounding.map((entry) => entry.feature === "surface" ? { ...entry, quote: "   " } : entry) },
    { ...scene(), shader: "executable code is not anatomy" },
  ];
  for (const invalid of invalidQuotes) assert.throws(() => parseOrganismScene(invalid, organism));
});

test("anatomy validation rejects unsupported structures, denied anatomy and contradictory activity", () => {
  for (const changes of [
    { organization: "unicellular" }, { organization: "colony", form: "cell" }, { form: "segmented" }, { form: "radial" },
    { proportions: { length: 1, width: 1, height: 2 } },
    { surface: "plated" }, { surface: "mineral" }, { surface: "leathery" }, { surface: "mucous" },
    { appendages: { kind: "legs", count: 6 } }, { appendages: { kind: "cilia", count: 8 } },
    { appendages: { kind: "none", count: 3 } }, { senses: "antennae" }, { senses: "pits" },
    { motion: "crawl" }, { motion: "undulate" }, { activity: "conditional-active" },
    { scale: "macroscopic" }, { scale: "unspecified" }, { segments: 999 },
  ]) assert.throws(() => parseOrganismScene({ ...scene(), ...changes }, organism), JSON.stringify(changes));
  // Isolating an affirmative noun from a full, exact denial must not authorize the trait.
  for (const quote of ["without plates or mineral armor", "plates"]) {
    const negative = { ...scene(), surface: "plated", grounding: scene().grounding.map((entry) => entry.feature === "surface"
      ? { ...entry, quote } : entry) };
    assert.throws(() => parseOrganismScene(negative, organism));
  }
});

test("an explicit single cell is kept unicellular and cannot gain multicellular limbs or sensory organs", () => {
  const cell = { ...organism, morphology: { ...organism.morphology, bodyPlan: "A single cell with a soft envelope." } };
  const output = { ...scene(), organization: "unicellular", form: "cell", grounding: scene().grounding.map((entry) =>
    entry.feature === "organization" || entry.feature === "form" ? { ...entry, quote: cell.morphology.bodyPlan } : entry) };
  assert.equal(parseOrganismScene(output, cell).organization, "unicellular");
  assert.throws(() => parseOrganismScene({ ...output, organization: "multicellular", form: "cushion" }, cell));
  assert.throws(() => parseOrganismScene({ ...output, senses: "pits" }, cell));
});

test("millimetre-wide multicellular sheets may have microscopic tissue without forcing microscopic whole-body scale", () => {
  const sheet = { ...organism, morphology: { ...organism.morphology,
    size: "Hypothetically 1–3 mm across and 20–100 micrometres thick; these are design dimensions, not planetary measurements." } };
  const output = { ...scene(), scale: "macroscopic", grounding: scene().grounding.map((entry) =>
    entry.feature === "proportions" ? { ...entry, quote: sheet.morphology.size } : entry) };
  assert.equal(parseOrganismScene(output, sheet).scale, "macroscopic");
  const solelyMicroscopic = { ...sheet, morphology: { ...sheet.morphology, size: "A 200 micrometre-wide sheet with a 20 micrometre thickness." } };
  const unsupportedMacro = { ...output, grounding: output.grounding.map((entry) => entry.feature === "proportions"
    ? { ...entry, quote: solelyMicroscopic.morphology.size } : entry) };
  assert.throws(() => parseOrganismScene(unsupportedMacro, solelyMicroscopic));
});

test("separate Agents SDK run uses structured output, a server model and no tracing, tools or history", async () => {
  const { requests, modelNames } = installModel();
  const result = await generateOrganismScene(planet, environment, organism);
  assert.deepEqual(result, { scene: scene() });
  assert.deepEqual(modelNames, [ORGANISM_SCENE_MODEL]);
  assert.equal(requests.length, 1);
  const call = requests[0];
  assert.deepEqual(call.tools, []);
  assert.deepEqual(call.handoffs, []);
  assert.equal(call.tracing, false);
  assert.equal(call.modelSettings.store, false);
  assert.equal(call.previousResponseId, undefined);
  assert.equal(call.conversationId, undefined);
  assert.ok(call.signal instanceof AbortSignal);
  assert.match(call.systemInstructions!, /ONLY source data/);
  const schema = call.outputType as unknown as { schema: { properties: Record<string, unknown> } };
  assert.ok(schema.schema.properties.grounding);
  assert.doesNotMatch(JSON.stringify(call.input), /test-only-not-a-real-key/);
  assert.doesNotMatch(logs.join("\n"), /test-only-not-a-real-key|Conditional resting|soft repairable/);
  process.env.OPENAI_ORGANISM_SCENE_MODEL = " configured-scene-model ";
  await generateOrganismScene(planet, environment, organism);
  assert.equal(modelNames[1], "configured-scene-model");
});

test("invalid input and missing credentials never start a 3D model run", async () => {
  const { requests } = installModel();
  for (const result of await Promise.all([
    generateOrganismScene({ ...planet, massEarth: NaN }, environment, organism),
    generateOrganismScene(planet, { ...environment, illumination: Infinity }, organism),
    generateOrganismScene(planet, environment, { ...organism, uncertainty: undefined } as unknown as ValidatedOrganism),
    ...[0, -1, 1.5, ORGANISM_SCENE_TIMEOUT_MS + 1].map((timeoutMs) => generateOrganismScene(planet, environment, organism, { timeoutMs })),
  ])) {
    assert.ok("error" in result);
    assert.equal(result.error.code, "INVALID_INPUT");
    assert.equal(result.error.retryable, false);
  }
  delete process.env.OPENAI_API_KEY;
  const result = await generateOrganismScene(planet, environment, organism);
  assert.ok("error" in result);
  assert.equal(result.error.code, "NOT_CONFIGURED");
  assert.equal(requests.length, 0);
});

test("3D model and malformed output failures remain controlled and redact provider details", async () => {
  let output: unknown;
  installModel(() => { if (output instanceof Error) throw output; return output; });
  for (output of [new Error("PRIVATE PROVIDER DETAIL test-only-not-a-real-key"), "unstructured prose", {},
    { ...scene(), surface: "plated" }, { ...scene(), activity: "conditional-active" }]) {
    const result = await generateOrganismScene(planet, environment, organism);
    assert.ok("error" in result);
    assert.equal(result.error.code, "SCENE_FAILED");
    assert.equal(result.error.retryable, true);
    assert.match(result.error.message, /analysis is ready/);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|test-only-not-a-real-key/);
  }
  assert.doesNotMatch(logs.join("\n"), /PRIVATE|test-only-not-a-real-key/);
});

test("3D deadlines bound ignored cancellation and discard late provider completions", async () => {
  let finish: (value: unknown) => void = () => {};
  const { requests } = installModel(() => new Promise((resolve) => { finish = resolve; }));
  const result = await generateOrganismScene(planet, environment, organism, { timeoutMs: 15 });
  assert.ok("error" in result);
  assert.equal(result.error.code, "TIMEOUT");
  assert.equal(result.error.retryable, true);
  assert.equal(requests[0].signal?.aborted, true);
  finish(scene());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(logs.some((line) => JSON.parse(line).event === "completed"), false);
});

test("cancellation before and during a 3D run preserves the controlled error contract", async () => {
  const { requests } = installModel(() => new Promise(() => {}));
  const cancelled = new AbortController(); cancelled.abort();
  const before = await generateOrganismScene(planet, environment, organism, { signal: cancelled.signal });
  assert.ok("error" in before);
  assert.equal(before.error.code, "CANCELLED");
  assert.equal(requests.length, 0);
  const controller = new AbortController();
  const pending = generateOrganismScene(planet, environment, organism, { signal: controller.signal });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 1);
  controller.abort();
  const during = await pending;
  assert.ok("error" in during);
  assert.equal(during.error.code, "CANCELLED");
  assert.equal(requests[0].signal?.aborted, true);
});

test("3D endpoint accepts only signed final context and supports an independent retry", async () => {
  let failed = true;
  const { requests } = installModel(() => { if (failed) throw new Error("PRIVATE"); return scene(); });
  const token = issueOrganismImageToken(planet, environment, organism);
  for (const body of [{}, null, { token: "invalid" }, { token, prompt: "Make a monster" }, { token, organism },
    { token, environment: { ...environment, gravityEarth: 99 } }]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal((await POST(request({ token }, undefined, { "Content-Length": "101001" }))).status, 400);
  assert.equal(requests.length, 0);
  const saved = structuredClone({ planet, environment, organism });
  const first = await POST(request({ token }));
  assert.equal(first.status, 503);
  assert.equal((await first.json()).error.retryable, true);
  failed = false;
  const retry = await POST(request({ token }));
  assert.equal(retry.status, 200);
  assert.equal(retry.headers.get("cache-control"), "no-store");
  assert.deepEqual(await retry.json(), { scene: scene() });
  assert.deepEqual({ planet, environment, organism }, saved);
  assert.equal(requests.length, 2);
});
