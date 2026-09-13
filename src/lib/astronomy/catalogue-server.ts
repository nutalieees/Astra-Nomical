import "server-only";
import type { Planet } from "../../types/planet";
import { FEATURED_PLANETS, FEATURED_PLANETS_PROVENANCE } from "./planets-featured";
import { BUFFER_PLANETS } from "./planets-buffer";
import { EXTENDED_PLANETS } from "./planets-extended";
import { planetSchema } from "../ai/planet-context";
import { preparePlanetWorld } from "./prepared-world";

const records = [...FEATURED_PLANETS, ...BUFFER_PLANETS, ...EXTENDED_PLANETS];
const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
const index = new Map<string, Planet[]>();
for (const planet of records) index.set(key(planet.name), [...(index.get(key(planet.name)) ?? []), planet]);

/** Exact normalized catalogue name is the identifier. Ambiguous matches fail closed. */
export function resolveCatalogueWorld(name: string) {
  const matches = index.get(key(name));
  if (!matches || matches.length !== 1) throw new Error("Planet not found or ambiguous.");
  const record = matches[0];
  const clean: Record<string, unknown> = { name: record.name };
  const rejected: string[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (field === "name" || value == null) continue;
    const schema = planetSchema.shape[field as keyof typeof planetSchema.shape];
    if (schema?.safeParse(value).success) clean[field] = value;
    else rejected.push(field);
  }
  const world = preparePlanetWorld(planetSchema.parse(clean) as Planet, FEATURED_PLANETS_PROVENANCE[record.name]);
  if (rejected.length) {
    const note = `Invalid cached fields omitted, not replaced in the source record: ${rejected.join(", ")}.`;
    world.environment.assumptions.push(note);
    world.visualEnvironment.assumptions.push(note);
  }
  return world;
}

export function searchCatalogue(query: string) {
  const q = key(query).slice(0, 120);
  return records.filter(p => (!q || key(p.name).includes(q)) && index.get(key(p.name))?.length === 1)
    .slice(0, 20).map(p => ({ name: p.name, starName: p.starName ?? null }));
}
