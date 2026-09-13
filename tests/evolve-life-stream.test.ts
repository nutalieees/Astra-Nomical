import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { OpenAIProvider, Usage, type Model, type ModelRequest, type ModelResponse } from "@openai/agents";
import { Images } from "openai/resources/images";
import { POST } from "../src/app/api/evolve-life/route";
import { readOrganismImageToken } from "../src/lib/ai/organism-image-ticket";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveEnvironment } from "../src/lib/astronomy/environment";
import { evolveLifeEventSchema, readEvolveLifeStream, type EvolveLifeEvent } from "../src/lib/evolve-life/stream";
import pressures from "./fixtures/trappist-1e-scientist.json";
import candidate from "./fixtures/trappist-1e-candidate.json";

const originalKey = process.env.OPENAI_API_KEY;
beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  mock.method(console, "error", () => {});
});
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});

function installModel(reply: (request: ModelRequest, index: number) => Promise<ModelResponse> | ModelResponse) {
  const requests: ModelRequest[] = [];
  const model: Model = {
    async getResponse(request) { requests.push(request); return reply(request, requests.length - 1); },
    async *getStreamedResponse() { throw new Error("Raw SDK streams must stay private."); },
  };
  mock.method(OpenAIProvider.prototype, "getModel", async () => model);
  return requests;
}
function fixture(request: ModelRequest): ModelResponse {
  const instructions = request.systemInstructions ?? "";
  // Other agents may mention the reviewer; route by the declared role, not that mention.
  const output = instructions.startsWith("You are the Planet Scientist")
    ? { pressures: pressures.map((pressure) => ({ ...pressure, knownValue: pressure.knownValue ?? null })) }
    : instructions.startsWith("You are the Scientific Critic")
      ? { reviews: ["organism", ...candidate.adaptations.map((_, index) => `adaptations[${index}]`)]
        .map((target) => ({ target, assessment: "Internal fixture assessment. Never send to the browser.", issues: [] })) }
      : candidate;
  return { usage: new Usage(), output: [{ type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
}
function request(body: unknown = { planetName: "TRAPPIST-1 e" }, signal?: AbortSignal) {
  return new Request("http://localhost/api/evolve-life", { method: "POST", body: JSON.stringify(body), signal });
}
const organism = { ...candidate, uncertainty: ["Hypothetical fixture, not evidence of life."] };
const publicResult = { type: "result", result: { pressures, organism } };
function chunkedResponse(text: string, chunkSize = 7, onCancel?: () => void) {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
    cancel: onCancel,
  }), { headers: { "Content-Type": "application/x-ndjson" } });
}

test("route streams actual stage completions before the next model resolves, with only public fields", async () => {
  const imageCalls = mock.method(Images.prototype, "generate", () => { throw new Error("Images must not delay the textual workflow."); });
  const gates: (() => void)[] = [];
  const requests = installModel(async (request) => {
    await new Promise<void>((resolve) => { gates.push(resolve); });
    return fixture(request);
  });
  const response = await POST(request());
  assert.equal(response.headers.get("cache-control"), "no-store, no-transform");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: EvolveLifeEvent[] = [];
  const read = async () => {
    const chunk = await reader.read();
    assert.equal(chunk.done, false);
    const event = evolveLifeEventSchema.parse(JSON.parse(decoder.decode(chunk.value)));
    events.push(event);
    return event;
  };
  for (const [index, stage] of ["scientist", "evolution", "critic", "finalize"].entries()) {
    assert.deepEqual(await read(), { type: "progress", stage, status: "running" });
    // Give the real SDK runner time to reach this stage's pending provider call.
    while (!gates[index]) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests.length, index + 1);
    assert.equal(events.some((event) => event.type === "result"), false);
    gates[index]();
    assert.deepEqual(await read(), { type: "progress", stage, status: "complete" });
  }
  const result = await read();
  assert.equal(result.type, "result");
  if (result.type === "result") {
    assert.deepEqual(Object.keys(result.result).sort(), ["illustrationToken", "organism", "pressures"]);
    const context = readOrganismImageToken(result.result.illustrationToken!);
    const planet = FEATURED_PLANETS.find((value) => value.name === "TRAPPIST-1 e")!;
    assert.deepEqual(context, { planet, environment: deriveEnvironment(planet), organism: result.result.organism });
    const payload = JSON.parse(Buffer.from(result.result.illustrationToken!.split(".")[0], "base64url").toString());
    assert.deepEqual(Object.keys(payload).sort(), ["environment", "expiresAt", "organism", "planet"]);
    assert.equal(JSON.stringify(payload).includes("Internal fixture assessment"), false);
    assert.equal(JSON.stringify(payload).includes("test-only-not-a-real-key"), false);
  }
  assert.equal(imageCalls.mock.callCount(), 0);
  assert.equal(JSON.stringify(events).includes("Internal fixture assessment"), false);
  assert.equal(JSON.stringify(events).includes("test-only-not-a-real-key"), false);
  assert.equal((await reader.read()).done, true);
  reader.releaseLock();
});

