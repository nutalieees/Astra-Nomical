import { z } from "zod";
import { evolveLife } from "../../../lib/ai/evolveLife";
import { issueOrganismImageToken } from "../../../lib/ai/organism-image-ticket";
import { deriveEnvironment } from "../../../lib/astronomy/environment";
import { FEATURED_PLANETS } from "../../../lib/astronomy/planets-featured";
import { evolveLifeEventSchema, type EvolveLifeEvent } from "../../../lib/evolve-life/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Leave transport time to send a controlled error after the 180-second workflow deadline.
export const maxDuration = 210;

export async function POST(request: Request) {
  let name: string;
  try {
    if (Number(request.headers.get("content-length")) > 1024) throw new Error("Too large.");
    const body = await request.text();
    if (body.length > 1024) throw new Error("Too large.");
    name = z.object({ planetName: z.string().min(1).max(120) }).strict().parse(JSON.parse(body)).planetName;
  } catch {
    return Response.json({ error: "Select a valid featured world and retry." }, { status: 400 });
  }
  const planet = FEATURED_PLANETS.find((value) => value.name === name);
  if (!planet) return Response.json({ error: "This world is not available." }, { status: 400 });
  // Astronomical inputs come from the same local catalogue as the UI, never from client edits.
  const environment = deriveEnvironment(planet);
  const abort = new AbortController();
  let stopped = false;
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: EvolveLifeEvent) => {
        if (stopped) return;
        // Reject accidentally added private/internal fields before serialization.
        const checked = evolveLifeEventSchema.parse(event);
        controller.enqueue(encoder.encode(JSON.stringify(checked) + "\n"));
      };
      const close = () => {
        if (!stopped) { stopped = true; controller.close(); }
      };
      const disconnect = () => { abort.abort(); close(); };
      request.signal.addEventListener("abort", disconnect, { once: true });
      const heartbeat = setInterval(() => {
        try { send({ type: "heartbeat" }); } catch { disconnect(); }
      }, 10_000);
      cleanup = () => {
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", disconnect);
      };
      try {
        if (request.signal.aborted) { disconnect(); return; }
        const result = await evolveLife(planet, environment, {
          signal: abort.signal,
          onProgress: (progress) => send({ type: "progress", ...progress }),
        });
        if ("error" in result) send({ type: "error", error: result.error });
        else {
          let illustrationToken: string | undefined;
          try { illustrationToken = issueOrganismImageToken(planet, environment, result.organism); }
          catch { /* An optional illustration must never prevent the textual result. */ }
          send({ type: "result", result: { pressures: result.pressures, organism: result.organism, ...(illustrationToken ? { illustrationToken } : {}) } });
        }
      } catch {
        send({ type: "error", error: { code: "AGENT_FAILED", message: "The life simulation could not complete. Please retry.", retryable: true, diagnosticId: "stream-error" } });
      } finally {
        cleanup();
        close();
      }
    },
    cancel() { stopped = true; abort.abort(); cleanup(); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  } });
}
