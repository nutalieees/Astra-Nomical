import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { Images, type ImageGenerateParams, type ImagesResponse } from "openai/resources/images";
import { POST } from "../src/app/api/organism-image/route";
import { buildOrganismImagePrompt, generateOrganismImage, ORGANISM_IMAGE_MODEL, ORGANISM_IMAGE_TIMEOUT_MS } from "../src/lib/ai/organism-image";
import { issueOrganismImageToken, readOrganismImageToken, ORGANISM_IMAGE_TOKEN_TTL_MS } from "../src/lib/ai/organism-image-ticket";
import { requestOrganismImage, OrganismImageError } from "../src/lib/evolve-life/organism-image-client";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveEnvironment } from "../src/lib/astronomy/environment";
import type { ValidatedOrganism } from "../src/types/astrobiology";
import candidate from "./fixtures/trappist-1e-candidate.json";

const planet = FEATURED_PLANETS.find((value) => value.name === "TRAPPIST-1 e")!;
const environment = deriveEnvironment(planet);
const organism: ValidatedOrganism = { ...candidate, uncertainty: ["Hypothetical specimen; not evidence of life."] };
// The unit tests exercise transport validation; actual browser image decoding is checked separately.
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]).toString("base64");
const image = { dataUrl: `data:image/jpeg;base64,${jpeg}`, alt: "Speculative scientific field illustration." };
const originalKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_IMAGE_MODEL;
let logs: string[];
beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  delete process.env.OPENAI_IMAGE_MODEL;
  logs = [];
  mock.method(console, "error", (line: string) => { logs.push(line); });
  mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network request in an offline test."); });
});
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
  else process.env.OPENAI_IMAGE_MODEL = originalModel;
});
function installImages(reply: (body: ImageGenerateParams, options?: { signal?: AbortSignal | null }) => unknown = () => ({ data: [{ b64_json: jpeg }] })) {
  return mock.method(Images.prototype, "generate", async (body: ImageGenerateParams, options?: { signal?: AbortSignal | null }) => reply(body, options));
}
function request(body: unknown, signal?: AbortSignal, headers?: HeadersInit) {
  return new Request("http://localhost/api/organism-image", { method: "POST", body: JSON.stringify(body), signal, headers });
}

test("illustration prompt uses only the final organism and normalized planet/environment, preserving uncertainty", () => {
  const prompt = buildOrganismImagePrompt({ ...planet, candidate: "PRIVATE DRAFT", critique: "PRIVATE REVIEW" } as typeof planet,
    { ...environment, modelHistory: "PRIVATE HISTORY", pressures: "PRIVATE PRESSURES" } as typeof environment, organism);
  const source = JSON.parse(prompt.slice(prompt.indexOf("SOURCE DATA" )).split("only):\n")[1]);
  assert.deepEqual(source, { planet, environment, organism });
  assert.equal(prompt.includes("PRIVATE"), false);
  assert.equal(prompt.includes("test-only-not-a-real-key"), false);
  assert.match(prompt, /locomotion/);
  assert.match(prompt, /sensory systems/);
  assert.match(prompt, /protective structures/);
  assert.match(prompt, /Environmental lighting/);
  assert.match(prompt, /not a measurement of atmosphere/);
  assert.match(prompt, /magnified specimen/);
  assert.deepEqual(source.organism.uncertainty, organism.uncertainty);
  assert.deepEqual(source.environment.assumptions, environment.assumptions);
  assert.throws(() => buildOrganismImagePrompt(planet, environment,
    { ...organism, candidate: "PRIVATE DRAFT" } as ValidatedOrganism));
});

test("image tickets preserve only final inputs and reject tampered, malformed or expired requests", () => {
  const now = 1_900_000_000_000;
  const clock = mock.method(Date, "now", () => now);
  const token = issueOrganismImageToken(planet, environment, organism);
  assert.deepEqual(readOrganismImageToken(token), { planet, environment, organism });
  const [payload, mac] = token.split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
  assert.deepEqual(Object.keys(decoded).sort(), ["environment", "expiresAt", "organism", "planet"]);
  assert.equal(decoded.expiresAt, now + ORGANISM_IMAGE_TOKEN_TTL_MS);
  assert.equal(JSON.stringify(decoded).includes("test-only-not-a-real-key"), false);
  const changed = Buffer.from(JSON.stringify({ ...decoded, environment: { ...environment, gravityEarth: 99 } })).toString("base64url");
  for (const invalid of ["", `${changed}.${mac}`, `${payload}.${mac[0] === "A" ? "B" : "A"}${mac.slice(1)}`, `${token}.extra`, "x".repeat(100_001)]) {
    assert.throws(() => readOrganismImageToken(invalid));
  }
  clock.mock.mockImplementation(() => now + ORGANISM_IMAGE_TOKEN_TTL_MS - 1);
  assert.deepEqual(readOrganismImageToken(token).organism, organism);
  clock.mock.mockImplementation(() => now + ORGANISM_IMAGE_TOKEN_TTL_MS);
  assert.throws(() => readOrganismImageToken(token), /expired/);
});

