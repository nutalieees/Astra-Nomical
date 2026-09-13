import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { OpenAIProvider, Usage, type Model } from "@openai/agents";
import { compileFictionalWorld, createWorld, createWorldRequestSchema } from "../src/lib/ai/world-creation";
import { POST } from "../src/app/api/create-world/route";

const request = { brief: "A cold rocky world", hostStar: "red-dwarf", worldType: "rocky", equilibriumTemperatureK: 230, generateSpecies: false };
const design = { name: "Aster", summary: "A fictional rocky landscape.", radiusEarth: 1, massEarth: 1, assumptions: ["A thin atmosphere is assumed; no life is established."] };
const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => { mock.restoreAll(); if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
function responses(values: unknown[]) {
  let calls = 0;
  const model: Model = {
    async getResponse(input) {
      assert.equal(input.tracing, false);
      assert.equal(input.modelSettings.store, false);
      assert.equal(JSON.stringify(input.input).includes("fake-test-key"), false);
      if (calls >= values.length) throw new Error("Unexpected extra agent run");
      return { usage: new Usage(), output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(values[calls++]) }] }] };
    },
    async *getStreamedResponse() { throw new Error("Not used"); },
  };
  mock.method(OpenAIProvider.prototype, "getModel", async () => model);
  process.env.OPENAI_API_KEY = "fake-test-key";
  return () => calls;
}

test("fictional world is deterministic, finite and uses code-derived orbital physics", () => {
  const result = compileFictionalWorld(request, design);
  assert.deepEqual(result, compileFictionalWorld(request, design));
  assert.equal(result.kind, "fictional");
  assert.equal(result.environment.gravityEarth, 1);
  assert.equal(result.provenance.massEarth, "assumed");
  assert.equal(result.provenance.orbitalDistanceAU, "derived");
  assert.equal(result.planet.distanceLightYears, undefined);
  assert.equal(result.sky.mode, "illustrative");
  const p = result.planet;
  const t = p.starTemperatureK! * Math.sqrt(p.starRadiusSolar! * .00465047 / (2 * p.orbitalDistanceAU!)) * Math.pow(.7, .25);
  assert.ok(Math.abs(t - 230) < 1e-8);
  for (const object of [p, result.environment, result.visualEnvironment]) for (const value of Object.values(object)) if (typeof value === "number") assert.ok(Number.isFinite(value));
});
test("rejects extra physics, invalid density, incompatible preferences and real-world impersonation", () => {
  assert.throws(() => createWorldRequestSchema.parse({ ...request, gravityEarth: 999 }));
  assert.throws(() => compileFictionalWorld(request, { ...design, massEarth: 1400 }));
  assert.throws(() => compileFictionalWorld({ ...request, worldType: "icy", equilibriumTemperatureK: 1000 }, design));
  assert.throws(() => compileFictionalWorld({ ...request, worldType: "volcanic" }, design));
  assert.equal(compileFictionalWorld(request, { ...design, name: "TRAPPIST-1 e" }).planet.name, "Fictional: TRAPPIST-1 e");
});
test("gas giants use cloud renderer and icy scenarios retain assumptions", () => {
  const giant = compileFictionalWorld({ ...request, worldType: "gas-giant" }, { ...design, radiusEarth: 10, massEarth: 300 });
  assert.equal(giant.visualEnvironment.surfacePreset, "gas-giant");
  const icy = compileFictionalWorld({ ...request, worldType: "icy" }, design);
  assert.equal(icy.visualEnvironment.landscape, "glacial");
  assert.ok(icy.visualEnvironment.assumptions.some(x => x.includes("requested fictional scenery")));
});
test("real SDK runs designer then reviewer, with optional species disabled", async () => {
  const calls = responses([design, { approved: true, issues: [] }]);
  const result = await createWorld(request);
  assert.equal(calls(), 2);
  assert.equal(result.species, null);
  assert.equal(result.world.kind, "fictional");
});
test("one bounded revision after rejected review", async () => {
  const calls = responses([design, { approved: false, issues: ["Clarify fictional status"] }, design, { approved: true, issues: [] }]);
  await createWorld(request);
  assert.equal(calls(), 4);
});
test("does not loop when both proposals fail", async () => {
  const calls = responses([{ ...design, massEarth: 1400 }, { ...design, massEarth: 1400 }]);
  await assert.rejects(createWorld(request), /one revision/);
  assert.equal(calls(), 2);
});
test("route validates requests and reports missing configuration", async () => {
  delete process.env.OPENAI_API_KEY;
  assert.equal((await POST(new Request("http://localhost/api/create-world", { method: "POST", body: "{}" }))).status, 400);
  assert.equal((await POST(new Request("http://localhost/api/create-world", { method: "POST", body: JSON.stringify(request) }))).status, 503);
});
test("route sanitizes provider errors", async () => {
  responses([]);
  const response = await POST(new Request("http://localhost/api/create-world", { method: "POST", body: JSON.stringify(request) }));
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes("fake-test-key"), false);
});
