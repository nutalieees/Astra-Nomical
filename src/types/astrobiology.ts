/**
 * Contracts for the staged astrobiology workflow.
 *
 * These models intentionally describe only agent outputs. The existing Planet
 * and PlanetEnvironment types remain the workflow inputs and are not repeated
 * here. JSON Schema constants are dependency-free and ready to supply to a
 * future structured-output integration.
 */

export type EnvironmentalSeverity = "low" | "moderate" | "high" | "extreme";

export interface EnvironmentalPressure {
  factor: string;
  knownValue?: string;
  pressure: string;
  severity: EnvironmentalSeverity;
  evidence: string;
}

export interface CandidateAdaptation {
  environmentalPressure: string;
  consequence: string;
  adaptation: string;
  reasoning: string;
}

export interface OrganismMorphology {
  size: string;
  bodyPlan: string;
  locomotion: string;
  surfaceCovering: string;
  sensorySystems: string;
}

export interface CandidateOrganism {
  name: string;
  summary: string;
  morphology: OrganismMorphology;
  adaptations: CandidateAdaptation[];
  survivalStrategy: string;
}

export interface CritiqueResult {
  approved: boolean;
  rejectedTraits: {
    trait: string;
    reason: string;
  }[];
  revisions: string[];
}

export interface ValidatedOrganism {
  name: string;
  summary: string;
  morphology: OrganismMorphology;
  adaptations: CandidateAdaptation[];
  survivalStrategy: string;
  uncertainty: string[];
}

const STRING = { type: "string" } as const;

const MORPHOLOGY_PROPERTIES = {
  size: STRING,
  bodyPlan: STRING,
  locomotion: STRING,
  surfaceCovering: STRING,
  sensorySystems: STRING,
} as const;

const MORPHOLOGY_SCHEMA = {
  type: "object",
  properties: MORPHOLOGY_PROPERTIES,
  required: ["size", "bodyPlan", "locomotion", "surfaceCovering", "sensorySystems"],
  additionalProperties: false,
} as const;

const ADAPTATION_PROPERTIES = {
  environmentalPressure: STRING,
  consequence: STRING,
  adaptation: STRING,
  reasoning: STRING,
} as const;

const ADAPTATION_SCHEMA = {
  type: "object",
  properties: ADAPTATION_PROPERTIES,
  required: ["environmentalPressure", "consequence", "adaptation", "reasoning"],
  additionalProperties: false,
} as const;

/** Strict structured-output schema for a single identified environmental pressure. */
export const ENVIRONMENTAL_PRESSURE_SCHEMA = {
  type: "object",
  properties: {
    factor: STRING,
    knownValue: STRING,
    pressure: STRING,
    severity: { type: "string", enum: ["low", "moderate", "high", "extreme"] },
    evidence: STRING,
  },
  required: ["factor", "pressure", "severity", "evidence"],
  additionalProperties: false,
} as const;

/** Strict structured-output schema for a proposed organism and its adaptations. */
export const CANDIDATE_ORGANISM_SCHEMA = {
  type: "object",
  properties: {
    name: STRING,
    summary: STRING,
    morphology: MORPHOLOGY_SCHEMA,
    adaptations: { type: "array", items: ADAPTATION_SCHEMA },
    survivalStrategy: STRING,
  },
  required: ["name", "summary", "morphology", "adaptations", "survivalStrategy"],
  additionalProperties: false,
} as const;

/** Strict structured-output schema for the scientific critique stage. */
export const CRITIQUE_RESULT_SCHEMA = {
  type: "object",
  properties: {
    approved: { type: "boolean" },
    rejectedTraits: {
      type: "array",
      items: {
        type: "object",
        properties: { trait: STRING, reason: STRING },
        required: ["trait", "reason"],
        additionalProperties: false,
      },
    },
    revisions: { type: "array", items: STRING },
  },
  required: ["approved", "rejectedTraits", "revisions"],
  additionalProperties: false,
} as const;

/** Strict structured-output schema for the final, explicitly uncertain organism result. */
export const VALIDATED_ORGANISM_SCHEMA = {
  type: "object",
  properties: {
    name: STRING,
    summary: STRING,
    morphology: MORPHOLOGY_SCHEMA,
    adaptations: { type: "array", items: ADAPTATION_SCHEMA },
    survivalStrategy: STRING,
    uncertainty: { type: "array", items: STRING },
  },
  required: ["name", "summary", "morphology", "adaptations", "survivalStrategy", "uncertainty"],
  additionalProperties: false,
} as const;
