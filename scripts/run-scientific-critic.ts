import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { reviewAndFinalizeOrganism, OrganismValidationError } from "../src/lib/ai/finalize-organism";
import { criticContext } from "../src/lib/ai/scientific-critic";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveEnvironment } from "../src/lib/astronomy/environment";
import type { CandidateOrganism, EnvironmentalPressure } from "../src/types/astrobiology";
import pressuresFixture from "../tests/fixtures/trappist-1e-scientist.json";
import candidateFixture from "../tests/fixtures/trappist-1e-candidate.json";

async function main() {
  loadEnvConfig(process.cwd());
  const planet = FEATURED_PLANETS.find((value) => value.name === "TRAPPIST-1 e");
  if (!planet) throw new Error("TRAPPIST-1 e is missing from the featured dataset.");
  const environment = deriveEnvironment(planet);
  const [pressureFile, candidateFile] = process.argv.slice(2);
  if (Boolean(pressureFile) !== Boolean(candidateFile)) {
    throw new Error("Provide both pressure and candidate JSON files, or neither to use the test fixtures.");
  }
  let pressures: unknown = pressuresFixture;
  let candidate: unknown = candidateFixture;
  if (pressureFile && candidateFile) {
    try {
      pressures = JSON.parse(await readFile(pressureFile, "utf8"));
      candidate = JSON.parse(await readFile(candidateFile, "utf8"));
    } catch { throw new Error("Could not read saved TRAPPIST-1 e pressure and candidate JSON files."); }
  } else {
    console.error("Using TRAPPIST-1 e test fixtures, not live Scientist/Evolution results.");
  }
  let context;
  try {
    context = criticContext(planet, environment, pressures as EnvironmentalPressure[], candidate as CandidateOrganism);
  } catch { throw new Error("Expected EnvironmentalPressure[] and CandidateOrganism JSON matching the workflow contracts."); }
  const result = await reviewAndFinalizeOrganism(planet, environment, context.pressures, context.candidate);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  if (error instanceof OrganismValidationError) {
    console.error(JSON.stringify({ error: error.message, critique: error.critique }, null, 2));
  } else {
    console.error(error instanceof Error ? error.message : "Scientific review failed.");
  }
  process.exitCode = 1;
});
