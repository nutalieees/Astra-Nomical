import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { OpenAIProvider, Usage, type Model } from "@openai/agents";
import { resolveCatalogueWorld, searchCatalogue } from "../src/lib/astronomy/catalogue-server";
import { preparePlanetWorld } from "../src/lib/astronomy/prepared-world";
import { BUFFER_PLANETS } from "../src/lib/astronomy/planets-buffer";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { POST as prepare } from "../src/app/api/prepare-world/route";
import { POST as evolve } from "../src/app/api/evolve-life/route";
import { readOrganismImageToken } from "../src/lib/ai/organism-image-ticket";
import { createWorld } from "../src/lib/ai/world-creation";
import pressures from "./fixtures/trappist-1e-scientist.json";
import candidate from "./fixtures/trappist-1e-candidate.json";

const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => { mock.restoreAll(); if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
const request = (body: unknown) => new Request("http://localhost/api/test", { method: "POST", body: JSON.stringify(body) });

test("TRAPPIST-1 f resolves unchanged, deterministic and without a borrowed sky", () => {
  const source = BUFFER_PLANETS.find(p => p.name === "TRAPPIST-1 f")!;
  const before = structuredClone(source);
  const world = resolveCatalogueWorld("  trappist-1   f ");
  assert.deepEqual(world.planet, source);
  assert.deepEqual(world, resolveCatalogueWorld(source.name));
  assert.deepEqual(source, before);
  assert.equal(world.sky.mode, "illustrative");
  assert.equal(world.review.approved, true);
  assert.equal(world.environment.gravityEarth, .951);
  assert.equal(world.provenance.massEarth, undefined); // unknown qualifier, not invented measurement status
  for (const planet of FEATURED_PLANETS) assert.equal(resolveCatalogueWorld(planet.name).sky.mode, "catalogue");
  assert.ok(searchCatalogue("TRAPPIST-1 f").some(p => p.name === source.name));
});

test("missing inputs remain absent, while parameters are finite and giants have no solid surface", () => {
  const missing = preparePlanetWorld({ name: "Missing-data test" });
  assert.equal(missing.planet.massEarth, undefined);
  assert.ok(missing.missingFields.includes("massEarth"));
  assert.ok(missing.environment.assumptions.some(s => s.includes("default")));
  assert.equal(preparePlanetWorld({ name: "Giant fixture", radiusEarth: 12 }).visualEnvironment.surfacePreset, "gas-giant");
  assert.notDeepEqual(resolveCatalogueWorld("TRAPPIST-1 f").visualEnvironment, resolveCatalogueWorld("55 Cancri e").visualEnvironment);
});

test("preparation needs no API key and rejects unknown IDs or client overrides", async () => {
  delete process.env.OPENAI_API_KEY;
  assert.equal((await prepare(request({ planetName: "TRAPPIST-1 f" }))).status, 200);
  for (const body of [{ planetName: "Unknown" }, { planetName: "TRAPPIST-1 f", massEarth: 999 }]) {
    assert.equal((await prepare(request(body))).status, 400);
    assert.equal((await evolve(request(body))).status, 400);
  }
});

test("additional planet reaches species stage with trusted context and signed inspection ticket", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  let calls = 0;
  const model: Model = {
    async getResponse(input) {
      calls++;
      const instructions = input.systemInstructions ?? "";
      if (instructions.startsWith("You are the Planet Scientist")) {
        const serialized = JSON.stringify(input.input);
        assert.ok(serialized.includes("TRAPPIST-1 f"));
        assert.ok(serialized.includes("0.951"));
        assert.ok(serialized.includes("unknown measurement status"));
      }
      const output = instructions.startsWith("You are the Planet Scientist")
        ? { pressures: pressures.map(p => ({ ...p, knownValue: p.knownValue ?? null })) }
        : instructions.startsWith("You are the Scientific Critic")
          ? { reviews: ["organism", ...candidate.adaptations.map((_, i) => `adaptations[${i}]`)].map(target => ({ target, assessment: "Fixture only", issues: [] })) }
          : candidate;
      return { usage: new Usage(), output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
    }, async *getStreamedResponse() { throw new Error("Unused"); },
  };
  mock.method(OpenAIProvider.prototype, "getModel", async () => model);
  const response = await evolve(request({ planetName: "TRAPPIST-1 f" }));
  const events = (await response.text()).trim().split("\n").map(s => JSON.parse(s));
  const result = events.find(e => e.type === "result");
  assert.ok(result); assert.ok(calls >= 4);
  const context = readOrganismImageToken(result.result.illustrationToken);
  assert.deepEqual(context.planet, resolveCatalogueWorld("TRAPPIST-1 f").planet);
  assert.throws(() => readOrganismImageToken(result.result.illustrationToken + "x"));
});

test("fictional review excludes species control; downstream species failure preserves approved world", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  mock.method(console, "error", () => {});
  let calls = 0;
  const model: Model = {
    async getResponse(input) {
      calls++;
      if (calls > 2) throw new Error("Species fixture failure");
      assert.equal(JSON.stringify(input.input).includes("generateSpecies"), false);
      if (calls === 2) assert.ok(input.systemInstructions?.includes("An absent organism is expected"));
      const output = calls === 1 ? { name: "Fixture", summary: "Fictional world", massEarth: 1, radiusEarth: 1, assumptions: ["Species are deferred to the next stage."] } : { approved: true, issues: [] };
      return { usage: new Usage(), output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
    }, async *getStreamedResponse() { throw new Error("Unused"); },
  };
  mock.method(OpenAIProvider.prototype, "getModel", async () => model);
  const result = await createWorld({ brief: "Fixture", hostStar: "red-dwarf", worldType: "rocky", equilibriumTemperatureK: 230, generateSpecies: true });
  assert.equal(result.review.approved, true);
  assert.ok(result.species && "error" in result.species);
  assert.ok(calls >= 3);
});
