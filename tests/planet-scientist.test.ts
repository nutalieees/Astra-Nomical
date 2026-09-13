import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { OpenAIProvider, Usage, type Model, type ModelRequest } from "@openai/agents";
import {
  parseScientistOutput, runPlanetScientist, scientistInput,
} from "../src/lib/ai/planet-scientist";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveEnvironment } from "../src/lib/astronomy/environment";
import trappistPressures from "./fixtures/trappist-1e-scientist.json";

const planet = FEATURED_PLANETS.find((item) => item.name === "TRAPPIST-1 e")!;
const environment = deriveEnvironment(planet);
const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});

function fixture() {
  return { pressures: trappistPressures.map((pressure) => ({ ...pressure, knownValue: pressure.knownValue ?? null })) };
}

test("real SDK runner returns EnvironmentalPressure[] with only permitted context", async () => {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  let request: ModelRequest | undefined;
  let calls = 0;
  const model: Model = {
    async getResponse(input) {
      calls += 1;
      request = input;
      return { usage: new Usage(), output: [{
        type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(fixture()) }],
      }] };
    },
    async *getStreamedResponse() { throw new Error("Streaming is not expected."); },
  };
  mock.method(OpenAIProvider.prototype, "getModel", async () => model);
  const result = await runPlanetScientist(planet, environment);
  assert.equal(calls, 1);
  assert.equal(result.length, 3);
  assert.equal(result[0].knownValue, fixture().pressures[0].knownValue);
  assert.equal("knownValue" in result[2], false);
  assert.ok(request);
  assert.deepEqual(request.tools, []);
  assert.deepEqual(request.handoffs, []);
  assert.equal(request.tracing, false);
  assert.equal(request.modelSettings.store, false);
  assert.ok(request.signal);
  const serialized = JSON.stringify(request.input);
  assert.ok(serialized.includes("TRAPPIST-1 e"));
  assert.equal(serialized.includes("test-only-not-a-real-key"), false);
  assert.deepEqual(JSON.parse(scientistInput(planet, environment)), { planet, environment });
});

test("all five featured inputs are accepted and unrelated runtime properties are stripped", () => {
  for (const featured of FEATURED_PLANETS) {
    const env = deriveEnvironment(featured);
    const input = JSON.parse(scientistInput(
      { ...featured, alien: "must not be sent" } as typeof planet,
      { ...env, apiKey: "must not be sent" } as typeof environment,
    ));
    assert.deepEqual(input, { planet: featured, environment: env });
  }
});

test("missing measurements remain missing and fallback assumptions are preserved", () => {
  const sparse = { name: "Unknown world" };
  const derived = deriveEnvironment(sparse);
  const input = JSON.parse(scientistInput(sparse, derived));
  assert.deepEqual(input.planet, sparse);
  assert.deepEqual(input.environment.assumptions, derived.assumptions);
  assert.ok(derived.assumptions.length > 1);
  assert.throws(() => scientistInput({ ...planet, massEarth: NaN }, environment));
});

test("rejects invalid counts, duplicate pressures, extra alien fields, and evidence errors", () => {
  assert.throws(() => parseScientistOutput(undefined));
  assert.throws(() => parseScientistOutput({ pressures: fixture().pressures.slice(0, 2) }));
  assert.throws(() => parseScientistOutput({ pressures: Array(7).fill(fixture().pressures[0]) }));
  assert.throws(() => parseScientistOutput({ pressures: Array(3).fill(fixture().pressures[0]) }));
  const alien = fixture();
  Object.assign(alien.pressures[0], { adaptation: "Powerful limbs" });
  assert.throws(() => parseScientistOutput(alien));
  const unlabeled = fixture();
  unlabeled.pressures[0].evidence = "Gravity is known.";
  assert.throws(() => parseScientistOutput(unlabeled));
  const assumed = fixture();
  assumed.pressures[0].evidence = "Assumed: gravity defaulted to Earth gravity.";
  assert.throws(() => parseScientistOutput(assumed));
});

test("missing credentials fail before any provider request", async () => {
  delete process.env.OPENAI_API_KEY;
  const provider = mock.method(OpenAIProvider.prototype, "getModel", () => {
    throw new Error("Must not call provider.");
  });
  await assert.rejects(runPlanetScientist(planet, environment), /Set OPENAI_API_KEY/);
  assert.equal(provider.mock.callCount(), 0);
});

test("provider errors are sanitized", async () => {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  mock.method(OpenAIProvider.prototype, "getModel", async () => {
    throw new Error("Provider details containing test-only-not-a-real-key");
  });
  await assert.rejects(runPlanetScientist(planet, environment), (error: Error) => {
    assert.equal(error.message, "Planet Scientist could not return valid pressures. Please retry.");
    assert.equal(error.cause, undefined);
    return true;
  });
});

test("invalid model output fails through the real SDK without a fabricated fallback", async () => {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  const model: Model = {
    async getResponse() {
      return { usage: new Usage(), output: [{
        type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: '{"pressures":[]}' }],
      }] };
    },
    async *getStreamedResponse() { throw new Error("Streaming is not expected."); },
  };
  mock.method(OpenAIProvider.prototype, "getModel", async () => model);
  await assert.rejects(runPlanetScientist(planet, environment), /could not return valid pressures/);
});
