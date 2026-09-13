import { z } from "zod";

const imageResponseSchema = z.object({
  image: z.object({
    dataUrl: z.string().max(4_100_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/),
    alt: z.string().min(1).max(4_000),
  }).strict(),
}).strict();
const imageErrorSchema = z.object({ error: z.object({
  code: z.string(), message: z.string().min(1), retryable: z.boolean(), diagnosticId: z.string(),
}).strict() }).strict();

export type OrganismImage = z.infer<typeof imageResponseSchema>["image"];

export class OrganismImageError extends Error {
  constructor(message: string, readonly retryable = true, readonly diagnosticId = "") {
    super(message);
    this.name = "OrganismImageError";
  }
}

async function readBoundedResponse(response: Response): Promise<unknown> {
  const maxBytes = 4_200_000;
  if (!response.body) throw new OrganismImageError("The illustration response was empty. Please retry the image.");
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body.cancel().catch(() => {});
    throw new OrganismImageError("The illustration response exceeded its size limit. Please retry the image.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      bytes += value?.byteLength ?? 0;
      if (bytes > maxBytes) throw new OrganismImageError("The illustration response exceeded its size limit. Please retry the image.");
      text += decoder.decode(value, { stream: !done });
      if (done) break;
    }
    return JSON.parse(text);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** The signed token carries the validated snapshot; the browser supplies no editable prompt. */
export async function requestOrganismImage(token: string, signal: AbortSignal): Promise<OrganismImage> {
  const response = await fetch("/api/organism-image", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }), signal,
  });
  let payload: unknown;
  try { payload = await readBoundedResponse(response); } catch (error) {
    if (error instanceof OrganismImageError) throw error;
    throw new OrganismImageError("The illustration response was interrupted. Your analysis is still available.");
  }
  if (!response.ok) {
    const failure = imageErrorSchema.safeParse(payload);
    if (failure.success) {
      const { message, retryable, diagnosticId } = failure.data.error;
      throw new OrganismImageError(message, retryable, diagnosticId);
    }
    throw new OrganismImageError("The illustration could not be generated. Your analysis is still available.");
  }
  const parsed = imageResponseSchema.safeParse(payload);
  if (!parsed.success) throw new OrganismImageError("The illustration could not be displayed. Please retry the image.");
  return parsed.data.image;
}
