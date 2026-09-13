import { z } from "zod";
import { resolveCatalogueWorld, searchCatalogue } from "../../../lib/astronomy/catalogue-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return Response.json({ planets: searchCatalogue(new URL(request.url).searchParams.get("q") ?? "") });
}
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 1024) throw new Error("Too large");
    const raw = await request.text();
    if (raw.length > 1024) throw new Error("Too large");
    const { planetName } = z.object({ planetName: z.string().min(1).max(120) }).strict().parse(JSON.parse(raw));
    return Response.json({ world: resolveCatalogueWorld(planetName) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Choose an unambiguous planet from the local catalogue." }, { status: 400 });
  }
}
