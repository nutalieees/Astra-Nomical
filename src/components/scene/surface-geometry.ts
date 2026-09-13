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
    const a = Math.abs(t), inner = clouds ? 80 : 60, split = clouds ? 0.5 : 0.6;
    const radius = a <= split ? a / split * inner : inner + Math.pow((a - split) / (1 - split), 2) * ((clouds ? 5000 : 850) - inner);
    return Math.sign(t) * radius;
  });
  const positions = new Float32Array(count * count * 3);
  const random = randomSource(seed + 401);
  const craters = [{ x: 0, z: -25, radius: 23 }, ...Array.from({ length: 15 }, () => {
    const angle = random() * Math.PI * 2, distance = 48 + random() * 210;
    return { x: Math.cos(angle) * distance, z: 12 + Math.sin(angle) * distance, radius: 12 + random() * 26 };
  })];
  const indices: number[] = [];
  for (let zi = 0; zi < count; zi++) for (let xi = 0; xi < count; xi++) {
    const x = coordinates[xi], z = coordinates[zi];
    const distance = Math.hypot(x, z - 12);
    const ramp = Math.min(1, distance / 28);
    const f = v.terrainFrequency;
    const base = relief(x * f, z * f, seed);
    const hills = (v.landscape === "glacial" ? Math.abs(base) * 1.5 : base) * v.terrainAmplitude;
    const ridges = Math.exp(-Math.pow((distance - 85) / 33, 2)) *
      (0.3 + Math.abs(relief(x * 0.038, z * 0.02, seed + 18))) * v.terrainAmplitude * 2.6;
    const curvature = -(x * x + z * z) / (2 * v.horizonRadius);
    let geology = 0;
    if (v.landscape === "craters") {
      for (const crater of craters) {
        const d = Math.hypot(x - crater.x, z - crater.z) / crater.radius;
        geology += (Math.exp(-Math.pow((d - 1) / 0.24, 2)) * 0.06 - Math.exp(-d * d * 2.2) * 0.17) * crater.radius;
      }
    } else if (v.landscape === "glacial") {
      geology = Math.pow(Math.abs(Math.sin(x * 0.045 + z * 0.017 + base)), 4) * v.terrainAmplitude * 1.2;
    } else if (v.landscape === "ridges") {
      geology = Math.pow(1 - Math.abs(relief(x * .055, z * .018, seed + 7)), 5) * v.terrainAmplitude * .7;
    } else if (v.landscape === "volcanic") {
      const channelDistance = Math.min(...Array.from({length:v.lavaChannelCount},(_,channel) => Math.abs(x - moltenChannelX(z, channel))));
      geology = -Math.exp(-channelDistance * channelDistance / (v.lavaChannelWidth*v.lavaChannelWidth*4)) * 1.4;
    }
    const y = clouds ? curvature + relief(x * 0.008, z * 0.014, seed) * v.cloudHeight
      : curvature + hills * (v.landscape === "craters" ? 0.15 : 0.12 + ramp * 0.88)
        + (v.landscape === "craters" ? 0 : ridges * ramp) + geology * Math.min(1, distance / 8)
        + relief(x * 0.5, z * 0.5, seed + 61) * 0.12;
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

export function moltenChannelX(z: number, channel: number): number {
  if (channel === 5) return 5 + Math.sin(z*.035)*9;
  if (channel < 3) return [-28, 24, 74][channel] + Math.sin(z * .038 + channel * 2) * 11 + Math.sin(z * .13 + channel) * 2;
  // Two tributaries join and separate from the main rivers at deterministic intervals.
  const left=channel-3, blend=(1+Math.sin(z*.045+left*2))/2;
  return moltenChannelX(z,left)*(1-blend)+moltenChannelX(z,left+1)*blend;
}

export interface RockPlacement {
  x: number; y: number; z: number; sx: number; sy: number; sz: number; rotation: number; shade: number; radius: number;
}
/** Render transforms and conservative collision bounds share one deterministic source. */
export function createRocks(v: VisualEnvironment, seed: number, heightAt: (x: number, z: number) => number): RockPlacement[] {
  const random = randomSource(seed + 19);
  return Array.from({length: v.rockCount}, () => {
    const angle = random() * Math.PI * 2, distance = 10 + Math.pow(random(),1.35) * 110;
    const x = Math.cos(angle) * distance, z = 12 + Math.sin(angle) * distance;
    const scale = (.3 + Math.pow(random(), 2.6) * 2.9) * v.rockScale;
    const sx = scale * (.65 + random() * .65), sz = scale * (.65 + random() * .5);
    const sy = scale * (v.landscape === "glacial" ? 2.1 : v.landscape === "craters" ? .5 : .9 + random() * .5);
    const radius = Math.max(sx, sz) * 1.18;
    // Centre-rooted formations: using the lowest footprint sample buried whole
    // boulders on hillsides. Keep the root embedded but expose the actual 3D crag.
    const root = heightAt(x,z);
    return {x,y:root+sy*.2,z,sx,sy,sz,radius,rotation:random()*Math.PI*2,shade:.75+random()*.55};
  }).filter(rock=>v.landscape!=="volcanic" || Array.from({length:v.lavaChannelCount},(_,channel)=>
    Math.abs(rock.x-moltenChannelX(rock.z,channel))).every(distance=>distance>rock.radius+v.lavaChannelWidth*1.8));
}

/** Small substeps prevent tunnelling, circle bounds keep movement inside detailed terrain. */
export function safeObserverMove(x: number, z: number, dx: number, dz: number, v: VisualEnvironment,
  heightAt: (x:number,z:number)=>number, rocks: RockPlacement[]) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx,dz)/.2));
  for (let step=0; step<steps; step++) {
    const nx=x+dx/steps, nz=z+dz/steps;
    if (Math.hypot(nx,nz-12.25)>v.movementRadius) break;
    if (v.surfacePreset !== "gas-giant") {
      if (rocks.some(rock=>Math.hypot(nx-rock.x,nz-rock.z)<rock.radius+.65)) break;
      const h=heightAt(nx,nz), previous=heightAt(x,z);
      const slope=Math.max(Math.abs(heightAt(nx+.5,nz)-heightAt(nx-.5,nz)),Math.abs(heightAt(nx,nz+.5)-heightAt(nx,nz-.5)));
      if (!Number.isFinite(h) || slope>v.maxSlope || Math.abs(h-previous)>.2) break;
    }
    x=nx;z=nz;
  }
  return {x,z};
}
