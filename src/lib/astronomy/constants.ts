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

// --- Mass-radius relation coefficients ---
// Used ONLY as a fallback when massEarth is missing but radiusEarth is known.
// This is a deterministic empirical fit, NOT a measurement — always flag it
// in `assumptions` when used.
//
// RECALIBRATED 2026-09-12 against the full NASA Exoplanet Archive
// (pscomppars, n=6,366 confirmed planets) rather than taken from a single
// literature source. Method: log-log linear regression of pl_bmasse on
// pl_rade, fit separately for the rocky regime (R ≤ 1.5 R⊕, n=1,012 planets
// with both mass and radius on file) and the sub-Neptune regime
// (1.5 < R ≤ 4 R⊕, n=2,847). Caveat: the archive's "best mass" column mixes
// measurement types of very different quality (true dynamical mass, RV
// minimum mass m·sin i, TTV mass, and in some cases model-based estimates)
// — treat this as a practical empirical approximation, not a rigorously
// derived physical law. It was preferred over a single textbook relation
// (e.g. Weiss & Marcy 2014) because it is also more self-consistent at the
// regime boundary: at R=1.5 R⊕ the two pieces below agree to within ~7%
// (3.51 vs 3.28 M⊕), versus ~37% disagreement (6.19 vs 3.91 M⊕) using the
// literature piecewise fit previously used here. It also reproduces
// Neptune's own mass reasonably well at R≈3.86 R⊕ (~16.8 vs actual ~17.1 M⊕).
export const MASS_RADIUS_ROCKY_COEFFICIENT = 1.204; // valid guide for R <= 1.5 R⊕
export const MASS_RADIUS_ROCKY_EXPONENT = 2.569;
export const MASS_RADIUS_SUBNEPTUNE_COEFFICIENT = 1.685; // valid guide for 1.5 < R <= 4 R⊕
export const MASS_RADIUS_SUBNEPTUNE_EXPONENT = 1.654;

// --- Temperature category thresholds (Kelvin), applied to equilibrium temperature ---
// Deliberately stylized buckets for the HUD/visual system, anchored to
// absolute physical reference points (Earth ≈ 255K, Venus ≈ 232K measured
// equilibrium / ~740K actual surface, etc.) — NOT a scientific classification.
//
// Checked against the full archive population on 2026-09-12 and
// deliberately LEFT UNCHANGED: the population median equilibrium
// temperature is ~756K (most confirmed planets are close-in and hot, since
// that's what transit/RV surveys are best at detecting), so naively
// re-centering these thresholds on population percentiles would just be
// re-encoding detection bias as physics. These buckets describe how a
// planet's environment compares to Earth/Venus/Mercury in absolute terms,
// not how it compares to other detected exoplanets.
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
//
// Also checked against the full archive population on 2026-09-12 and left
// as physically-motivated absolutes rather than population percentiles:
// gravityEarth for archive-confirmed planets is heavily selection-biased
// toward higher values (p5 = 0.65g, p50 = 1.16g) because low-gravity small
// planets are the hardest to detect in the first place — using "5th
// percentile of what we've found" as the definition of "dangerously low
// gravity" would systematically understate how common truly low-gravity
// worlds actually are in the underlying population.
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
