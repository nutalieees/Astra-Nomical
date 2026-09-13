import { z } from "zod";
import { organismSceneSchema, type OrganismSceneSpec } from "./organism-scene";

const responseSchema = z.object({ scene: organismSceneSchema }).strict();
const errorSchema = z.object({ error: z.object({
  code: z.string(), message: z.string().min(1).max(2_000), retryable: z.boolean(), diagnosticId: z.string().max(200),
}).strict() }).strict();

export class OrganismSceneError extends Error {
  constructor(message: string, readonly retryable = true, readonly diagnosticId = "") {
    super(message);
    this.name = "OrganismSceneError";
  }
}

async function readResponse(response: Response): Promise<unknown> {
  const maxBytes = 96_000;
  if (!response.body) throw new OrganismSceneError("The organism model response was empty. Your analysis is still available.");
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body.cancel().catch(() => {});
    throw new OrganismSceneError("The organism model response exceeded its size limit. Please retry the 3D model.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      bytes += value?.byteLength ?? 0;
      if (bytes > maxBytes) throw new OrganismSceneError("The organism model response exceeded its size limit. Please retry the 3D model.");
      text += decoder.decode(value, { stream: !done });
      if (done) break;
    }
    return JSON.parse(text);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** The signed snapshot binds the illustration to the final, validated organism. */
export async function requestOrganismScene(token: string, signal: AbortSignal): Promise<OrganismSceneSpec> {
  const response = await fetch("/api/organism-scene", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), signal,
  });
  let payload: unknown;
  try { payload = await readResponse(response); } catch (error) {
    if (error instanceof OrganismSceneError) throw error;
    throw new OrganismSceneError("The model response was interrupted. Your organism analysis is still available.");
  }
  if (!response.ok) {
    const failure = errorSchema.safeParse(payload);
    if (failure.success) {
      const { message, retryable, diagnosticId } = failure.data.error;
      throw new OrganismSceneError(message, retryable, diagnosticId);
    }
    throw new OrganismSceneError("The 3D organism could not be created. Your analysis is still available.");
  }
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new OrganismSceneError("The organism model was incomplete. Please retry the 3D model.");
  return parsed.data.scene;
}
