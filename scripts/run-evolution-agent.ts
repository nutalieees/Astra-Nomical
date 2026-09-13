import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { parseEvolutionPressures, runEvolutionAgent } from "../src/lib/ai/evolution-agent";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveEnvironment } from "../src/lib/astronomy/environment";
import scientistFixture from "../tests/fixtures/trappist-1e-scientist.json";

async function main() {
  loadEnvConfig(process.cwd());
  const planet = FEATURED_PLANETS.find((candidate) => candidate.name === "TRAPPIST-1 e");
  if (!planet) throw new Error("TRAPPIST-1 e is missing from the featured dataset.");

  // Accept a saved Scientist array to replay/debug Evolution without rerunning stage one.
  const pressureFile = process.argv[2];
  let raw: unknown = scientistFixture;
  if (pressureFile) {
    try { raw = JSON.parse(await readFile(pressureFile, "utf8")); }
    catch { throw new Error("Could not read the saved Scientist pressure JSON file."); }
  } else {
    console.error("Using the existing TRAPPIST-1 e Scientist test fixture (mocked output, not a live Scientist result).");
  }
  let pressures;
  try { pressures = parseEvolutionPressures(raw); }
  catch { throw new Error("Expected a validated TRAPPIST-1 e EnvironmentalPressure[] JSON array."); }
  const organism = await runEvolutionAgent(planet, deriveEnvironment(planet), pressures);
  console.log(JSON.stringify(organism, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Evolution Agent failed.");
  process.exitCode = 1;
});
