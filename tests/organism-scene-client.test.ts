import assert from "node:assert/strict";
import test from "node:test";
import { OrganismSceneError, requestOrganismScene } from "../src/lib/evolve-life/organism-scene-client";
import type { OrganismSceneSpec } from "../src/lib/evolve-life/organism-scene";

const specimen: OrganismSceneSpec = {
  organization: "colony", form: "cushion", proportions: { length: 1, width: 1, height: 0.4 },
  surface: "leathery", segments: 6, appendages: { kind: "none", count: 0 }, senses: "diffuse",
  motion: "sessile", activity: "dormant", scale: "microscopic",
  grounding: ["organization", "form", "proportions", "surface", "appendages", "senses", "motion"].map((feature) => ({
    feature: feature as OrganismSceneSpec["grounding"][number]["feature"], quote: "A compact, dormant colony with diffuse sensing.",
  })),
};

test("the 3D client sends only the signed token and accepts a structured specimen", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  try {
    globalThis.fetch = async (input, init) => {
      calls += 1;
      assert.equal(input, "/api/organism-scene");
      assert.equal(init?.method, "POST");
      assert.equal(init?.signal, controller.signal);
      assert.deepEqual(JSON.parse(String(init?.body)), { token: "signed-final-organism" });
      return Response.json({ scene: specimen });
    };
    assert.deepEqual(await requestOrganismScene("signed-final-organism", controller.signal), specimen);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("3D failures remain controlled and malformed or extra anatomy is rejected", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ error: { code: "SCENE_FAILED", message: "The model is unavailable. Your analysis is ready.", retryable: true, diagnosticId: "scene-test" } }, { status: 503 });
    await assert.rejects(requestOrganismScene("signed", new AbortController().signal), (error: unknown) => {
      assert.ok(error instanceof OrganismSceneError);
      assert.equal(error.retryable, true);
      assert.equal(error.diagnosticId, "scene-test");
      return true;
    });
    for (const scene of [{ ...specimen, proportions: { length: 1e10, width: 1, height: 1 } }, { ...specimen, arbitraryMeshCode: "execute" }]) {
      globalThis.fetch = async () => Response.json({ scene });
      await assert.rejects(requestOrganismScene("signed", new AbortController().signal), OrganismSceneError);
    }
  } finally { globalThis.fetch = original; }
});

test("oversized model responses are bounded and their streams are cancelled", async () => {
  const original = globalThis.fetch;
  try {
    for (const withHeader of [false, true]) {
      let cancelled = false;
      globalThis.fetch = async () => new Response(new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(96_001)); },
        cancel() { cancelled = true; },
      }), { headers: withHeader ? { "content-length": "96001" } : {} });
      await assert.rejects(requestOrganismScene("signed", new AbortController().signal), OrganismSceneError);
      assert.equal(cancelled, true);
    }
  } finally { globalThis.fetch = original; }
});
