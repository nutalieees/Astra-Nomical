import type { Planet, PlanetFieldProvenance } from "../../types/planet";
import { deriveEnvironment } from "./environment";
import { deriveVisualEnvironment } from "./visual-environment";
import { FEATURED_SKY_SLUGS } from "./cached-sky";

/** Pure preparation, shared by the UI and the server. Never writes catalogue data. */
export function preparePlanetWorld(planet: Planet, provenance: PlanetFieldProvenance = {}) {
  const snapshot = { ...planet };
  const environment = deriveEnvironment(snapshot);
  environment.assumptions.push(
    "Archive values are not automatically direct measurements. Fields without provenance qualifiers have unknown measurement status; mass/radius estimates may be present.",
    ...Object.entries(provenance).map(([field, status]) => `Input provenance: ${field} is ${status}.`),
  );
  const visualEnvironment = deriveVisualEnvironment(snapshot, environment);
  // Use the actual scene scenario when reasoning about life, not a conflicting generic preset.
  environment.assumptions.push(`Rendered atmosphere scenario: ${visualEnvironment.atmosphereScenario}; this is illustrative, not observed.`);
  const missingFields = (["radiusEarth", "massEarth", "orbitalDistanceAU", "equilibriumTemperatureK", "starRadiusSolar", "starTemperatureK"] as const)
    .filter(field => snapshot[field] == null);
  function finite(value: unknown): boolean {
    if (typeof value === "number") return Number.isFinite(value);
    return !value || typeof value !== "object" || Object.values(value).every(finite);
  }
  if (!finite({ environment, visualEnvironment })) throw new Error("World contains invalid rendering parameters.");
  return {
    kind: "catalogue" as const, planet: snapshot, environment, visualEnvironment,
    provenance: { ...provenance }, missingFields,
    review: { approved: true as const, method: "deterministic-validation" as const,
      note: "Supported numerical rendering configuration, not scientific certification or proof of habitability." },
    sky: { mode: FEATURED_SKY_SLUGS[snapshot.name] ? "catalogue" as const : "illustrative" as const,
      reason: FEATURED_SKY_SLUGS[snapshot.name] ? "Prepared destination catalogue available." : "No prepared destination catalogue exists for this planet; stars are illustrative." },
  };
}
export type PreparedWorld = ReturnType<typeof preparePlanetWorld>;
