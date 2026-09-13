"use client";
import { useEffect, useRef, useState } from "react";
import type { PreparedWorld } from "../../lib/astronomy/prepared-world";

export function CatalogueSearch({ onPrepared }: { onPrepared: (world: PreparedWorld) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ name: string; starName: string | null }[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const preparation = useRef<AbortController | null>(null);
  useEffect(() => () => preparation.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/prepare-world?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) { setResults(data.planets); setError(""); }
      } catch { if (!controller.signal.aborted) setError("Catalogue unavailable. The five featured worlds still work."); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  async function select(planetName: string) {
    preparation.current?.abort();
    const controller = new AbortController();
    preparation.current = controller;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/prepare-world", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planetName }), signal: controller.signal });
      if (!response.ok) throw new Error();
      const { world } = await response.json();
      if (!controller.signal.aborted) onPrepared(world);
    } catch { if (!controller.signal.aborted) setError("World preparation failed. Select the planet again to retry."); }
    finally { if (!controller.signal.aborted) setPending(false); }
  }
  return <details className="catalogue-search">
    <summary>EXPLORE MORE REAL WORLDS</summary>
    <label htmlFor="catalogue-query">Search the local NASA catalogue</label>
    <input id="catalogue-query" value={query} maxLength={120} placeholder="Try TRAPPIST-1 f" onChange={event => setQuery(event.target.value)} />
    <p>Real archive data · illustrative terrain and atmosphere</p>
    {error && <p role="alert">{error}</p>}
    {pending && <p role="status">Preparing world…</p>}
    <div className="catalogue-results">
      {results.map(result => <button type="button" key={result.name} disabled={pending} onClick={() => select(result.name)}>{result.name}</button>)}
      {!results.length && !error && <p>No matching records.</p>}
    </div>
  </details>;
}
