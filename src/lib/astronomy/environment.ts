import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import {
  SOLAR_TEMPERATURE_K,
  EARTH_EQUILIBRIUM_TEMPERATURE_K,
  DEFAULT_ALBEDO_ASSUMPTION,
  SPECTRAL_TYPE_TEMPERATURE_K,
  MASS_RADIUS_ROCKY_COEFFICIENT,
  MASS_RADIUS_ROCKY_EXPONENT,
  MASS_RADIUS_SUBNEPTUNE_COEFFICIENT,
  MASS_RADIUS_SUBNEPTUNE_EXPONENT,
  TEMPERATURE_CATEGORY_THRESHOLDS_K,
  ATMOSPHERE_HEURISTIC,
  SAFE_DEFAULTS,
} from "./constants";

/**
 * deriveEnvironment(planet) — deterministic, reusable, no LLM involved.
 *
 * Implements the fallback hierarchy required by AGENTS.md section 4.6:
 *   1. measured value      (straight from the planet record)
 *   2. derived value        (computed from other measured fields)
 *   3. visual assumption    (a scientifically reasonable default, flagged)
 *   4. safe default         (guarantees no NaN / invalid color / blank scene)
 *
 * Every fallback used is appended to `assumptions` in plain language so the
 * UI can surface it, per AGENTS.md section 6 (Scientific Integrity).
 */
export function deriveEnvironment(planet: Planet): PlanetEnvironment {
  const assumptions: string[] = [];

  // --- 1. Resolve star temperature (measured -> spectral-type lookup -> safe default) ---
  let starTemperatureK = planet.starTemperatureK;
  if (starTemperatureK == null || !isFinite(starTemperatureK)) {
    const cls = planet.starSpectralType?.trim().charAt(0).toUpperCase();
    if (cls && SPECTRAL_TYPE_TEMPERATURE_K[cls] != null) {
      starTemperatureK = SPECTRAL_TYPE_TEMPERATURE_K[cls];
      assumptions.push(
        `Star temperature not measured — estimated ${starTemperatureK}K from spectral type "${planet.starSpectralType}".`
      );
    } else {
      starTemperatureK = SAFE_DEFAULTS.starTemperatureK;
      assumptions.push(
        `Star temperature and spectral type both unknown — defaulted to a Sun-like ${starTemperatureK}K.`
      );
    }
  }

  // --- 2. Resolve star radius (measured -> safe default) ---
  let starRadiusSolar = planet.starRadiusSolar;
  if (starRadiusSolar == null || !isFinite(starRadiusSolar) || starRadiusSolar <= 0) {
    starRadiusSolar = SAFE_DEFAULTS.starRadiusSolar;
    assumptions.push(`Star radius unknown — defaulted to 1 solar radius.`);
  }

  // --- 3. Resolve orbital distance (measured -> safe default) ---
  let orbitalDistanceAU = planet.orbitalDistanceAU;
  if (orbitalDistanceAU == null || !isFinite(orbitalDistanceAU) || orbitalDistanceAU <= 0) {
    orbitalDistanceAU = SAFE_DEFAULTS.orbitalDistanceAU;
    assumptions.push(`Orbital distance unknown — defaulted to 1 AU (Earth-equivalent).`);
  }

  // --- 4. Illumination relative to Earth: (L/Lsun) / a^2, with L/Lsun via Stefan-Boltzmann ---
  const relativeLuminosity =
    Math.pow(starRadiusSolar, 2) * Math.pow(starTemperatureK / SOLAR_TEMPERATURE_K, 4);
  let illumination = relativeLuminosity / Math.pow(orbitalDistanceAU, 2);
  if (!isFinite(illumination) || illumination <= 0) {
    illumination = SAFE_DEFAULTS.illumination;
    assumptions.push(`Illumination could not be computed from available data — defaulted to 1.0 (Earth-equivalent).`);
  }

  // --- 5. Equilibrium temperature (measured -> derived from illumination -> safe default) ---
  let equilibriumTemperatureK = planet.equilibriumTemperatureK;
  if (equilibriumTemperatureK == null || !isFinite(equilibriumTemperatureK) || equilibriumTemperatureK <= 0) {
    equilibriumTemperatureK =
      EARTH_EQUILIBRIUM_TEMPERATURE_K *
      Math.pow(illumination * (1 - DEFAULT_ALBEDO_ASSUMPTION) / (1 - DEFAULT_ALBEDO_ASSUMPTION), 0.25);
    // (albedo cancels here since we assume Earth-like albedo for both sides; kept
    // explicit for readability and in case a per-planet albedo is added later)
    assumptions.push(
      `Equilibrium temperature not measured — derived from insolation, assuming Earth-like (0.3) albedo: ~${Math.round(
        equilibriumTemperatureK
      )}K.`
    );
  }

  // --- 6. Gravity (measured mass+radius -> derived mass from radius -> safe default) ---
  let gravityEarth: number;
  const radiusEarth = planet.radiusEarth;
  let massEarth = planet.massEarth;

  if (massEarth != null && isFinite(massEarth) && radiusEarth != null && isFinite(radiusEarth) && radiusEarth > 0) {
    gravityEarth = massEarth / Math.pow(radiusEarth, 2);
  } else if (radiusEarth != null && isFinite(radiusEarth) && radiusEarth > 0) {
    if (radiusEarth <= 1.5) {
      massEarth = MASS_RADIUS_ROCKY_COEFFICIENT * Math.pow(radiusEarth, MASS_RADIUS_ROCKY_EXPONENT);
      assumptions.push(
        `Mass not measured — estimated from radius using a rocky-planet mass-radius relation empirically fit to the NASA Exoplanet Archive (M ≈ ${MASS_RADIUS_ROCKY_COEFFICIENT} × R^${MASS_RADIUS_ROCKY_EXPONENT}).`
      );
    } else if (radiusEarth <= 4) {
      massEarth =
        MASS_RADIUS_SUBNEPTUNE_COEFFICIENT * Math.pow(radiusEarth, MASS_RADIUS_SUBNEPTUNE_EXPONENT);
      assumptions.push(
        `Mass not measured — estimated from radius using a sub-Neptune mass-radius relation.`
      );
    } else {
      // Gas-giant regime: mass-radius relation is not monotonic/reliable here.
      // Report an approximate "cloud-top" gravity instead of a false-precision mass estimate.
      massEarth = radiusEarth * 10; // rough giant-planet scaling, flagged low-confidence
      assumptions.push(
        `Planet radius suggests a gas giant — mass-radius relations are unreliable in this regime. Gravity shown is a rough cloud-top approximation, not a measured surface value (gas giants have no solid surface).`
      );
    }
    gravityEarth = massEarth / Math.pow(radiusEarth, 2);
  } else {
    gravityEarth = SAFE_DEFAULTS.gravityEarth;
    assumptions.push(`Radius and mass both unknown — gravity defaulted to 1.0 (Earth-equivalent).`);
  }

  if (!isFinite(gravityEarth) || gravityEarth <= 0) {
    gravityEarth = SAFE_DEFAULTS.gravityEarth;
    assumptions.push(`Computed gravity was invalid — defaulted to 1.0 (Earth-equivalent).`);
  }

  // --- 7. Star color from temperature (blackbody approximation) ---
  const starColor = kelvinToCssColor(starTemperatureK) ?? SAFE_DEFAULTS.starColor;
  if (starColor === SAFE_DEFAULTS.starColor && starTemperatureK !== SOLAR_TEMPERATURE_K) {
    assumptions.push(`Star color approximation failed — defaulted to a neutral warm-white.`);
  }

  // --- 8. Apparent star size relative to how the Sun looks from Earth ---
  let apparentStarSize = starRadiusSolar / orbitalDistanceAU;
  if (!isFinite(apparentStarSize) || apparentStarSize <= 0) {
    apparentStarSize = SAFE_DEFAULTS.apparentStarSize;
    assumptions.push(`Apparent star size could not be computed — defaulted to 1.0 (Sun-from-Earth-equivalent).`);
  }

  // --- 9. Temperature category bucket ---
  const temperatureCategory = categorizeTemperature(equilibriumTemperatureK);

  // --- 10. Atmosphere preset (explicitly a visual scenario, not a scientific claim) ---
  const atmospherePreset = pickAtmospherePreset(gravityEarth, equilibriumTemperatureK, radiusEarth);
  assumptions.push(
    `Atmosphere shown as a "${atmospherePreset}" visual preset — actual atmospheric composition is not measurable from these parameters and is not claimed as fact.`
  );

  return {
    gravityEarth: round(gravityEarth, 3),
    starColor,
    apparentStarSize: round(apparentStarSize, 3),
    illumination: round(illumination, 3),
    temperatureCategory,
    atmospherePreset,
    assumptions,
  };
}

