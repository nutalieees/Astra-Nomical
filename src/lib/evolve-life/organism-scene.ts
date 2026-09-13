import { z } from "zod";

/** Bounded drawing instructions, never executable code or a claim of measured anatomy. */
export const organismSceneSchema = z.object({
  organization: z.enum(["multicellular", "colony", "unicellular"]),
  form: z.enum(["cushion", "segmented", "radial", "sheet", "cell"]),
  proportions: z.object({ length: z.number().min(0.3).max(4), width: z.number().min(0.3).max(4), height: z.number().min(0.12).max(3) }).strict(),
  surface: z.enum(["soft", "leathery", "plated", "mucous", "mineral"]),
  segments: z.number().int().min(3).max(12),
  appendages: z.object({ kind: z.enum(["none", "lobes", "legs", "cilia"]), count: z.number().int().min(0).max(12) }).strict(),
  senses: z.enum(["diffuse", "pits", "antennae"]),
  motion: z.enum(["sessile", "crawl", "undulate"]),
  activity: z.enum(["dormant", "conditional-active"]),
  scale: z.enum(["microscopic", "macroscopic", "unspecified"]),
  grounding: z.array(z.object({
    feature: z.enum(["organization", "form", "proportions", "surface", "appendages", "senses", "motion"]),
    quote: z.string().min(1).max(2000),
  }).strict()).length(7),
}).strict();

export type OrganismSceneSpec = z.infer<typeof organismSceneSchema>;
