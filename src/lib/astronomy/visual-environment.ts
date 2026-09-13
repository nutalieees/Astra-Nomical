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
  // These are curated illustration choices, not inferred geological discoveries.
  const proxima = planet.name === "Proxima Centauri b";
  const kepler = planet.name === "Kepler-186 f";
  const landscape = giant ? "clouds" : hot ? "volcanic" : proxima ? "craters" : kepler ? "glacial" : "ridges";
  assumptions.push(proxima
    ? "Proxima b is illustrated as a dry, cratered rocky world with minimal haze. Neither craters nor atmospheric loss are established observations; its radius is an estimate."
    : kepler
      ? "Kepler-186 f is illustrated with fractured, frost-covered ridges under a hypothetical scattering atmosphere. Ice, water and this atmosphere have not been detected; its low equilibrium temperature only motivates the scenario."
      : giant ? "Cloud bands and their colours are an illustrative atmospheric structure, not a resolved image."
        : hot ? "Dark crust and molten channels illustrate extreme irradiation; the actual surface distribution and local temperature are unknown."
          : "TRAPPIST-like cold rock uses jagged charcoal ridges and limited frost as an illustrative geological scenario; no terrain map is known.");
  return {
    landscape,
    surfacePreset: preset,
    skyColor: giant ? "#192c3a" : hot ? "#080909" : proxima ? "#030406" : kepler ? "#101f30" : "#101014",
    horizonColor: giant ? "#ad9783" : hot ? "#443026" : proxima ? "#181414" : kepler ? "#8199aa" : "#68534c",
    groundColor: hot ? "#262522" : proxima ? "#796052" : kepler ? "#8c9da4" : "#403e43",
    groundAccentColor: hot ? "#ff6b16" : proxima ? "#ad9074" : kepler ? "#d5e3e5" : "#81746a",
    starColor: /^#[0-9a-f]{6}$/i.test(environment.starColor) ? environment.starColor : "#fff4e8",
    starSize: bounded(angularRadius * 1.8, 0.0105, 0.21, 0.03),
    starPosition: [100, 145, -680],
    starIntensity: bounded(2 + brightness * 0.9, 2, 5.4, 2),
    ambientIntensity: proxima ? 0.24 : kepler ? 0.65 : 0.48,
    fillColor: kepler ? "#c6d9ed" : proxima ? "#aaa0a0" : "#b6b2ba",
    exposure: bounded(1.05 - brightness * 0.06, 0.78, 1.05, 1),
    atmosphereOpacity: proxima ? 0 : kepler ? 0.32 : atmosphere, hazeDensity: proxima ? 0 : atmosphere * 0.012,
    fogNear: giant ? 80 : 120,
    fogFar: giant ? 600 : proxima ? 1400 : kepler ? 440 : atmosphere > 0 ? 580 : 1100,
    terrainAmplitude: bounded((proxima ? 4 : kepler ? 10 : 8) / Math.sqrt(gravity), 3.5, 13, 7),
    terrainFrequency: hot ? 0.032 : proxima ? 0.014 : kepler ? 0.018 : 0.028,
    horizonRadius, horizonCurvature: 1 / horizonRadius,
    roughness: hot ? 0.93 : 0.98,
    rockCount: giant ? 0 : proxima ? 90 : kepler ? 130 : 260, rockScale: hot ? 1.15 : kepler ? 1.7 : proxima ? 0.6 : 1.2,
    frostCoverage: kepler ? 0.85 : proxima ? 0 : cold ? 0.08 : 0,
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
