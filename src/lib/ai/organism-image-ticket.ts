import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import type { ValidatedOrganism } from "../../types/astrobiology";
import { validatedOrganismSchema } from "../evolve-life/stream";
import { planetSchema, environmentSchema } from "./planet-context";

export const ORGANISM_IMAGE_TOKEN_TTL_MS = 30 * 60_000;
export const organismImageContextSchema = z.object({
  planet: planetSchema, environment: environmentSchema, organism: validatedOrganismSchema,
}).strict();
const ticketSchema = organismImageContextSchema.extend({ expiresAt: z.number().int().positive() }).strict();

function signature(payload: string) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("Illustration signing is unavailable.");
  // A domain-separated MAC, never the credential itself. Works across serverless workers.
  return createHmac("sha256", key).update("astra-organism-illustration-v1\0").update(payload).digest();
}

/** Issued only after final scientific approval; no drafts or review history enter the ticket. */
export function issueOrganismImageToken(planet: Planet, environment: PlanetEnvironment, organism: ValidatedOrganism) {
  const context = organismImageContextSchema.parse({ planet, environment, organism });
  const payload = Buffer.from(JSON.stringify({ ...context, expiresAt: Date.now() + ORGANISM_IMAGE_TOKEN_TTL_MS })).toString("base64url");
  if (payload.length > 99_000) throw new Error("Illustration context is too large.");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

/** A caller cannot swap the final organism or inject a different environment or prompt. */
export function readOrganismImageToken(token: string) {
  if (token.length > 100_000) throw new Error("Invalid illustration request.");
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(supplied)) {
    throw new Error("Invalid illustration request.");
  }
  const expected = signature(payload), received = Buffer.from(supplied, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("Invalid illustration request.");
  const ticket = ticketSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  if (ticket.expiresAt <= Date.now()) throw new Error("Illustration request expired.");
  return { planet: ticket.planet as Planet, environment: ticket.environment, organism: ticket.organism };
}
