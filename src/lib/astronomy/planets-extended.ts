import type { Planet } from "../../types/planet";
import extendedData from "./planets-extended.json";

/**
 * The full remainder of the NASA Exoplanet Archive's confirmed-planet
 * composite table (pscomppars), fetched 2026-09-12 — every confirmed
 * planet NOT already in planets-featured.ts or planets-buffer.ts, and
 * with at least a measured radius (50 planets with no radius on file at
 * all were dropped; see README.md for the exact count).
 *
 * This is real, sourced data — not a scaffold. Shipped as JSON (not a .ts
 * literal) because at 6,271 entries / ~2.2MB, a hand-authored TypeScript
 * array would be a slow-to-compile, slow-to-diff liability for no benefit.
 * Import this module to get it back out as typed `Planet[]`.
 *
 * Unlike the curated 45, these entries do NOT have a hand-written
 * `notableFact`, and `name`/`starName` are the archive's own strings
 * verbatim (not cleaned up into nicer display names). `category` is
 * auto-derived from radius/temperature/discovery method — see
 * scripts/classify used to build this file, documented in README.md.
 */
export const EXTENDED_PLANETS: Planet[] = extendedData as Planet[];

export function extendedCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of EXTENDED_PLANETS) {
    const key = p.category ?? "uncategorized";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
