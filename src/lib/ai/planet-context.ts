import "server-only";

import { z } from "zod";

// Shared input validation only; neither agent depends on the other's runtime.
// Strip extra runtime properties and reject invalid supplied numbers.
const positive = z.number().finite().positive().optional();
export const planetSchema = z.object({
  name: z.string().min(1),
  radiusEarth: positive, massEarth: positive, orbitalDistanceAU: positive,
  orbitalPeriodDays: positive, equilibriumTemperatureK: positive,
  starName: z.string().optional(), starRadiusSolar: positive, starTemperatureK: positive,
  starSpectralType: z.string().optional(), distanceLightYears: positive,
  discoveryYear: z.number().finite().optional(), discoveryMethod: z.string().optional(),
  starMassSolar: positive, orbitalEccentricity: z.number().finite().min(0).max(1).optional(),
  notableFact: z.string().optional(), category: z.string().optional(),
});
export const environmentSchema = z.object({
  gravityEarth: z.number().finite().positive(),
  starColor: z.string(), apparentStarSize: z.number().finite().nonnegative(),
  illumination: z.number().finite().nonnegative(),
  temperatureCategory: z.enum(["frozen", "cold", "temperate", "hot", "extreme"]),
  atmospherePreset: z.enum(["airless", "thin", "earthlike", "dense"]),
  assumptions: z.array(z.string()),
});
