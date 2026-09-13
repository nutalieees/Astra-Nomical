import { BufferGeometry, Float32BufferAttribute } from "three";
import type { OrganismSceneSpec } from "../../lib/evolve-life/organism-scene";
import type { VisualEnvironment } from "../../types/visual-environment";

/** One continuous, closed tissue surface. Units are concept-display units, never biological metres. */
export function organismDimensions(spec: OrganismSceneSpec) {
  const longest = Math.max(spec.proportions.length, spec.proportions.width);
  return { x: spec.proportions.width / longest, z: spec.proportions.length / longest,
    y: Math.max(0.065, Math.min(0.85, spec.proportions.height / longest)) };
}

export function createOrganismGeometry(spec: OrganismSceneSpec, seed: number) {
  const rings = 80, slices = 128, d = organismDimensions(spec);
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const phase = (seed % 997) / 997 * Math.PI * 2;
  for (let row = 0; row <= rings; row++) {
    const v = row / rings, theta = v * Math.PI;
    const radial = Math.sin(theta), vertical = Math.cos(theta);
    for (let col = 0; col <= slices; col++) {
      const u = col / slices, phi = u * Math.PI * 2;
      let x = Math.cos(phi) * radial, z = Math.sin(phi) * radial;
      let contour = 1;
      if (spec.form === "sheet") contour += 0.09 * Math.sin(phi * 7 + phase) * radial ** 4 + 0.045 * Math.sin(phi * 13);
      if (spec.form === "radial") contour += 0.19 * Math.cos(phi * 6) * radial ** 2;
      if (spec.form === "cushion") contour += 0.065 * Math.sin(phi * 5 + phase) + 0.035 * Math.cos(phi * 9);
      const segmentation = spec.form === "segmented" ? 1 - 0.075 * Math.pow(0.5 + 0.5 * Math.cos((z + 1) * Math.PI * spec.segments), 5) : 1;
      const folds = 0.012 * Math.sin(phi * 17 + theta * 5 + phase) * Math.sin(theta * 19) * radial;
      x *= contour * d.x * segmentation;
      z *= contour * d.z;
      // A broad underside supports the tissue; the upper surface has fine organic asymmetry.
      let y = (vertical >= 0 ? Math.pow(vertical, 0.75) : vertical * 0.20) * d.y;
      y = (y + d.y * 0.20) * segmentation;
      if (spec.form === "sheet") y += Math.pow(radial, 6) * d.y * 0.23 * (Math.sin(phi * 9 + phase) + 1);
      y += folds * d.y + 0.018 * d.y * Math.sin(x * 13 + z * 9 + phase) * radial;
      positions.push(x, Math.max(0, y), z); uvs.push(u, v);
      if (row < rings && col < slices) {
        const a = row * (slices + 1) + col, b = a + slices + 1;
        if (row > 0) indices.push(a, a + 1, b);
        if (row < rings - 1) indices.push(a + 1, b + 1, b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Sample the displayed terrain around the whole specimen, so even a broad form clears hills. */
export function getOrganismPlacement(v: VisualEnvironment, heightAt: (x: number, z: number) => number) {
  const x = 0, z = 5, displayScale = 2.1;
  let ground = -Infinity;
  for (let ix = -3; ix <= 3; ix++) for (let iz = -3; iz <= 3; iz++) {
    ground = Math.max(ground, heightAt(x + ix * 0.8, z + iz * 0.8));
  }
  const y = v.surfacePreset === "gas-giant" ? v.cameraHeight - 1 : ground + 0.035;
  return { position: [x, y, z] as [number, number, number],
    target: [x, y + 0.65, z] as [number, number, number], displayScale };
}
