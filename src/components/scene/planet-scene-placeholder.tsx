"use client";

import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";

export interface PlanetScenePlaceholderProps {
  planet: Planet;
  environment: PlanetEnvironment;
  /** Reserved for Developer A's deterministic visual mapper. */
  visualEnvironment: unknown;
}

const atmosphereCopy: Record<PlanetEnvironment["atmospherePreset"], string> = {
  airless: "Airless visual scenario · hard-edged horizon",
  thin: "Thin-atmosphere visual scenario · exposed horizon",
  earthlike: "Earth-like visual scenario · diffuse horizon glow",
  dense: "Dense-atmosphere visual scenario · deep horizon haze",
};

/**
 * Temporary replaceable scene boundary. It deliberately has the same data
 * contract planned for PlanetScene, but does not import Three.js.
 */
export function PlanetScenePlaceholder({ planet, environment }: PlanetScenePlaceholderProps) {
  const heat = environment.temperatureCategory;

  return (
    <div className={`scene-placeholder scene-${heat}`} aria-label={`Surface preview of ${planet.name}`}>
      <div className="scene-stars" aria-hidden="true" />
      <div className="scene-star" style={{ backgroundColor: environment.starColor }} aria-hidden="true" />
      <div className="scene-atmosphere" aria-hidden="true" />
      <div className="scene-horizon" aria-hidden="true" />
      <div className="scene-terrain" aria-hidden="true" />

      <div className="scene-placeholder-label">
        <span className="eyebrow">SURFACE SIGNAL · TEMPORARY VIEWPORT</span>
        <strong>{planet.name}</strong>
        <p>{atmosphereCopy[environment.atmospherePreset]}</p>
      </div>
    </div>
  );
}
