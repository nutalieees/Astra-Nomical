import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { OpenAIProvider, Usage, type Model, type ModelRequest } from "@openai/agents";
import {
  evolutionInput, evolutionOutputSchema, parseEvolutionOutput,
  parseEvolutionPressures, runEvolutionAgent,
} from "../src/lib/ai/evolution-agent";
import { runPlanetScientist } from "../src/lib/ai/planet-scientist";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveEnvironment } from "../src/lib/astronomy/environment";
import type { CandidateOrganism, EnvironmentalPressure } from "../src/types/astrobiology";
import trappistPressures from "./fixtures/trappist-1e-scientist.json";
import candidateFixture from "./fixtures/trappist-1e-candidate.json";

const planet = FEATURED_PLANETS.find((item) => item.name === "TRAPPIST-1 e")!;
const environment = deriveEnvironment(planet);
const pressures = parseEvolutionPressures(trappistPressures);
const originalKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_EVOLUTION_MODEL;
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.OPENAI_EVOLUTION_MODEL;
  else process.env.OPENAI_EVOLUTION_MODEL = originalModel;
});

// A hand-authored candidate tests the contract, not live model reasoning quality.
function candidate(): CandidateOrganism {
  return structuredClone(candidateFixture);
}

function fakeModel(reply: (request: ModelRequest) => unknown): Model {
  return {
    async getResponse(request) {
      return { usage: new Usage(), output: [{
        type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(reply(request)) }],
      }] };
    },
    async *getStreamedResponse() { throw new Error("Streaming is not expected."); },
  };
}

test("TRAPPIST-1 e Scientist output feeds Evolution through two independently inspectable SDK runs", async () => {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  const requests: ModelRequest[] = [];
  mock.method(OpenAIProvider.prototype, "getModel", async () => fakeModel((request) => {
    requests.push(request);
    if (requests.length === 1) {
      return { pressures: trappistPressures.map((pressure) => ({ ...pressure, knownValue: pressure.knownValue ?? null })) };
    }
    return candidate();
  }));
  const scientistOutput = await runPlanetScientist(planet, environment);
  assert.deepEqual(scientistOutput, pressures);
  assert.equal(scientistOutput[0].knownValue, `${environment.gravityEarth} g (derived)`);
  assert.equal(scientistOutput[1].knownValue, `${planet.equilibriumTemperatureK} K (supplied)`);
  const result = await runEvolutionAgent(planet, environment, scientistOutput);
  assert.equal(requests.length, 2);
  assert.deepEqual(result, candidate());
  for (const adaptation of result.adaptations) {
    assert.equal(scientistOutput.filter((pressure) => pressure.factor === adaptation.environmentalPressure).length, 1);
  }
  const evolution = requests[1];
  assert.match(evolution.systemInstructions!, /You are the Evolution Agent/);
  assert.doesNotMatch(evolution.systemInstructions!, /You are the Planet Scientist/);
  assert.deepEqual(evolution.tools, []);
  assert.deepEqual(evolution.handoffs, []);
  assert.equal(evolution.previousResponseId, undefined);
  assert.equal(evolution.conversationId, undefined);
  assert.equal(evolution.tracing, false);
  assert.equal(evolution.modelSettings.store, false);
  assert.ok(evolution.signal);
  assert.equal(JSON.stringify(evolution.input).includes("test-only-not-a-real-key"), false);
  // The schema sent to the SDK is restricted to the supplied factors, not free text.
  const schema = evolution.outputType as unknown as { schema: { properties: { adaptations: {
    items: { properties: { environmentalPressure: { enum: string[] } } };
  } } } };
  assert.deepEqual(schema.schema.properties.adaptations.items.properties.environmentalPressure.enum,
    pressures.map((pressure) => pressure.factor));
});

test("Evolution can run alone with a saved pressure array and its own model setting", async () => {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  process.env.OPENAI_EVOLUTION_MODEL = "test-evolution-model";
  const provider = mock.method(OpenAIProvider.prototype, "getModel", async (name: string) => {
    assert.equal(name, "test-evolution-model");
    return fakeModel(() => candidate());
  });
  await runEvolutionAgent(planet, environment, pressures);
  assert.equal(provider.mock.callCount(), 1);
});

