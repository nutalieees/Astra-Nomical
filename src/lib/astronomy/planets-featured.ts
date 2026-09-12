import type { Planet, PlanetFieldProvenance } from "../../types/planet";

/**
 * The 5 demo-safe featured planets (AGENTS.md section 4.1 / 22).
 * REAL DATA, fetched from the NASA Exoplanet Archive (pscomppars table)
 * on 2026-09-12. See README.md for the fetch methodology.
 *
 * These MUST work with zero network dependency — this file is the
 * cached local copy that ships with the app regardless of API availability.
 */

export const FEATURED_PLANETS: Planet[] = [
  {
    name: "TRAPPIST-1 e",
    radiusEarth: 0.92,
    massEarth: 0.692,
    orbitalDistanceAU: 0.02925,
    orbitalPeriodDays: 6.101,
    equilibriumTemperatureK: 249.7,
    starName: "TRAPPIST-1",
    starRadiusSolar: 0.1192,
    starTemperatureK: 2566.0,
    starSpectralType: "M8.0 V",
    distanceLightYears: 40.54,
    discoveryYear: 2017,
    discoveryMethod: "Transit",
    starMassSolar: 0.0898,
    orbitalEccentricity: 0.0051,
    notableFact: "One of seven Earth-sized planets in the TRAPPIST-1 system; sits inside or near the habitable zone of an ultra-cool red dwarf.",
  },
  {
    name: "Proxima Centauri b",
    radiusEarth: 1.02,
    massEarth: 1.055,
    orbitalDistanceAU: 0.04848,
    orbitalPeriodDays: 11.1846,
    equilibriumTemperatureK: 218.0,
    starName: "Proxima Centauri",
    starRadiusSolar: 0.141,
    starTemperatureK: 2900.0,
    starSpectralType: "M5.5 V",
    distanceLightYears: 4.24,
    discoveryYear: 2016,
    discoveryMethod: "Radial Velocity",
    starMassSolar: 0.1221,
    orbitalEccentricity: 0.0,
    notableFact: "Nearest known exoplanet to our solar system. Discovered via radial velocity, so mass is a minimum (m·sin i), not a full measurement; radius is not directly measured (no confirmed transit).",
  },
  {
    name: "55 Cancri e",
    radiusEarth: 1.875,
    massEarth: 7.99,
    orbitalDistanceAU: 0.01544,
    orbitalPeriodDays: 0.7365,
    equilibriumTemperatureK: 1958.0,
    starName: "55 Cancri A",
    starRadiusSolar: 0.943,
    starTemperatureK: 5172.0,
    starSpectralType: "G8 V",
    distanceLightYears: 41.05,
    discoveryYear: 2004,
    discoveryMethod: "Radial Velocity",
    starMassSolar: 0.905,
    orbitalEccentricity: 0.05,
    notableFact: "Ultra-short-period 'lava world' — orbits so close its dayside is hot enough to host a molten or vapor-dominated surface.",
  },
  {
    name: "WASP-121 b",
    radiusEarth: 19.526,
    massEarth: 371.859,
    orbitalDistanceAU: 0.02571,
    orbitalPeriodDays: 1.2749,
    equilibriumTemperatureK: 2409.0,
    starName: "WASP-121",
    starRadiusSolar: 1.461,
    starTemperatureK: 6628.0,
    starSpectralType: "F6 V",
    distanceLightYears: 880.3,
    discoveryYear: 2016,
    discoveryMethod: "Transit",
    starMassSolar: 1.33,
    orbitalEccentricity: 0.0085,
    notableFact: "Ultra-hot Jupiter so close to its star that it's being tidally stripped; hot enough for metals to vaporize in its atmosphere.",
  },
  {
    name: "Kepler-186 f",
    radiusEarth: 1.17,
    massEarth: 1.71,
    orbitalDistanceAU: 0.432,
    orbitalPeriodDays: 129.9441,
    equilibriumTemperatureK: 177.0,
    starName: "Kepler-186",
    starRadiusSolar: 0.523,
    starTemperatureK: 3755.0,
    starSpectralType: "M1",
    distanceLightYears: 579.24,
    discoveryYear: 2014,
    discoveryMethod: "Transit",
    starMassSolar: 0.544,
    orbitalEccentricity: 0.04,
    notableFact: "First Earth-sized planet found orbiting within a star's habitable zone. Archive mass is a model-based estimate, not a direct measurement — flagged 'derived' in provenance.",
  },
];

/**
 * Field-by-field provenance, confirmed against the actual archive fetch.
 */
export const FEATURED_PLANETS_PROVENANCE: Record<string, PlanetFieldProvenance> = {
  "TRAPPIST-1 e": {
    radiusEarth: "measured",
    massEarth: "measured",
    orbitalDistanceAU: "measured",
    orbitalPeriodDays: "measured",
    equilibriumTemperatureK: "measured",
    starTemperatureK: "measured",
  },
  "Proxima Centauri b": {
    radiusEarth: "assumed",
    massEarth: "measured",
    orbitalDistanceAU: "measured",
    orbitalPeriodDays: "measured",
    equilibriumTemperatureK: "measured",
    starTemperatureK: "measured",
  },
  "55 Cancri e": {
    radiusEarth: "measured",
    massEarth: "measured",
    orbitalDistanceAU: "measured",
    orbitalPeriodDays: "measured",
    equilibriumTemperatureK: "measured",
    starTemperatureK: "measured",
  },
  "WASP-121 b": {
    radiusEarth: "measured",
    massEarth: "measured",
    orbitalDistanceAU: "measured",
    orbitalPeriodDays: "measured",
    equilibriumTemperatureK: "measured",
    starTemperatureK: "measured",
  },
  "Kepler-186 f": {
    radiusEarth: "measured",
    massEarth: "derived",
    orbitalDistanceAU: "measured",
    orbitalPeriodDays: "measured",
    equilibriumTemperatureK: "measured",
    starTemperatureK: "measured",
  },
};
