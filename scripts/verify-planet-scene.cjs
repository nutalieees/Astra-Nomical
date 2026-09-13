// Run with Node 24+: node --experimental-strip-types scripts/verify-planet-scene.cjs
const { registerHooks } = require('node:module');
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.')) return next(specifier + '.ts', context); throw error; }
} });
const assert = require('node:assert/strict');
const { Mesh, MeshBasicMaterial, Raycaster, Vector3 } = require('three');
const { FEATURED_PLANETS } = require('../src/lib/astronomy/planets-featured.ts');
const { deriveEnvironment } = require('../src/lib/astronomy/environment.ts');
const { deriveVisualEnvironment } = require('../src/lib/astronomy/visual-environment.ts');
const { createSurface, seedFromName } = require('../src/components/scene/surface-geometry.ts');
const expected = { 'TRAPPIST-1 e': 'cold-rock', '55 Cancri e': 'lava-rock', 'WASP-121 b': 'gas-giant' };
for (const planet of FEATURED_PLANETS) {
  const environment = deriveEnvironment(planet);
  const visual = deriveVisualEnvironment(planet, environment);
  assert.deepEqual(visual, deriveVisualEnvironment(planet, environment));
  if (expected[planet.name]) assert.equal(visual.surfacePreset, expected[planet.name]);
  for (const value of Object.values(visual)) if (typeof value === 'number') assert(Number.isFinite(value));
  if (visual.surfacePreset === 'gas-giant') {
    assert.equal(visual.rockCount, 0);
    assert.equal(visual.emissiveIntensity, 0);
  } else {
    const surface = createSurface(visual, seedFromName(planet.name));
    const duplicate = createSurface(visual, seedFromName(planet.name));
    assert.deepEqual(surface.geometry.attributes.position.array, duplicate.geometry.attributes.position.array);
    const normals = surface.geometry.attributes.normal;
    for (let i = 0; i < normals.count; i++) {
      assert(normals.getY(i) > 0);
      assert(Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < 1e-5);
    }
    const mesh = new Mesh(surface.geometry, new MeshBasicMaterial());
    const ray = new Raycaster();
    // Both motion frequencies repeat after 20π; raycast the real triangles independently.
    for (let i = 0; i <= 128; i++) {
      const phase = i / 128 * 20 * Math.PI;
      const x = Math.sin(phase) * visual.cameraSway, z = 12 + Math.cos(phase * 0.7) * 0.25;
      const eye = surface.heightAt(x, z) + visual.cameraHeight;
      ray.set(new Vector3(x, eye, z), new Vector3(0, -1, 0));
      const hit = ray.intersectObject(mesh)[0];
      assert(hit && Math.abs(hit.distance - visual.cameraHeight) < 1e-4, 'Camera must clear actual geometry');
    }
    mesh.material.dispose(); surface.geometry.dispose(); duplicate.geometry.dispose();
  }
  // Look down toward all surrounding azimuths: every ray must meet real geometry.
  const atmospheric = visual.surfacePreset === 'gas-giant';
  const surround = createSurface(visual, seedFromName(planet.name), atmospheric);
  const surroundMesh = new Mesh(surround.geometry, new MeshBasicMaterial());
  if (atmospheric) surroundMesh.position.y = -26;
  surroundMesh.updateMatrixWorld(true);
  const eyeHeight = atmospheric ? visual.cameraHeight : surround.heightAt(0, 12.25) + visual.cameraHeight;
  const surroundRay = new Raycaster();
  for (let degrees = 0; degrees < 360; degrees += 15) for (const pitch of [5, 45, 85]) {
    const yaw = degrees * Math.PI / 180, down = pitch * Math.PI / 180;
    surroundRay.set(new Vector3(0, eyeHeight, 12.25),
      new Vector3(Math.sin(yaw) * Math.cos(down), -Math.sin(down), -Math.cos(yaw) * Math.cos(down)));
    const hit = surroundRay.intersectObject(surroundMesh)[0];
    assert(hit && hit.distance > 0.15 && hit.distance < 10000, `${planet.name}: missing surroundings at ${degrees}°/${pitch}°`);
  }
  surround.geometry.dispose(); surroundMesh.material.dispose();
  console.log(planet.name, JSON.stringify({ scenario: visual.surfacePreset, gravity: environment.gravityEarth,
    horizonRadius: visual.horizonRadius, starColor: visual.starColor, starRadiusDegrees: visual.starSize * 180 / Math.PI,
    light: visual.starIntensity }));
}
const base = deriveEnvironment({ name: 'Fallback' });
for (const radius of [undefined, NaN, Infinity, -1]) {
  const visual = deriveVisualEnvironment({ name: 'Fallback', radiusEarth: radius }, {
    ...base, gravityEarth: NaN, illumination: Infinity, apparentStarSize: NaN,
  });
  for (const value of Object.values(visual)) if (typeof value === 'number') assert(Number.isFinite(value));
}
assert.equal(deriveVisualEnvironment({ name: 'Rock', radiusEarth: 1 }, { ...base, temperatureCategory: 'temperate', gravityEarth: 0.8 }).surfacePreset, 'temperate-rock');
assert.equal(deriveVisualEnvironment({ name: 'Giant', radiusEarth: 12 }, { ...base, gravityEarth: 3 }).surfacePreset, 'gas-giant');
assert.equal(deriveVisualEnvironment({ name: 'Missing radius', category: 'gas-giant' }, base).surfacePreset, 'gas-giant');
console.log('PASS: deterministic mappings, finite fallbacks, classification, normals, camera-cycle clearance and 360° surrounding geometry.');
