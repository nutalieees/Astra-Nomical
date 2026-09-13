import { loadEnvConfig } from "@next/env";
import { runPlanetScientist } from "../src/lib/ai/planet-scientist";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveEnvironment } from "../src/lib/astronomy/environment";

async function main() {
  loadEnvConfig(process.cwd());
  const planet = FEATURED_PLANETS.find((candidate) => candidate.name === "TRAPPIST-1 e");
  if (!planet) throw new Error("TRAPPIST-1 e is missing from the featured dataset.");
  const pressures = await runPlanetScientist(planet, deriveEnvironment(planet));
  console.log(JSON.stringify(pressures, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Planet Scientist failed.");
  process.exitCode = 1;
});
