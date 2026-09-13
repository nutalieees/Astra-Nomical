import type { CandidateOrganism, CritiqueResult, EnvironmentalPressure, ValidatedOrganism } from "./astrobiology";

export interface EvolveLifeSuccess {
  pressures: EnvironmentalPressure[];
  candidate: CandidateOrganism;
  /** Review of the original candidate. Finalization also requires a fresh approval. */
  critique: CritiqueResult;
  organism: ValidatedOrganism;
}

export type EvolveLifeErrorCode =
  | "INVALID_INPUT" | "NOT_CONFIGURED" | "TIMEOUT" | "CANCELLED"
  | "AGENT_FAILED" | "SCIENTIFIC_REVIEW_FAILED";

export interface EvolveLifeFailure {
  error: {
    code: EvolveLifeErrorCode;
    message: string;
    retryable: boolean;
    diagnosticId: string;
  };
}

/** Narrow with `"error" in result`; partial agent outputs are never a success. */
export type EvolveLifeResult = EvolveLifeSuccess | EvolveLifeFailure;

export type EvolveLifeStage = "scientist" | "evolution" | "critic" | "finalize";
export interface EvolveLifeProgress {
  stage: EvolveLifeStage;
  status: "running" | "complete";
}
