import "server-only";

import { randomUUID } from "node:crypto";
import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import type { EvolveLifeErrorCode, EvolveLifeProgress, EvolveLifeResult, EvolveLifeStage } from "../../types/evolve-life";
import { planetSchema, environmentSchema } from "./planet-context";
import { runPlanetScientist } from "./planet-scientist";
import { runEvolutionAgent } from "./evolution-agent";
import { runScientificCritic } from "./scientific-critic";
import { finalizeOrganism, OrganismValidationError } from "./finalize-organism";
import { abortable } from "./agent-execution";

export const EVOLVE_LIFE_TIMEOUT_MS = 180_000;
type Stage = "input" | EvolveLifeStage;
export interface EvolveLifeOptions {
  /** Optional request cancellation, passed through to each SDK run. */
  signal?: AbortSignal;
  /** May shorten, but not extend, the default overall deadline. */
  timeoutMs?: number;
  /** Public stage status only. Never receives model events, prompts or reasoning. */
  onProgress?: (progress: EvolveLifeProgress) => void;
}

const errors: Record<EvolveLifeErrorCode, { message: string; retryable: boolean }> = {
  INVALID_INPUT: { message: "The planetary inputs are invalid. Please select the world again.", retryable: false },
  NOT_CONFIGURED: { message: "Evolve Life is not configured on the server yet.", retryable: false },
  TIMEOUT: { message: "Evolve Life took too long. Please try again.", retryable: true },
  CANCELLED: { message: "Evolve Life was cancelled.", retryable: false },
  AGENT_FAILED: { message: "Evolve Life could not complete. Please try again.", retryable: true },
  SCIENTIFIC_REVIEW_FAILED: { message: "The proposed life did not pass scientific review. Please try again.", retryable: true },
};

/** Single server-side entry point. Success is exactly the four inspectable outputs. */
export async function evolveLife(
  planet: Planet,
  environment: PlanetEnvironment,
  options: EvolveLifeOptions = {},
): Promise<EvolveLifeResult> {
  const diagnosticId = randomUUID();
  const started = Date.now();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stage: Stage = "input";
  let signal = controller.signal;

  // Only bounded diagnostic metadata is logged. Never log raw prompts, output
  // prose, API errors, headers, API keys, or arbitrary input strings.
  const log = (event: string, details: Record<string, string | number | boolean> = {}) => {
    try {
      console.error(JSON.stringify({ component: "evolve-life", diagnosticId, event, stage,
        elapsedMs: Date.now() - started, ...details }));
    } catch { /* A logging sink failure must not fail an otherwise valid run. */ }
  };
  const failure = (code: EvolveLifeErrorCode): EvolveLifeResult => {
    log("failed", { code });
    return { error: { code, ...errors[code], diagnosticId } };
  };
  const progress = (stage: EvolveLifeStage, status: EvolveLifeProgress["status"]) => {
    try { options.onProgress?.({ stage, status }); } catch { /* Observers cannot change agent execution. */ }
  };
  const runStage = async <T>(name: EvolveLifeStage, run: () => Promise<T>, metrics: (value: T) => Record<string, number | boolean>) => {
    signal.throwIfAborted();
    stage = name;
    const stageStarted = Date.now();
    log("stage_started");
    progress(name, "running");
    const value = await abortable(run, signal);
    signal.throwIfAborted();
    log("stage_completed", { stageMs: Date.now() - stageStarted, ...metrics(value) });
    progress(name, "complete");
    return value;
  };

  log("started");
  try {
    const timeoutMs = options.timeoutMs ?? EVOLVE_LIFE_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > EVOLVE_LIFE_TIMEOUT_MS) {
      return failure("INVALID_INPUT");
    }
    signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
    signal.throwIfAborted();
    timer = setTimeout(() => controller.abort(new DOMException("Workflow deadline exceeded.", "TimeoutError")), timeoutMs);

    // One immutable snapshot supplies every stage, even if a caller changes its objects later.
    const fixedPlanet = planetSchema.parse(planet) as Planet;
    const fixedEnvironment = environmentSchema.parse(environment);
    if (!process.env.OPENAI_API_KEY?.trim()) return failure("NOT_CONFIGURED");
    const execution = { signal };
    const pressures = await runStage("scientist",
      () => runPlanetScientist(fixedPlanet, fixedEnvironment, execution),
      (value) => ({ pressureCount: value.length }));
    const candidate = await runStage("evolution",
      () => runEvolutionAgent(fixedPlanet, fixedEnvironment, pressures, execution),
      (value) => ({ adaptationCount: value.adaptations.length }));
    const critique = await runStage("critic",
      () => runScientificCritic(fixedPlanet, fixedEnvironment, pressures, candidate, execution),
      (value) => ({ approved: value.approved, rejectedTraitCount: value.rejectedTraits.length }));
    const organism = await runStage("finalize",
      () => finalizeOrganism(fixedPlanet, fixedEnvironment, pressures, candidate, critique, execution),
      (value) => ({ adaptationCount: value.adaptations.length, uncertaintyCount: value.uncertainty.length }));
    log("completed");
    return { pressures, candidate, critique, organism };
  } catch (error) {
    if (controller.signal.aborted) return failure("TIMEOUT");
    if (options.signal?.aborted) return failure("CANCELLED");
    if (error instanceof Error && error.name === "TimeoutError") return failure("TIMEOUT");
    if (error instanceof OrganismValidationError) {
      log("review_rejected", { rejectedTraitCount: error.critique.rejectedTraits.length });
      return failure("SCIENTIFIC_REVIEW_FAILED");
    }
    return failure(stage === "input" ? "INVALID_INPUT" : "AGENT_FAILED");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    // Stop any still-running call on every exit path, without starting another stage.
    controller.abort();
  }
}
