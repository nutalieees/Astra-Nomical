/**
 * Normalized internal representation of a planet.
 *
 * This is the ONLY shape UI/rendering components should ever see.
 * Raw NASA Exoplanet Archive fields get mapped into this shape at data-prep
 * time (or at fetch time, if you build a live-fetch layer later) — nothing
 * downstream should know what a "pl_rade" or "st_teff" column is.
 *
 * Every field is optional because real exoplanet data is incomplete.
 * deriveEnvironment() (see environment.ts) is responsible for turning
 * partial data into a complete, safe-to-render PlanetEnvironment via the
 * fallback hierarchy described in the README:
 *   1. measured value
 *   2. derived value
 *   3. scientifically reasonable visual assumption
 *   4. safe default
 */
export interface Planet {
  /** Canonical planet name, e.g. "TRAPPIST-1 e". Used as display name + lookup key. */
  name: string;

  /** Planet radius in Earth radii (R⊕). Measured for most transiting planets. */
  radiusEarth?: number;

  /** Planet mass in Earth masses (M⊕). Often unmeasured for small/RV-quiet planets. */
  massEarth?: number;

  /** Orbital semi-major axis in astronomical units (AU). */
  orbitalDistanceAU?: number;

  /** Orbital period in Earth days. */
  orbitalPeriodDays?: number;

  /** Equilibrium temperature in Kelvin, assuming zero albedo / no greenhouse effect. */
  equilibriumTemperatureK?: number;

  /** Host star's common name, e.g. "TRAPPIST-1". */
  starName?: string;

  /** Host star radius in solar radii (R☉). */
  starRadiusSolar?: number;

  /** Host star effective temperature in Kelvin. */
  starTemperatureK?: number;

  /** Host star spectral type, e.g. "M8V", "G2V", "F6V". */
  starSpectralType?: string;

  /** Distance from Earth to the system, in light years. */
  distanceLightYears?: number;

  /** Year the planet was confirmed/discovered. */
  discoveryYear?: number;

  // --- Fields beyond the AGENTS.md baseline, useful for the buffer set and HUD ---

  /** How the planet was discovered, e.g. "Transit", "Radial Velocity", "Imaging". */
  discoveryMethod?: string;

  /** Host star mass in solar masses (M☉). Useful for gravity/orbit sanity checks. */
  starMassSolar?: number;

  /** Orbital eccentricity (0 = circular). Frequently unmeasured/assumed 0 for small planets. */
  orbitalEccentricity?: number;

  /** Free-text one-liner for UI blurbs, written by us (not fetched), e.g. "Tidally locked, ultra-hot dayside." */
  notableFact?: string;

  /** Category tag used only for the 40-planet buffer set to track curation diversity. Not a NASA field. */
  category?:
    | "rocky-habitable-zone"
    | "hot-jupiter"
    | "ultra-hot"
    | "mini-neptune"
    | "super-earth"
    | "gas-giant"
    | "circumbinary"
    | "directly-imaged"
    | "pulsar-planet"
    | "oddity";
}

/**
 * Per-field provenance so the UI can honestly label what it's showing,
 * per AGENTS.md section 6 ("Scientific Integrity"). Keyed by Planet field name.
 * Not required for rendering, but strongly recommended to populate alongside
 * real data during the fetch pass.
 */
export type PlanetFieldProvenance = Partial<
  Record<keyof Planet, "measured" | "derived" | "assumed" | "speculative">
>;
