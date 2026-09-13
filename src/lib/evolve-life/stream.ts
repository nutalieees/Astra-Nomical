import { z } from "zod";

// Client-safe transport whitelist. No SDK types, run history or internal review ledger.
const text = z.string().min(1);
const pressure = z.object({
  factor: text, knownValue: text.optional(), pressure: text,
  severity: z.enum(["low", "moderate", "high", "extreme"]), evidence: text,
}).strict();
const result = z.object({
  pressures: z.array(pressure).min(3).max(6),
  organism: z.object({
    name: text, summary: text,
    morphology: z.object({ size: text, bodyPlan: text, locomotion: text, surfaceCovering: text, sensorySystems: text }).strict(),
    adaptations: z.array(z.object({ environmentalPressure: text, consequence: text, adaptation: text, reasoning: text }).strict()).min(1).max(8),
    survivalStrategy: text, uncertainty: z.array(text).min(1),
  }).strict(),
}).strict().refine((value) => value.organism.adaptations.every((adaptation) =>
  value.pressures.some((item) => item.factor === adaptation.environmentalPressure)), "Unknown adaptation pressure.");

export const evolveLifeEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("progress"), stage: z.enum(["scientist", "evolution", "critic", "finalize"]), status: z.enum(["running", "complete"]) }).strict(),
  z.object({ type: z.literal("result"), result }).strict(),
  z.object({ type: z.literal("error"), error: z.object({
    code: z.enum(["INVALID_INPUT", "NOT_CONFIGURED", "TIMEOUT", "CANCELLED", "AGENT_FAILED", "SCIENTIFIC_REVIEW_FAILED"]),
    message: text, retryable: z.boolean(), diagnosticId: text,
  }).strict() }).strict(),
  z.object({ type: z.literal("heartbeat") }).strict(),
]);
export type EvolveLifeEvent = z.infer<typeof evolveLifeEventSchema>;
export type OrganismResult = z.infer<typeof result>;

/** Decode only our JSON event protocol, including split UTF-8/network chunks. */
export async function readEvolveLifeStream(response: Response, onEvent: (event: EvolveLifeEvent) => void) {
  if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("application/x-ndjson")) {
    throw new Error("The life simulation could not connect. Please retry.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = evolveLifeEventSchema.parse(JSON.parse(line));
    if (event.type !== "heartbeat") onEvent(event);
    terminal = event.type === "result" || event.type === "error";
  };
  try {
    while (!terminal) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 1_000_000) throw new Error("Simulation response exceeded its limit.");
      let end;
      while (!terminal && (end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        consume(line);
      }
      if (done) {
        if (!terminal && buffer.trim()) consume(buffer);
        break;
      }
    }
    if (!terminal) throw new Error("The simulation connection ended early. Please retry.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