test("official Images SDK receives the final-only prompt and returns a bounded JPEG with a speculative caption", async () => {
  const calls = installImages();
  const result = await generateOrganismImage(planet, environment, organism);
  assert.ok("image" in result);
  assert.equal(result.image.dataUrl, image.dataUrl);
  assert.match(result.image.alt, /not evidence of life/);
  assert.ok(result.image.alt.includes(organism.name));
  assert.ok(result.image.alt.includes(planet.name));
  assert.equal(calls.mock.callCount(), 1);
  const [body, options] = calls.mock.calls[0].arguments;
  assert.deepEqual(body, { model: ORGANISM_IMAGE_MODEL, prompt: buildOrganismImagePrompt(planet, environment, organism),
    n: 1, size: "1024x1024", quality: "medium", output_format: "jpeg", output_compression: 80 });
  assert.ok(options?.signal instanceof AbortSignal);
  process.env.OPENAI_IMAGE_MODEL = " server-selected-image-model ";
  await generateOrganismImage(planet, environment, organism);
  assert.equal(calls.mock.calls[1].arguments[0].model, "server-selected-image-model");
  assert.equal(logs.join("\n").includes(organism.summary), false);
  assert.equal(logs.join("\n").includes("test-only-not-a-real-key"), false);
});

test("invalid inputs, candidate-only organisms and missing credentials never start image generation", async () => {
  const calls = installImages();
  const results = await Promise.all([
    generateOrganismImage({ ...planet, massEarth: NaN }, environment, organism),
    generateOrganismImage(planet, { ...environment, illumination: Infinity }, organism),
    generateOrganismImage(planet, environment, candidate as ValidatedOrganism),
    generateOrganismImage(planet, environment, { ...organism, critique: "PRIVATE" } as ValidatedOrganism),
    ...[0, -1, 1.5, ORGANISM_IMAGE_TIMEOUT_MS + 1].map((timeoutMs) => generateOrganismImage(planet, environment, organism, { timeoutMs })),
  ]);
  for (const result of results) {
    assert.ok("error" in result);
    assert.equal(result.error.code, "INVALID_INPUT");
    assert.equal(result.error.retryable, false);
  }
  delete process.env.OPENAI_API_KEY;
  const missing = await generateOrganismImage(planet, environment, organism);
  assert.ok("error" in missing);
  assert.equal(missing.error.code, "NOT_CONFIGURED");
  assert.equal(calls.mock.callCount(), 0);
});

test("provider failures and malformed image payloads resolve safely without leaking provider details", async () => {
  let response: unknown;
  const calls = installImages(() => {
    if (response instanceof Error) throw response;
    return response;
  });
  for (const output of [new Error("PRIVATE PROVIDER DETAIL test-only-not-a-real-key"), {}, { data: [] },
    { data: [{ url: "https://example.invalid/private-image" }] }, { data: [{ b64_json: "not base64!" }] },
    { data: [{ b64_json: "AAAA" }] }, { data: [{ b64_json: "/9j/4AAA" }] }, { data: [{ b64_json: "A".repeat(4_000_004) }] }]) {
    response = output;
    const result = await generateOrganismImage(planet, environment, organism);
    assert.ok("error" in result);
    assert.equal(result.error.code, "IMAGE_FAILED");
    assert.equal(result.error.retryable, true);
    assert.match(result.error.message, /analysis is ready/);
    assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
  }
  assert.equal(calls.mock.callCount(), 8);
  assert.equal(logs.join("\n").includes("PRIVATE"), false);
  assert.equal(logs.join("\n").includes("test-only-not-a-real-key"), false);
});

