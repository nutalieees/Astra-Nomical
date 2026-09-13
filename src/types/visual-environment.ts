/**
 * Bounded, renderer-facing settings derived from PlanetEnvironment.
 *
 * These values are deliberately visual scenarios rather than new scientific
 * measurements. A scene can consume them directly without handling missing
 * astronomy fields or making unbounded Three.js values.
 */
export type SurfacePreset = "temperate-rock" | "ice-rock" | "lava-rock" | "gas-giant";

export interface VisualEnvironment {
  /** Stable visual scenario used to select the planet material/geometry. */
  surfacePreset: SurfacePreset;

  /** CSS-safe colors for the scene's sky, horizon haze, and terrain. */
  skyColor: string;
  horizonColor: string;
  groundColor: string;
  groundAccentColor: string;

  /** Host-star appearance, copied from the scientific environment. */
  starColor: string;

  /** Safe Three.js-ready lighting controls. */
  starIntensity: number;
  starSize: number;
  ambientIntensity: number;
  atmosphereOpacity: number;
  hazeDensity: number;

  /** Low-cost procedural surface controls, kept in deliberate safe ranges. */
  terrainAmplitude: number;
  terrainFrequency: number;
  horizonCurvature: number;
  cloudOpacity: number;
  emissiveIntensity: number;

  /** Human-readable visual assumptions, suitable for a later scene HUD. */
  assumptions: string[];
}