test("route rejects unknown worlds, oversized bodies, and client environment overrides before model execution", async () => {
  const requests = installModel(() => { throw new Error("Must not run."); });
  for (const body of [{ planetName: "Unknown" }, { planetName: "TRAPPIST-1 e", environment: { gravityEarth: 99 } },
    { planetName: "x".repeat(1100) }, null]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal(requests.length, 0);
});

test("an optional illustration ticket failure still delivers the complete textual result", async () => {
  installModel((request, index) => {
    // Simulate signing becoming unavailable after the final reviewer already ran.
    if (index === 3) delete process.env.OPENAI_API_KEY;
    return fixture(request);
  });
  const events: EvolveLifeEvent[] = [];
  await readEvolveLifeStream(await POST(request()), (event) => events.push(event));
  const result = events.at(-1)!;
  assert.equal(result.type, "result");
  if (result.type === "result") {
    assert.deepEqual(Object.keys(result.result).sort(), ["organism", "pressures"]);
    assert.deepEqual(result.result.organism.morphology, candidate.morphology);
  }
  assert.equal(events.some((event) => event.type === "error"), false);
});

test("a provider failure is safe and retrying the endpoint starts a fresh successful workflow", async () => {
  installModel((request, index) => {
    if (index === 0) throw new Error("PRIVATE PROVIDER ERROR test-only-not-a-real-key");
    return fixture(request);
  });
  const first: EvolveLifeEvent[] = [];
  await readEvolveLifeStream(await POST(request()), (event) => first.push(event));
  const last = first.at(-1)!;
  assert.equal(last.type, "error");
  if (last.type === "error") assert.equal(last.error.retryable, true);
  assert.equal(JSON.stringify(first).includes("PRIVATE"), false);
  assert.equal(JSON.stringify(first).includes("test-only-not-a-real-key"), false);
  const retry: EvolveLifeEvent[] = [];
  await readEvolveLifeStream(await POST(request()), (event) => retry.push(event));
  assert.deepEqual(retry[0], { type: "progress", stage: "scientist", status: "running" });
  assert.equal(retry.at(-1)?.type, "result");
});

test("missing server configuration streams a controlled error", async () => {
  delete process.env.OPENAI_API_KEY;
  const events: EvolveLifeEvent[] = [];
  await readEvolveLifeStream(await POST(request()), (event) => events.push(event));
  assert.equal(events.length, 1);
  const event = events[0];
  assert.equal(event.type, "error");
  if (event.type === "error") assert.equal(event.error.code, "NOT_CONFIGURED");
});

test("browser stream cancellation aborts the running SDK call and starts no later stage", async () => {
  const requests = installModel(() => new Promise<ModelResponse>(() => {}));
  const response = await POST(request());
  const reader = response.body!.getReader();
  await reader.read();
  while (!requests.length) await new Promise((resolve) => setImmediate(resolve));
  await reader.cancel();
  assert.equal(requests[0].signal?.aborted, true);
  assert.equal(requests.length, 1);
});

test("client decoder handles split UTF-8, heartbeat, multiple events and a final line without newline", async () => {
  const unicode = { ...publicResult, result: { ...publicResult.result, organism: { ...organism, name: "Microfilm — δ" } } };
  const events: EvolveLifeEvent[] = [];
  const content = JSON.stringify({ type: "progress", stage: "scientist", status: "running" }) + "\n"
    + JSON.stringify({ type: "heartbeat" }) + "\n" + JSON.stringify(unicode);
  await readEvolveLifeStream(chunkedResponse(content, 1), (event) => events.push(event));
  assert.equal(events.length, 2);
  assert.deepEqual(events[1], unicode);
});

test("client decoder rejects interrupted or malformed streams and closes the reader", async () => {
  for (const content of ["", '{"type":"heartbeat"}\n', "not JSON\n", "x".repeat(1_000_001)]) {
    await assert.rejects(() => readEvolveLifeStream(chunkedResponse(content, 1_000_002), () => {}));
  }
  let cancelled = false;
  await assert.rejects(() => readEvolveLifeStream(chunkedResponse("bad\n" + "x".repeat(100), 4, () => { cancelled = true; }), () => {}));
  assert.equal(cancelled, true);
  await assert.rejects(() => readEvolveLifeStream(new Response("unavailable", { status: 503 }), () => {}));
});

test("transport rejects private model fields and adaptation links to invented pressures", () => {
  assert.equal(evolveLifeEventSchema.safeParse(publicResult).success, true);
  assert.equal(evolveLifeEventSchema.safeParse({ type: "progress", stage: "critic", status: "running", reasoning: "private" }).success, false);
  assert.equal(evolveLifeEventSchema.safeParse({ ...publicResult, result: { ...publicResult.result, critique: { reviews: [] } } }).success, false);
  assert.equal(evolveLifeEventSchema.safeParse({ ...publicResult, result: { ...publicResult.result,
    organism: { ...organism, adaptations: [{ ...candidate.adaptations[0], environmentalPressure: "invented atmosphere" }] } } }).success, false);
});
