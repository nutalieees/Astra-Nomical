/**
 * Output of deriveEnvironment(planet). This is what the 3D renderer and HUD
 * actually consume — they should never touch a Planet's raw astronomical
 * fields directly.
 */
export interface PlanetEnvironment {
  /** Surface gravity relative to Earth (1.0 = Earth gravity). */
  gravityEarth: number;

  /** CSS-safe hex/rgb color string for the host star as it would appear in the sky. */
  starColor: string;

  /** Apparent angular size of the star relative to the Sun as seen from Earth (1.0 = same apparent size as our Sun). */
  apparentStarSize: number;

  /** Relative illumination/insolation at the planet's surface (1.0 = Earth's solar flux). */
  illumination: number;

  temperatureCategory: "frozen" | "cold" | "temperate" | "hot" | "extreme";

  atmospherePreset: "airless" | "thin" | "earthlike" | "dense";

  /**
   * Human-readable list of every assumption baked into this environment,
   * e.g. "Mass not measured — gravity estimated from radius using a
   * rocky-planet mass-radius relation." Surfaced in the UI per AGENTS.md
   * section 6.
   */
  assumptions: string[];
}
