import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import type { VisualEnvironment } from "../../types/visual-environment";

/** Astronomy stays in deriveEnvironment; this layer bounds and documents artistic mappings. */
export function deriveVisualEnvironment(planet: Planet, environment: PlanetEnvironment): VisualEnvironment {
  const assumptions = [...environment.assumptions.filter(item => !item.startsWith("Atmosphere shown as")),
    "Terrain, frost, molten fissures and cloud colours are hypothetical composition scenarios, not detected surfaces.",
    "Scene distances are compressed. Planet radius is compressed 3500× for visible horizon curvature; eye height is an artistic choice. Terrain relief is exaggerated.",
    "Stellar angular radius is approximated from stellar radius/orbit, scaled 1.3× and bounded to 0.6–8 degrees. Stellar position is composed, not an ephemeris.",
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
  if (cold) assumptions.push("Cold equilibrium temperature alone does not establish ice. Any frost shown is an independently chosen illustration scenario.");
  const preset = giant ? "gas-giant" : hot ? "lava-rock" : cold ? "cold-rock" : "temperate-rock";
  const brightness = Math.log10(1 + bounded(environment.illumination, 0, 1e8, 1));
  const angularRadius = Math.atan(bounded(environment.apparentStarSize, 0.001, 1e5, 1) * 0.00465047);
  const gravity = bounded(environment.gravityEarth, 0.05, 30, 1);
  const horizonRadius = radius * 6371000 / 3500;
  // Adapted from ca61786: curated illustration scenarios, never measurement edits.
  const proxima = planet.name === "Proxima Centauri b";
  const kepler = planet.name === "Kepler-186 f";
  const landscape = giant ? "clouds" : hot ? "volcanic" : proxima ? "craters" : kepler ? "glacial" : "ridges";
  const scattering = proxima ? 0.012 : kepler ? 0.24 : giant ? 0.55 : hot ? 0.04 : 0.1;
  const atmosphereScenario = giant ? "hypothetical upper-atmosphere cloud layers" : proxima ? "assumed minimal atmosphere" : kepler ? "assumed scattering atmosphere" : hot ? "assumed thin volcanic haze" : "assumed thin haze";
  assumptions.push(proxima
    ? "Dry weathered crater basins and a minimal atmosphere are hypothetical. Neither the craters nor atmospheric loss are claimed to be observed."
    : kepler ? "Fractured frost-covered formations and pale ridges are illustrative, not confirmed ice or water. The scattering atmosphere is assumed independently of equilibrium temperature."
    : giant ? "Moving cloud shapes, layer altitudes, colours and winds are illustrative, not a resolved weather map. The observer floats; there is no solid floor."
    : hot ? "Separate molten channels and solid crust are a hypothetical volcanic scenario. Their distribution, composition and local temperatures are not measured."
    : "Jagged charcoal ridges, fractures and limited frost are hypothetical geology, not mapped terrain.");
  assumptions.push(`Rendering scenario: ${atmosphereScenario}. Fill light preserves shadow detail and is not a measurement of atmospheric scattering.`);
  return {
    landscape, atmosphereScenario,
    movementRadius: giant ? 65 : 32, movementSpeed: giant ? 20 : 9.5, maxSlope: 0.8,
    surfacePreset: preset,
    skyColor: giant ? "#263640" : proxima ? "#020304" : kepler ? "#14212b" : "#0b1015",
    horizonColor: giant ? "#a5a197" : proxima ? "#080808" : kepler ? "#80919b" : hot ? "#3c3028" : "#535a5c",
    groundColor: hot ? "#444039" : proxima ? "#756657" : kepler ? "#87979f" : "#595958",
    groundAccentColor: hot ? "#ef4510" : proxima ? "#ab9580" : kepler ? "#d4e2e4" : "#a4a7a6",
    starColor: /^#[0-9a-f]{6}$/i.test(environment.starColor) ? environment.starColor : "#fff4e8",
    starSize: bounded(angularRadius * 1.3, 0.0105, 0.14, 0.03),
    starPosition: [45, 230, -680],
    starIntensity: bounded(2 + brightness * 0.9, 2, 5.4, 2),
    ambientIntensity: proxima ? 1.0 : kepler ? 1.15 : 1.2,
    fillColor: "#b6c4cc",
    exposure: bounded(1.05 - brightness * 0.06, 0.78, 1.05, 1),
    atmosphereOpacity: scattering, hazeDensity: scattering * 0.012,
    fogNear: giant ? 220 : 220,
    fogFar: giant ? 1600 : proxima ? 2000 : 1000,
    terrainAmplitude: bounded((proxima ? 4 : kepler ? 9 : 8) / Math.sqrt(gravity), 3.5, 12, 7),
    terrainFrequency: hot ? 0.027 : proxima ? 0.014 : kepler ? 0.016 : 0.028,
    horizonRadius, horizonCurvature: 1 / horizonRadius,
    roughness: hot ? 0.93 : 0.98,
    rockCount: giant ? 0 : proxima ? 100 : kepler ? 180 : 240, rockScale: kepler ? 1.8 : proxima ? 0.75 : 1.15,
    frostCoverage: kepler ? 0.8 : proxima ? 0 : cold ? 0.1 : 0,
    emissiveIntensity: hot && !giant ? 2.2 : 0,
    cloudOpacity: giant ? 0.6 : 0,
    cloudColor: "#515e68", cloudAccentColor: "#d3cbb8",
    cloudSpeed: giant ? 0.018 : 0, cloudHeight: 14,
    starfieldOpacity: bounded(0.28 / (1 + brightness * 3 + scattering * 8), 0.008, 0.28, 0.05),
    cameraHeight: giant ? 32 : proxima ? 3.5 : 2.8,
    cameraSway: giant ? 1.5 : 0.45, cameraSpeed: giant ? 0.08 : 0.12,
    cameraLookHeight: giant ? 30 : 2,
    assumptions,
  };
}
function bounded(value: number | undefined, min: number, max: number, fallback: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value! : fallback));
}
