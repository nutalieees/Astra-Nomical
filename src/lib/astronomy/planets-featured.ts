import type { Planet, PlanetFieldProvenance } from "../../types/planet";

/**
 * The 5 demo-safe featured planets (AGENTS.md section 4.1 / 22).
 * These MUST work with zero network dependency — this file is the cached
 * local copy that ships with the app regardless of API availability.
 *
 * ⚠️ SCAFFOLD ONLY: numeric fields below are `undefined` placeholders
 * (with an approximate remembered value left in a comment purely as a
 * sanity-check hint — NOT verified, do not treat as data). Before the
 * hackathon, run the fetch described in README.md against the NASA
 * Exoplanet Archive for each of these 5 planet names and fill in the
 * real values. Do NOT ship with fields left `undefined` —
 * deriveEnvironment() will fall back to safe defaults for anything
 * missing, which is fine for reliability but is not the differentiated,
 * "real data" experience the demo is supposed to show off.
 *
 * Suggested fetch target (see README.md for the full query):
 *   https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=
 *     select+pl_name,pl_rade,pl_bmasse,pl_orbsmax,pl_orbper,pl_eqt,
 *     hostname,st_rad,st_teff,st_spectype,sy_dist,disc_year,discoverymethod,st_mass,pl_orbeccen
 *     +from+pscomppars+where+pl_name+like+%27<PLANET_NAME>%27
 *     &format=json
 */

export const FEATURED_PLANETS: Planet[] = [
  {
    name: "TRAPPIST-1 e",
    radiusEarth: undefined, // typically ~0.92 R⊕ — verify via fetch
    massEarth: undefined, // typically ~0.69 M⊕ — verify via fetch
    orbitalDistanceAU: undefined, // ~0.029 AU
    orbitalPeriodDays: undefined, // ~6.1 days
    equilibriumTemperatureK: undefined, // ~250K (varies by albedo assumption used in source)
    starName: "TRAPPIST-1",
    starRadiusSolar: undefined, // ~0.12 R☉
    starTemperatureK: undefined, // ~2560K
    starSpectralType: "M8V",
    distanceLightYears: undefined, // ~40.7 ly
    discoveryYear: undefined, // 2017
    discoveryMethod: "Transit",
    starMassSolar: undefined,
    orbitalEccentricity: undefined,
    notableFact: "One of seven Earth-sized planets in the TRAPPIST-1 system; sits inside or near the habitable zone of an ultra-cool red dwarf.",
  },
  {
    name: "Proxima Centauri b",
    radiusEarth: undefined, // radius not well-constrained (not a confirmed transiter) — verify
    massEarth: undefined, // minimum mass ~1.07 M⊕ (radial velocity, so this is a minimum, not a measured mass)
    orbitalDistanceAU: undefined, // ~0.0485 AU
    orbitalPeriodDays: undefined, // ~11.2 days
    equilibriumTemperatureK: undefined, // ~234K
    starName: "Proxima Centauri",
    starRadiusSolar: undefined, // ~0.15 R☉
    starTemperatureK: undefined, // ~3040K
    starSpectralType: "M5.5V",
    distanceLightYears: undefined, // ~4.24 ly (closest known exoplanet to Earth)
    discoveryYear: undefined, // 2016
    discoveryMethod: "Radial Velocity",
    starMassSolar: undefined,
    orbitalEccentricity: undefined,
    notableFact: "Nearest known exoplanet to our solar system. Discovered via radial velocity, so radius/mass are less certain than transiting planets — flag mass as a minimum (m·sin i), not a full measurement.",
  },
  {
    name: "55 Cancri e",
    radiusEarth: undefined, // ~1.88 R⊕
    massEarth: undefined, // ~8.0 M⊕
    orbitalDistanceAU: undefined, // ~0.0154 AU
    orbitalPeriodDays: undefined, // ~0.74 days (ultra-short-period)
    equilibriumTemperatureK: undefined, // ~2000+K (dayside can be much hotter, tidally locked)
    starName: "55 Cancri A",
    starRadiusSolar: undefined, // ~0.94 R☉
    starTemperatureK: undefined, // ~5200K
    starSpectralType: "G8V",
    distanceLightYears: undefined, // ~41 ly
    discoveryYear: undefined, // 2004
    discoveryMethod: "Radial Velocity (transit confirmed later)",
    starMassSolar: undefined,
    orbitalEccentricity: undefined,
    notableFact: "Ultra-short-period 'lava world' — orbits so close its dayside is hot enough to host a molten or vapor-dominated surface.",
  },
  {
    name: "WASP-121 b",
    radiusEarth: undefined, // ~1.87 Jupiter radii → convert to Earth radii during fetch
    massEarth: undefined, // ~1.18 Jupiter masses → convert to Earth masses during fetch
    orbitalDistanceAU: undefined, // ~0.0254 AU
    orbitalPeriodDays: undefined, // ~1.27 days
    equilibriumTemperatureK: undefined, // ~2360K — ultra-hot Jupiter
    starName: "WASP-121",
    starRadiusSolar: undefined, // ~1.46 R☉
    starTemperatureK: undefined, // ~6460K
    starSpectralType: "F6V",
    distanceLightYears: undefined, // ~880 ly
    discoveryYear: undefined, // 2015
    discoveryMethod: "Transit",
    starMassSolar: undefined,
    orbitalEccentricity: undefined,
    notableFact: "Ultra-hot Jupiter so close to its star that it's being tidally stripped; hot enough for metals to vaporize in its atmosphere.",
  },
  {
    name: "Kepler-186 f",
    radiusEarth: undefined, // ~1.17 R⊕
    massEarth: undefined, // mass not well-constrained — likely needs a derived fallback
    orbitalDistanceAU: undefined, // ~0.432 AU
    orbitalPeriodDays: undefined, // ~130 days
    equilibriumTemperatureK: undefined, // ~188K (outer edge of habitable zone)
    starName: "Kepler-186",
    starRadiusSolar: undefined, // ~0.47 R☉
    starTemperatureK: undefined, // ~3750K
    starSpectralType: "M1V",
    distanceLightYears: undefined, // ~582 ly
    discoveryYear: undefined, // 2014
    discoveryMethod: "Transit",
    starMassSolar: undefined,
    orbitalEccentricity: undefined,
    notableFact: "First Earth-sized planet found orbiting within a star's habitable zone. Mass is unmeasured — a genuinely good showcase for the derived-gravity fallback.",
  },
];

