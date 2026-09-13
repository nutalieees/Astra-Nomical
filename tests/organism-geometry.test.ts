import assert from "node:assert/strict";
import test from "node:test";
import { createOrganismGeometry, getOrganismPlacement, organismDimensions } from "../src/components/scene/organism-geometry";
import { deriveEnvironment } from "../src/lib/astronomy/environment";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveVisualEnvironment } from "../src/lib/astronomy/visual-environment";
import type { OrganismSceneSpec } from "../src/lib/evolve-life/organism-scene";

const forms: OrganismSceneSpec["form"][] = ["cushion", "segmented", "radial", "sheet", "cell"];
function specimen(form: OrganismSceneSpec["form"], proportions = { length: 1.8, width: 1.2, height: 0.4 }): OrganismSceneSpec {
  return { organization: form === "cell" ? "unicellular" : "multicellular", form, proportions,
    surface: "soft", segments: 7, appendages: { kind: "none", count: 0 }, senses: "diffuse",
    motion: "sessile", activity: "dormant", scale: "microscopic",
    grounding: (["organization", "form", "proportions", "surface", "appendages", "senses", "motion"] as const)
      .map((feature) => ({ feature, quote: "A hypothetical resting tissue specimen." })) };
}

test("all organism forms produce deterministic finite surfaces with nondegenerate triangles", () => {
  for (const form of forms) {
    const first = createOrganismGeometry(specimen(form), 42);
    const repeated = createOrganismGeometry(specimen(form), 42);
    try {
      for (const attribute of ["position", "normal", "uv"]) {
        const values = first.getAttribute(attribute).array;
        assert.ok(values.length > 0, `${form}: ${attribute} is populated`);
        assert.ok(Array.from(values).every(Number.isFinite), `${form}: ${attribute} remains finite`);
        assert.deepEqual(values, repeated.getAttribute(attribute).array, `${form}: ${attribute} is repeatable`);
      }
      const positions = first.getAttribute("position");
      const index = first.getIndex()!;
      assert.ok(index.count > 0 && index.count % 3 === 0);
      for (let triangle = 0; triangle < index.count; triangle += 3) {
        const [a, b, c] = [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)];
        assert.ok(a < positions.count && b < positions.count && c < positions.count);
        const ab = [positions.getX(b) - positions.getX(a), positions.getY(b) - positions.getY(a), positions.getZ(b) - positions.getZ(a)];
        const ac = [positions.getX(c) - positions.getX(a), positions.getY(c) - positions.getY(a), positions.getZ(c) - positions.getZ(a)];
        const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
        assert.ok(Math.hypot(...cross) > 1e-12, `${form}: triangle ${triangle / 3} has surface area`);
      }
    } finally { first.dispose(); repeated.dispose(); }
  }
});

test("extreme valid proportions stay visible and bounded in concept display units", () => {
  const extremes = [
    { length: 0.3, width: 0.3, height: 0.12 }, { length: 4, width: 4, height: 3 },
    { length: 0.3, width: 4, height: 3 }, { length: 4, width: 0.3, height: 0.12 },
  ];
  for (const form of forms) for (const proportions of extremes) {
    const spec = specimen(form, proportions);
    const dimensions = organismDimensions(spec);
    const geometry = createOrganismGeometry(spec, 137);
    try {
      assert.equal(Math.max(dimensions.x, dimensions.z), 1);
      assert.ok(dimensions.y >= 0.065 && dimensions.y <= 0.85);
      const box = geometry.boundingBox!;
      const extents = { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z };
      for (const axis of ["x", "z"] as const) {
        assert.ok(extents[axis] >= 1.45 * dimensions[axis], `${form}: ${axis} does not collapse`);
        assert.ok(extents[axis] <= 2.4 * dimensions[axis], `${form}: ${axis} stays within the specimen footprint`);
      }
      assert.ok(box.min.y >= 0, `${form}: underside does not pass below its placement`);
      assert.ok(extents.y >= 0.9 * dimensions.y && box.max.y <= 1.7 * dimensions.y);
      assert.ok(Number.isFinite(geometry.boundingSphere!.radius) && geometry.boundingSphere!.radius > 0);
    } finally { geometry.dispose(); }
  }
});

test("rocky-world placement clears the highest terrain sample across its footprint", () => {
  const planet = FEATURED_PLANETS.find((entry) => entry.name === "TRAPPIST-1 e")!;
  const visual = deriveVisualEnvironment(planet, deriveEnvironment(planet));
  const samples: [number, number, number][] = [];
  const placement = getOrganismPlacement(visual, (x, z) => {
    const height = 0.2 * x + 0.1 * z + ((x > 1 && z > 6) ? 3 : 0);
    samples.push([x, z, height]);
    return height;
  });
  assert.equal(samples.length, 49);
  const peak = Math.max(...samples.map((entry) => entry[2]));
  assert.ok(Math.abs(placement.position[1] - peak - 0.035) < 1e-10);
  assert.ok(samples.every(([, , height]) => placement.position[1] > height));
  assert.equal(placement.target[0], placement.position[0]);
  assert.equal(placement.target[2], placement.position[2]);
  assert.ok(placement.target[1] > placement.position[1]);
  assert.equal(placement.displayScale, 2.1);
});

test("a gas-giant specimen is a camera-height concept display independent of a ground plane", () => {
  const planet = FEATURED_PLANETS.find((entry) => entry.name === "WASP-121 b")!;
  const visual = deriveVisualEnvironment(planet, deriveEnvironment(planet));
  assert.equal(visual.surfacePreset, "gas-giant");
  const high = getOrganismPlacement(visual, () => 1e8);
  const low = getOrganismPlacement(visual, () => -1e8);
  assert.deepEqual(high, low);
  assert.equal(high.position[1], visual.cameraHeight - 1);
  assert.equal(high.target[1], high.position[1] + 0.65);
});
