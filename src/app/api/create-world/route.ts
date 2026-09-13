import { createWorld, createWorldRequestSchema } from "../../../lib/ai/world-creation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 260;

export async function POST(request: Request) {
  let input;
  try {
    if (Number(request.headers.get("content-length")) > 4096) throw new Error();
    const body = await request.text();
    if (body.length > 4096) throw new Error();
    input = createWorldRequestSchema.parse(JSON.parse(body));
  } catch {
    return Response.json({ error: { code: "INVALID_INPUT", message: "Supply a brief, supported host/world type and equilibrium temperature between 80 and 2200 K." } }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY?.trim()) return Response.json({ error: { code: "NOT_CONFIGURED", message: "World creation is not configured on the server." } }, { status: 503 });
  try {
    return Response.json(await createWorld(input, { signal: request.signal }), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: request.signal.aborted ? "CANCELLED" : "GENERATION_FAILED", message: "The world could not be completed. Please retry with different preferences." } }, { status: request.signal.aborted ? 408 : 502 });
  }
}
