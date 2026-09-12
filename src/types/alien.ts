/**
 * Structured output contract for "Evolve Life" (GPT-6 Astra).
 * Mirrors AGENTS.md section 5.2 exactly. This is a type stub only —
 * no prompt/model wiring here, that belongs in lib/ai/evolveLife.ts.
 */
export interface AlienSimulation {
  name: string;

  summary: string;

  traits: {
    trait: string;
    environmentalPressure: string;
    reasoning: string;
  }[];

  morphology: {
    bodyPlan: string;
    size: string;
    locomotion: string;
    surfaceCovering: string;
    sensorySystems: string;
  };

  survivalStrategy: string;

  /** Explicit list of what's speculative vs. grounded, per AGENTS.md section 6. */
  uncertainty: string[];
}
