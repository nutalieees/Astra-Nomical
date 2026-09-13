import type { PlanetEnvironment } from "../../types/environment";
import type { VisualEnvironment } from "../../types/visual-environment";

/**
 * Translates scientific environment values into a small, safe rendering
 * vocabulary. It is deterministic: the same PlanetEnvironment always yields
 * the same scene settings, with no network or LLM dependency.
 *
 * This module intentionally does not infer atmospheric composition. Colors,
 * clouds, and terrain are named visual scenarios and are accompanied by an
 * assumption so a future HUD can distinguish them from measured values.
 */
export function deriveVisualEnvironment(environment: PlanetEnvironment): VisualEnvironment {
  const assumptions = [
    "Sky, terrain, cloud, and haze colors are illustrative rendering scenarios, not measurements of atmospheric or surface composition.",
  ];

  const temperature = environment.temperatureCategory;
  const extremeIrradiation = environment.illumination >= 20 || temperature === "extreme";
  const giantLikeScenario =
    extremeIrradiation &&
    environment.gravityEarth > 0.45 &&
    environment.gravityEarth < 1.35 &&
    environment.atmospherePreset === "airless";

  let surfacePreset: VisualEnvironment["surfacePreset"];
  let skyColor: string;
  let horizonColor: string;
  let groundColor: string;
  let groundAccentColor: string;
  let terrainAmplitude: number;
  let terrainFrequency: number;
  let cloudOpacity: number;
  let emissiveIntensity: number;

  if (giantLikeScenario) {
    surfacePreset = "gas-giant";
    skyColor = "#160a2c";
    horizonColor = "#9a4271";
    groundColor = "#32113d";
    groundAccentColor = "#ff9b57";
    terrainAmplitude = 0.015;
    terrainFrequency = 0.45;
    cloudOpacity = 0.32;
    emissiveIntensity = 0.38;
    assumptions.push(
      "An intensely irradiated, near-Earth-gravity airless preset is rendered as a turbulent giant-world atmosphere; this is a visual classification, not a composition claim."
    );
  } else if (temperature === "extreme" || temperature === "hot") {
    surfacePreset = "lava-rock";
    skyColor = "#180b20";
    horizonColor = "#d64a2b";
    groundColor = "#30151a";
    groundAccentColor = "#ff6b2c";
    terrainAmplitude = 0.17;
    terrainFrequency = 1.65;
    cloudOpacity = environment.atmospherePreset === "dense" ? 0.2 : 0.03;
    emissiveIntensity = temperature === "extreme" ? 0.85 : 0.42;
  } else if (temperature === "frozen" || temperature === "cold") {
    surfacePreset = "ice-rock";
    skyColor = "#071323";
    horizonColor = "#426c91";
    groundColor = "#9ab5bf";
    groundAccentColor = "#d9f5ff";
    terrainAmplitude = 0.1;
    terrainFrequency = 1.1;
    cloudOpacity = environment.atmospherePreset === "earthlike" ? 0.18 : 0.05;
    emissiveIntensity = 0.02;
  } else {
    surfacePreset = "temperate-rock";
    skyColor = "#0b2438";
    horizonColor = "#6fa6bf";
    groundColor = "#315746";
    groundAccentColor = "#9a7a4b";
    terrainAmplitude = 0.13;
    terrainFrequency = 1.3;
    cloudOpacity = environment.atmospherePreset === "earthlike" ? 0.26 : 0.1;
    emissiveIntensity = 0;
  }

  const atmosphereOpacity = atmosphereOpacityFor(environment.atmospherePreset);
  const starIntensity = clamp(0.65 + Math.log10(Math.max(environment.illumination, 0.01) + 1) * 0.55, 0.65, 3.2);
  const starSize = clamp(0.45 + Math.sqrt(Math.max(environment.apparentStarSize, 0.01)) * 0.34, 0.45, 3.5);

  return {
    surfacePreset,
    skyColor,
    horizonColor,
    groundColor,
    groundAccentColor,
    starColor: safeColor(environment.starColor),
    starIntensity: round(starIntensity),
    starSize: round(starSize),
    ambientIntensity: round(clamp(0.12 + atmosphereOpacity * 0.42, 0.12, 0.5)),
    atmosphereOpacity,
    hazeDensity: round(clamp(atmosphereOpacity * 0.72 + (temperature === "extreme" ? 0.06 : 0), 0.02, 0.62)),
    terrainAmplitude: round(terrainAmplitude * clamp(1.25 / Math.sqrt(environment.gravityEarth), 0.55, 1.45)),
    terrainFrequency,
    horizonCurvature: round(clamp(1 / Math.sqrt(environment.gravityEarth), 0.55, 1.6)),
    cloudOpacity,
    emissiveIntensity,
    assumptions,
  };
}

function atmosphereOpacityFor(preset: PlanetEnvironment["atmospherePreset"]): number {
  switch (preset) {
    case "airless": return 0.025;
    case "thin": return 0.12;
    case "earthlike": return 0.3;
    case "dense": return 0.52;
  }
}

function safeColor(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#fff4e8";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