test("only selected inputs are sent, retaining evidence and every environment assumption", () => {
  const input = JSON.parse(evolutionInput(
    { ...planet, unrelated: "do not send" } as typeof planet,
    { ...environment, credentials: "do not send" } as typeof environment,
    pressures.map((pressure) => ({ ...pressure, otherAgentHistory: "do not send" })),
  ));
  assert.deepEqual(input, { planet, environment, pressures });
  const sparse = { name: "Unknown world" };
  const assumedEnvironment = deriveEnvironment(sparse);
  const sparseInput = JSON.parse(evolutionInput(sparse, assumedEnvironment, pressures));
  assert.deepEqual(sparseInput.planet, sparse);
  assert.deepEqual(sparseInput.environment.assumptions, assumedEnvironment.assumptions);
});

test("schema rejects new, paraphrased, multiple or absent adaptation references", () => {
  for (const reference of ["oxygen", "strong gravity", "gravity, temperature", ""]) {
    const invalid = candidate();
    invalid.adaptations[0].environmentalPressure = reference;
    assert.throws(() => parseEvolutionOutput(invalid, pressures));
  }
  const missing = candidate();
  Reflect.deleteProperty(missing.adaptations[0], "environmentalPressure");
  assert.throws(() => parseEvolutionOutput(missing, pressures));
  const differentRun = pressures.map((pressure) => pressure.factor === "gravity"
    ? { ...pressure, factor: "illumination" } : pressure);
  assert.equal(evolutionOutputSchema(differentRun).safeParse(candidate()).success, false);
});

test("rejects incomplete candidates, blank descriptions and fields outside CandidateOrganism", () => {
  assert.throws(() => parseEvolutionOutput(undefined, pressures));
  assert.throws(() => parseEvolutionOutput({ ...candidate(), adaptations: [] }, pressures));
  assert.throws(() => parseEvolutionOutput({ ...candidate(), survivalStrategy: "  " }, pressures));
  const missing = candidate();
  Reflect.deleteProperty(missing.morphology, "sensorySystems");
  assert.throws(() => parseEvolutionOutput(missing, pressures));
  assert.throws(() => parseEvolutionOutput({ ...candidate(), newPlanetaryCondition: "oxygen atmosphere" }, pressures));
});

test("invalid and ambiguous pressure inputs fail before calling the provider", async () => {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  const provider = mock.method(OpenAIProvider.prototype, "getModel", () => {
    throw new Error("Should not reach the provider.");
  });
  const invalidInputs: unknown[] = [
    [], pressures.slice(0, 2), Array(7).fill(pressures[0]), Array(3).fill(pressures[0]),
    pressures.map((pressure) => ({ ...pressure, evidence: "Unqualified claim" })),
    pressures.map((pressure) => ({ ...pressure, evidence: "Assumed: test", knownValue: "1 g" })),
  ];
  for (const invalid of invalidInputs) {
    await assert.rejects(runEvolutionAgent(planet, environment, invalid as EnvironmentalPressure[]));
  }
  await assert.rejects(runEvolutionAgent({ ...planet, massEarth: NaN }, environment, pressures));
  assert.equal(provider.mock.callCount(), 0);
});

test("missing credentials give a clear server-side error", async () => {
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(runEvolutionAgent(planet, environment, pressures), /Set OPENAI_API_KEY/);
});

test("provider failures are sanitized and invalid model references produce no partial candidate", async () => {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  const provider = mock.method(OpenAIProvider.prototype, "getModel", async () => {
    throw new Error("Request details containing test-only-not-a-real-key");
  });
  await assert.rejects(runEvolutionAgent(planet, environment, pressures), (error: Error) => {
    assert.equal(error.message, "Evolution Agent could not return a valid candidate organism. Please retry.");
    assert.equal(error.cause, undefined);
    return true;
  });
  provider.mock.mockImplementation(async () => fakeModel(() => {
    const result = candidate();
    result.adaptations[0].environmentalPressure = "oxygen";
    return result;
  }));
  await assert.rejects(runEvolutionAgent(planet, environment, pressures), /could not return a valid candidate/);
});
