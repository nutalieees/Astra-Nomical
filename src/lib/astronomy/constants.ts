/**
 * Reference constants and lookup tables for deriveEnvironment().
 * Every numeric constant here is a well-established physical/astronomical
 * reference value (not fetched, not fitted to any specific planet) — safe
 * to hardcode.
 */

// --- Physical reference values ---

/** Sun's effective surface temperature in Kelvin. */
export const SOLAR_TEMPERATURE_K = 5778;

/** Earth's mean equilibrium temperature (zero-albedo blackbody estimate), Kelvin. */
export const EARTH_EQUILIBRIUM_TEMPERATURE_K = 255;

/** Earth's typical Bond albedo, used only as a default when a planet's albedo is unknown (always the case for these targets). */
export const DEFAULT_ALBEDO_ASSUMPTION = 0.3;

// --- Spectral type -> approximate effective temperature (K) ---
// Used ONLY as a fallback when starTemperatureK is missing but starSpectralType is known.
// Ranges are the commonly cited main-sequence temperature bands (Pecaut & Mamajek-style),
// collapsed to a single representative midpoint per broad class for simplicity.
export const SPECTRAL_TYPE_TEMPERATURE_K: Record<string, number> = {
  O: 35000,
  B: 20000,
  A: 8500,
  F: 6750,
  G: 5600,
  K: 4500,
  M: 3200,
};

// --- Mass-radius relation coefficients (Weiss & Marcy 2014-style piecewise fit) ---
// Used ONLY as a fallback when massEarth is missing but radiusEarth is known.
// This is a deterministic empirical fit, NOT a measurement — always flag it
// in `assumptions` when used.
export const MASS_RADIUS_ROCKY_EXPONENT = 3.7; // valid guide for R <= 1.5 R⊕
export const MASS_RADIUS_SUBNEPTUNE_COEFFICIENT = 2.69; // valid guide for 1.5 < R <= 4 R⊕
export const MASS_RADIUS_SUBNEPTUNE_EXPONENT = 0.93;

// --- Temperature category thresholds (Kelvin), applied to equilibrium temperature ---
// Deliberately stylized buckets for the HUD/visual system, not a scientific classification.
export const TEMPERATURE_CATEGORY_THRESHOLDS_K = {
  frozen: 220, // T < 220 => "frozen"
  cold: 260, // 220 <= T < 260 => "cold"
  temperate: 320, // 260 <= T < 320 => "temperate"
  hot: 500, // 320 <= T < 500 => "hot"
  // T >= 500 => "extreme"
};

// --- Atmosphere preset heuristic thresholds ---
// Stylized visual-scenario thresholds per AGENTS.md section 6 — atmospheric
// composition is generally NOT measurable from these parameters, so this
// is explicitly a "visual preset," never presented as a scientific claim.
export const ATMOSPHERE_HEURISTIC = {
  airlessGravityBelow: 0.3,
  airlessTempAbove: 1800,
  thinGravityBelow: 0.6,
  denseGravityAbove: 2.2,
  denseRadiusAboveEarthRadii: 6,
};

// --- Safe defaults (last-resort tier of the fallback hierarchy, AGENTS.md 4.6) ---
export const SAFE_DEFAULTS = {
  gravityEarth: 1,
  starColor: "#fff4e8",
  apparentStarSize: 1,
  illumination: 1,
  equilibriumTemperatureK: EARTH_EQUILIBRIUM_TEMPERATURE_K,
  orbitalDistanceAU: 1,
  starRadiusSolar: 1,
  starTemperatureK: SOLAR_TEMPERATURE_K,
};