/**
 * Field-by-field provenance scaffold — fill in once real values are fetched.
 * Pre-populated with best-guess provenance based on how these planets were
 * discovered (transit vs. radial velocity), so you're not starting blank.
 */
export const FEATURED_PLANETS_PROVENANCE: Record<string, PlanetFieldProvenance> = {
  "TRAPPIST-1 e": {
    radiusEarth: "measured",
    massEarth: "measured",
    orbitalDistanceAU: "measured",
    orbitalPeriodDays: "measured",
    equilibriumTemperatureK: "derived",
    starTemperatureK: "measured",
  },
  "Proxima Centauri b": {
    radiusEarth: "assumed", // no confirmed transit — radius is not directly measured for this planet
    massEarth: "measured", // technically a minimum mass (m·sin i) from radial velocity
    orbitalDistanceAU: "measured",
    orbitalPeriodDays: "measured",
    equilibriumTemperatureK: "derived",
    starTemperatureK: "measured",
  },
  "55 Cancri e": {
    radiusEarth: "measured",
    massEarth: "measured",
    orbitalDistanceAU: "measured",
    orbitalPeriodDays: "measured",
    equilibriumTemperatureK: "derived",
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
    massEarth: "derived", // not well constrained by RV; archive often leaves this blank
    orbitalDistanceAU: "measured",
    orbitalPeriodDays: "measured",
    equilibriumTemperatureK: "derived",
    starTemperatureK: "measured",
  },
};
