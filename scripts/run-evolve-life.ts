import { loadEnvConfig } from "@next/env";
import { evolveLife } from "../src/lib/ai/evolveLife";
import { FEATURED_PLANETS } from "../src/lib/astronomy/planets-featured";
import { deriveEnvironment } from "../src/lib/astronomy/environment";

async function main() {
  loadEnvConfig(process.cwd());
  const worlds = FEATURED_PLANETS.filter((planet) => ["TRAPPIST-1 e", "55 Cancri e"].includes(planet.name));
  if (worlds.length !== 2) throw new Error("The two comparison worlds are missing from the featured dataset.");
  const runs = [];
  for (const planet of worlds) {
    const environment = deriveEnvironment(planet);
    runs.push({ planet: planet.name, environment, result: await evolveLife(planet, environment) });
  }
  const [first, second] = runs;
  if ("error" in first.result || "error" in second.result) {
    console.log(JSON.stringify({ runs, comparison: { status: "incomplete", reason: "Both workflows must succeed before comparing organisms." } }, null, 2));
    process.exitCode = 1;
    return;
  }
  const a = first.result.organism;
  const b = second.result.organism;
  const differentFields = [
    ...Object.keys(a.morphology).filter((key) => a.morphology[key as keyof typeof a.morphology] !== b.morphology[key as keyof typeof b.morphology]).map((key) => `morphology.${key}`),
    ...(JSON.stringify(a.adaptations) !== JSON.stringify(b.adaptations) ? ["adaptations"] : []),
    ...(a.survivalStrategy !== b.survivalStrategy ? ["survivalStrategy"] : []),
  ];
  // Show causal chains for human review; string differences alone are not proof
  // that a real model reasoned correctly or that an organism is scientifically viable.
  const links = runs.map(({ planet, result }) => ({ planet,
    adaptations: "error" in result ? [] : result.organism.adaptations.map((adaptation) => ({
      pressure: result.pressures.find((pressure) => pressure.factor === adaptation.environmentalPressure),
      adaptation: adaptation.adaptation, reasoning: adaptation.reasoning,
    })),
  }));
  console.log(JSON.stringify({ runs, comparison: {
    status: differentFields.length > 0 ? "different" : "identical",
    differentFields, links,
    note: "Review the linked pressures and reasoning to assess whether differences follow from the supplied environments. This is not a scientific viability test.",
  } }, null, 2));
  if (differentFields.length === 0) process.exitCode = 1;
}

main().catch(() => {
  console.error("The Evolve Life comparison helper could not complete.");
  process.exitCode = 1;
});
