import { randomUUID } from "node:crypto";
import { z } from "zod";
import { readOrganismImageToken } from "../../../lib/ai/organism-image-ticket";
import { generateOrganismImage } from "../../../lib/ai/organism-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let context: ReturnType<typeof readOrganismImageToken>;
  try {
    if (Number(request.headers.get("content-length")) > 101_000) throw new Error("Too large.");
    const raw = await request.text();
    if (raw.length > 101_000) throw new Error("Too large.");
    const body = z.object({ token: z.string().min(1).max(100_000) }).strict().parse(JSON.parse(raw));
    context = readOrganismImageToken(body.token);
  } catch {
    return Response.json({ error: { code: "INVALID_INPUT", message: "This illustration request has expired or is unavailable. Your organism analysis is ready.", retryable: false, diagnosticId: randomUUID() } }, { status: 400, headers });
  }
  const result = await generateOrganismImage(context.planet, context.environment, context.organism, { signal: request.signal });
  return Response.json(result, { status: "image" in result ? 200 : result.error.code === "TIMEOUT" ? 504 : 503, headers });
}
