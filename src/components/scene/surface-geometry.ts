import { BufferGeometry, Float32BufferAttribute } from "three";
import type { VisualEnvironment } from "../../types/visual-environment";

export function seedFromName(name: string) {
  let seed = 2166136261;
  for (const character of name) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return seed >>> 0;
}
export function randomSource(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function noise(x: number, z: number, seed: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let tx = x - ix, tz = z - iz;
  tx = tx * tx * (3 - 2 * tx); tz = tz * tz * (3 - 2 * tz);
  const hash = (a: number, b: number) => {
    let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  return (hash(ix, iz) * (1 - tx) + hash(ix + 1, iz) * tx) * (1 - tz)
    + (hash(ix, iz + 1) * (1 - tx) + hash(ix + 1, iz + 1) * tx) * tz;
}
export function relief(x: number, z: number, seed: number) {
  let result = 0, weight = 0.55;
  for (let octave = 0; octave < 5; octave++) {
    result += (noise(x, z, seed + octave * 113) * 2 - 1) * weight;
    x *= 2.13; z *= 2.13; weight *= 0.48;
  }
  return result;
}

/** A single continuous nonuniform patch: dense nearby, coarse past the horizon. */
export function createSurface(v: VisualEnvironment, seed: number, clouds = false) {
  const segments = clouds ? 120 : 240;
  const count = segments + 1;
  const coordinates = Array.from({ length: count }, (_, i) => {
    const t = i / segments * 2 - 1;
    // Cloud horizon is farther away because the observer floats above a giant.
    // This extent is beyond every bounded scenario's tangent horizon in all azimuths.
    return Math.sign(t) * t * t * (clouds ? 5000 : 850);
  });
  const positions = new Float32Array(count * count * 3);
  const random = randomSource(seed + 401);
  const craters = Array.from({ length: 18 }, () => {
    const angle = random() * Math.PI * 2, distance = 28 + random() * 260;
    return { x: Math.cos(angle) * distance, z: 12 + Math.sin(angle) * distance, radius: 12 + random() * 30 };
  });
  const indices: number[] = [];
  for (let zi = 0; zi < count; zi++) for (let xi = 0; xi < count; xi++) {
    const x = coordinates[xi], z = coordinates[zi];
    const distance = Math.hypot(x, z - 12);
    const ramp = Math.min(1, distance / 28);
    const f = v.terrainFrequency;
    const base = relief(x * f, z * f, seed);
    const hills = (v.landscape === "glacial" ? Math.abs(base) * 1.8 : base) * v.terrainAmplitude;
    const ridges = Math.exp(-Math.pow((distance - 85) / 33, 2)) *
      (0.3 + Math.abs(relief(x * 0.038, z * 0.02, seed + 18))) * v.terrainAmplitude * 2.6;
    const curvature = -(x * x + z * z) / (2 * v.horizonRadius);
    let geology = 0;
    if (v.landscape === "craters") {
      for (const crater of craters) {
        const d = Math.hypot(x - crater.x, z - crater.z) / crater.radius;
        geology += (Math.exp(-Math.pow((d - 1) / 0.16, 2)) * 0.16
          - Math.exp(-d * d * 2.8) * 0.22) * crater.radius;
      }
    } else if (v.landscape === "glacial") {
      geology = Math.pow(Math.abs(Math.sin(x * 0.035 + z * 0.018 + base)), 3) * v.terrainAmplitude * 1.5;
    } else if (v.landscape === "ridges") {
      geology = Math.pow(1 - Math.abs(base), 5) * v.terrainAmplitude * 0.8;
    }
    const y = clouds ? curvature + relief(x * 0.013, z * 0.023, seed) * v.cloudHeight
      : curvature + hills * (v.landscape === "craters" ? 0.22 : 0.12 + ramp * 0.88)
        + (v.landscape === "craters" ? 0 : ridges * ramp) + geology * ramp
        + relief(x * 0.35, z * 0.35, seed + 61) * 0.22;
    positions.set([x, y, z], (zi * count + xi) * 3);
    if (zi < segments && xi < segments) {
      const a = zi * count + xi, b = a + 1, c = a + count, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  // Sample the actual triangles (not just the procedural height function).
  const interval = (n: number) => {
    let lo = 0, hi = segments;
    while (hi - lo > 1) { const middle = (lo + hi) >> 1; if (coordinates[middle] <= n) lo = middle; else hi = middle; }
    return Math.min(segments - 1, lo);
  };
  const heightAt = (x: number, z: number) => {
    const xi = interval(x), zi = interval(z);
    const tx = (x - coordinates[xi]) / (coordinates[xi + 1] - coordinates[xi]);
    const tz = (z - coordinates[zi]) / (coordinates[zi + 1] - coordinates[zi]);
    const a = zi * count + xi;
    const h = (i: number) => positions[i * 3 + 1];
    return tx + tz <= 1 ? h(a) * (1 - tx - tz) + h(a + 1) * tx + h(a + count) * tz
      : h(a + count + 1) * (tx + tz - 1) + h(a + 1) * (1 - tz) + h(a + count) * (1 - tx);
  };
  return { geometry, heightAt };
}
