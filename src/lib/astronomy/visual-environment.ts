import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import type { VisualEnvironment } from "../../types/visual-environment";

/** Astronomy stays in deriveEnvironment; this layer bounds and documents artistic mappings. */
export function deriveVisualEnvironment(planet: Planet, environment: PlanetEnvironment): VisualEnvironment {
  const assumptions = [...environment.assumptions,
    "Terrain, frost, molten fissures and cloud colours are hypothetical composition scenarios, not detected surfaces.",
    "Scene distances are compressed. Planet radius is compressed 3500× for visible horizon curvature; eye height is an artistic choice. Terrain relief is exaggerated.",
    "Stellar angular radius is approximated from stellar radius/orbit, scaled 1.8× and bounded to 0.6–12 degrees. Stellar position is composed, not an ephemeris.",
    "Illumination is logarithmically compressed into bounded lighting/exposure. Scattering is illustrative; equilibrium temperature is not actual surface temperature."];
  const knownRadius = Number.isFinite(planet.radiusEarth) && (planet.radiusEarth ?? 0) > 0;
  const giantCategory = ["gas-giant", "hot-jupiter", "mini-neptune"].includes(planet.category ?? "");
  const giant = knownRadius ? planet.radiusEarth! > 4 : giantCategory;
  const radius = bounded(knownRadius ? planet.radiusEarth : undefined, 0.2, 30, giant ? 10 : 1);
  if (!knownRadius) assumptions.push(giant ? "Radius unavailable: category suggests an atmospheric world; assume 10 Earth radii." : "Radius/category unavailable: hypothetical rocky terrain at one Earth radius.");
  assumptions.push(giant
    ? "Radius/category selects an upper-atmosphere viewpoint: cloud layers only, no solid surface. This overrides the upstream airless visual heuristic, not the measurements."
    : "Radius at or below four Earth radii selects a hypothetical rocky scenario; radius alone does not establish composition.");
  const hot = Number.isFinite(planet.equilibriumTemperatureK) && (planet.equilibriumTemperatureK ?? 0) >= 1400;
  const cold = ["cold", "frozen"].includes(environment.temperatureCategory);
  if (cold) assumptions.push("Cold equilibrium temperature does not imply global ice: weathered rock with limited illustrative frost is used.");
  const preset = giant ? "gas-giant" : hot ? "lava-rock" : cold ? "cold-rock" : "temperate-rock";
  const atmosphere = giant ? 0.65 : ({airless: 0, thin: 0.1, earthlike: 0.24, dense: 0.4}[environment.atmospherePreset] ?? 0.12);
  const brightness = Math.log10(1 + bounded(environment.illumination, 0, 1e8, 1));
  const angularRadius = Math.atan(bounded(environment.apparentStarSize, 0.001, 1e5, 1) * 0.00465047);
  const gravity = bounded(environment.gravityEarth, 0.05, 30, 1);
  const horizonRadius = radius * 6371000 / 3500;
  return {
    surfacePreset: preset,
    skyColor: giant ? "#192c3a" : hot ? "#080909" : "#151d23",
    horizonColor: giant ? "#ad9783" : hot ? "#443026" : "#77766e",
    groundColor: hot ? "#262522" : "#55514b",
    groundAccentColor: hot ? "#ff6b16" : "#9b9383",
    starColor: /^#[0-9a-f]{6}$/i.test(environment.starColor) ? environment.starColor : "#fff4e8",
    starSize: bounded(angularRadius * 1.8, 0.0105, 0.21, 0.03),
    starPosition: [100, 145, -680],
    starIntensity: bounded(2 + brightness * 0.9, 2, 5.4, 2),
    ambientIntensity: 1.1,
    fillColor: "#b6c4cc",
    exposure: bounded(1.05 - brightness * 0.06, 0.78, 1.05, 1),
    atmosphereOpacity: atmosphere, hazeDensity: atmosphere * 0.012,
    fogNear: giant ? 80 : 120,
    fogFar: giant ? 600 : atmosphere > 0 ? 580 : 1100,
    terrainAmplitude: bounded(7 / Math.sqrt(gravity), 3.5, 10, 7),
    terrainFrequency: hot ? 0.032 : 0.022,
    horizonRadius, horizonCurvature: 1 / horizonRadius,
    roughness: hot ? 0.93 : 0.98,
    rockCount: giant ? 0 : 220, rockScale: hot ? 1.15 : 1,
    frostCoverage: cold ? 0.08 : 0,
    emissiveIntensity: hot && !giant ? 4.2 : 0,
    cloudOpacity: giant ? 0.82 : 0,
    cloudColor: "#3e464e", cloudAccentColor: "#ddc6ad",
    cloudSpeed: giant ? 0.018 : 0, cloudHeight: 0.6,
    starfieldOpacity: bounded(0.28 / (1 + brightness * 3 + atmosphere * 8), 0.008, 0.28, 0.05),
    cameraHeight: giant ? 32 : 2.8,
    cameraSway: giant ? 1.5 : 0.45, cameraSpeed: giant ? 0.08 : 0.12,
    cameraLookHeight: giant ? 30 : 2,
    assumptions,
  };
}
function bounded(value: number | undefined, min: number, max: number, fallback: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value! : fallback));
}