// --- Helpers ---

function categorizeTemperature(tempK: number): PlanetEnvironment["temperatureCategory"] {
  const t = TEMPERATURE_CATEGORY_THRESHOLDS_K;
  if (!isFinite(tempK)) return "temperate";
  if (tempK < t.frozen) return "frozen";
  if (tempK < t.cold) return "cold";
  if (tempK < t.temperate) return "temperate";
  if (tempK < t.hot) return "hot";
  return "extreme";
}

function pickAtmospherePreset(
  gravityEarth: number,
  equilibriumTemperatureK: number,
  radiusEarth: number | undefined
): PlanetEnvironment["atmospherePreset"] {
  const h = ATMOSPHERE_HEURISTIC;
  if (
    gravityEarth < h.airlessGravityBelow ||
    equilibriumTemperatureK > h.airlessTempAbove
  ) {
    return "airless";
  }
  if ((radiusEarth ?? 0) > h.denseRadiusAboveEarthRadii || gravityEarth > h.denseGravityAbove) {
    return "dense";
  }
  if (gravityEarth < h.thinGravityBelow) {
    return "thin";
  }
  return "earthlike";
}

/**
 * Approximate blackbody-temperature-to-RGB conversion (Tanner Helland's
 * widely-used piecewise fit), clamped to a safe CSS hex string.
 * Returns null only if the math genuinely produces a non-finite result,
 * in which case the caller applies a safe default.
 */
function kelvinToCssColor(kelvin: number): string | null {
  if (!isFinite(kelvin)) return null;
  const temp = clamp(kelvin, 1000, 40000) / 100;

  let r: number, g: number, b: number;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
  }

  // Green
  if (temp <= 66) {
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
  }

  // Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }

  const rr = Math.round(clamp(r, 0, 255));
  const gg = Math.round(clamp(g, 0, 255));
  const bb = Math.round(clamp(b, 0, 255));

  if (!isFinite(rr) || !isFinite(gg) || !isFinite(bb)) return null;

  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}