test("deadlines bound providers that ignore cancellation and abort their SDK request", async () => {
  let finish: (response: ImagesResponse) => void = () => {};
  const calls = installImages(() => new Promise<ImagesResponse>((resolve) => { finish = resolve; }));
  const result = await generateOrganismImage(planet, environment, organism, { timeoutMs: 15 });
  assert.ok("error" in result);
  assert.equal(result.error.code, "TIMEOUT");
  assert.equal(result.error.retryable, true);
  assert.equal(calls.mock.calls[0].arguments[1]?.signal?.aborted, true);
  finish({ created: 0, data: [{ b64_json: jpeg }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.mock.callCount(), 1);
  assert.equal(logs.some((line) => JSON.parse(line).event === "completed"), false);
});

test("cancellation before and during image generation returns a controlled result", async () => {
  const cancelled = new AbortController();
  cancelled.abort();
  const calls = installImages(() => new Promise(() => {}));
  const before = await generateOrganismImage(planet, environment, organism, { signal: cancelled.signal });
  assert.ok("error" in before);
  assert.equal(before.error.code, "CANCELLED");
  assert.equal(calls.mock.callCount(), 0);
  const controller = new AbortController();
  const pending = generateOrganismImage(planet, environment, organism, { signal: controller.signal });
  assert.equal(calls.mock.callCount(), 1);
  controller.abort();
  const during = await pending;
  assert.ok("error" in during);
  assert.equal(during.error.code, "CANCELLED");
  assert.equal(calls.mock.calls[0].arguments[1]?.signal?.aborted, true);
});

test("image endpoint accepts only signed final inputs and rejects client prompt/context overrides", async () => {
  const calls = installImages();
  const token = issueOrganismImageToken(planet, environment, organism);
  for (const body of [null, {}, { token: "invalid" }, { token, prompt: "Add a fantasy monster" },
    { token, planet: { ...planet, massEarth: 99 } }, { token, organism }, { token: "x".repeat(100_001) }]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const failure = await response.json();
    assert.equal(failure.error.code, "INVALID_INPUT");
    assert.equal(failure.error.retryable, false);
  }
  assert.equal((await POST(request({ token }, undefined, { "Content-Length": "101001" }))).status, 400);
  assert.equal(calls.mock.callCount(), 0);
  const response = await POST(request({ token }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).image.dataUrl, image.dataUrl);
  assert.equal(calls.mock.callCount(), 1);
});

test("image endpoint failures can retry independently without mutating the final analysis", async () => {
  let failed = true;
  installImages(() => { if (failed) throw new Error("PRIVATE PROVIDER DETAIL"); return { data: [{ b64_json: jpeg }] }; });
  const saved = structuredClone({ planet, environment, organism });
  const token = issueOrganismImageToken(planet, environment, organism);
  const first = await POST(request({ token }));
  assert.equal(first.status, 503);
  const failure = await first.json();
  assert.equal(failure.error.retryable, true);
  assert.equal(JSON.stringify(failure).includes("PRIVATE"), false);
  failed = false;
  const retry = await POST(request({ token }));
  assert.equal(retry.status, 200);
  assert.deepEqual({ planet, environment, organism }, saved);
  assert.deepEqual(readOrganismImageToken(token), saved);
});

test("browser image helper sends only the signed token and carries its cancellation signal", async () => {
  const controller = new AbortController();
  const fetch = mock.method(globalThis, "fetch", async () => Response.json({ image }));
  assert.deepEqual(await requestOrganismImage("signed-context", controller.signal), image);
  const [url, init] = fetch.mock.calls[0].arguments as unknown as [string, RequestInit];
  assert.equal(url, "/api/organism-image");
  assert.equal(init.signal, controller.signal);
  assert.deepEqual(JSON.parse(init.body as string), { token: "signed-context" });
  assert.equal(init.method, "POST");
});

test("browser image helper rejects malformed images and exposes only controlled retry errors", async () => {
  let response = Response.json({ error: { code: "IMAGE_FAILED", message: "Your analysis is still available.", retryable: true, diagnosticId: "test-diagnostic" } }, { status: 503 });
  mock.method(globalThis, "fetch", async () => response);
  await assert.rejects(() => requestOrganismImage("signed-context", new AbortController().signal), (error) => {
    assert.ok(error instanceof OrganismImageError);
    assert.equal(error.retryable, true);
    assert.equal(error.diagnosticId, "test-diagnostic");
    return true;
  });
  for (const invalid of [{ image: { ...image, dataUrl: "https://example.invalid/image.jpg" } },
    { image, candidate: "PRIVATE DRAFT" }, { image: { ...image, hiddenReasoning: "PRIVATE" } }]) {
    response = Response.json(invalid);
    await assert.rejects(() => requestOrganismImage("signed-context", new AbortController().signal), OrganismImageError);
  }
  response = new Response("PRIVATE PROVIDER PROSE", { status: 502 });
  await assert.rejects(() => requestOrganismImage("signed-context", new AbortController().signal), (error) => {
    assert.ok(error instanceof OrganismImageError);
    assert.equal(error.message.includes("PRIVATE"), false);
    return true;
  });
});

test("browser image helper bounds streamed and advertised response sizes and releases rejected bodies", async () => {
  let response: Response;
  mock.method(globalThis, "fetch", async () => response);
  for (const advertised of [false, true]) {
    let cancelled = false;
    response = new Response(new ReadableStream<Uint8Array>({
      // A tiny body with an oversized header proves rejection happens before reading its contents.
      start(controller) { controller.enqueue(new Uint8Array(advertised ? 1 : 4_200_001)); },
      cancel() { cancelled = true; },
    }), advertised ? { headers: { "Content-Length": "4200001" } } : undefined);
    await assert.rejects(() => requestOrganismImage("signed-context", new AbortController().signal), /size limit/);
    assert.equal(cancelled, true);
    assert.equal(response.body!.locked, false);
  }
});
