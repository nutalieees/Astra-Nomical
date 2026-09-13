"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OrganismImageError, requestOrganismImage, type OrganismImage } from "../../lib/evolve-life/organism-image-client";

type IllustrationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; image: OrganismImage }
  | { status: "error"; message: string; retryable: boolean; diagnosticId: string };

function decodeImage(dataUrl: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    const cleanup = () => { image.onload = null; image.onerror = null; signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); image.src = ""; reject(signal.reason); };
    if (signal.aborted) { reject(signal.reason); return; }
    signal.addEventListener("abort", abort, { once: true });
    image.onload = () => { cleanup(); resolve(); };
    image.onerror = () => { cleanup(); reject(new OrganismImageError("The illustration could not be displayed. Please retry the image.")); };
    image.src = dataUrl;
  });
}

/** Kept in the parent panel so minimizing the visual does not cancel its request. */
export function useOrganismIllustration(token: string | undefined, automatic: boolean) {
  const [result, setResult] = useState<{ token?: string; state: IllustrationState }>({ state: { status: "idle" } });
  const activeRequest = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);
  const generate = useCallback(async () => {
    cancel();
    if (!token) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const timer = window.setTimeout(() => controller.abort("timeout"), 130_000);
    setResult({ token, state: { status: "loading" } });
    try {
      const image = await requestOrganismImage(token, controller.signal);
      await decodeImage(image.dataUrl, controller.signal);
      if (activeRequest.current === controller && !controller.signal.aborted) setResult({ token, state: { status: "ready", image } });
    } catch (error) {
      if (activeRequest.current !== controller) return;
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      const failure = error instanceof OrganismImageError ? error : null;
      setResult({ token, state: { status: "error",
        message: controller.signal.reason === "timeout" ? "The illustration took too long. Your organism analysis is ready."
          : failure?.message ?? "The illustration connection was interrupted. Your organism analysis is ready.",
        retryable: failure?.retryable ?? true, diagnosticId: failure?.diagnosticId ?? "",
      } });
    } finally {
      window.clearTimeout(timer);
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }, [token, cancel]);
  useEffect(() => {
    setResult({ token, state: { status: "idle" } });
    if (automatic && token) void generate();
    return cancel;
  }, [token, automatic, generate, cancel]);
  const reportDisplayError = (dataUrl: string) => {
    setResult((current) => current.token === token && current.state.status === "ready" && current.state.image.dataUrl === dataUrl
      ? { token, state: { status: "error", message: "The illustration could not be displayed. Your analysis is still available.", retryable: true, diagnosticId: "" } }
      : current);
  };
  // Never show the previous organism's image while a new result starts its own request.
  const state: IllustrationState = result.token === token ? result.state : { status: "idle" };
  return { state, generate, cancel, reportDisplayError };
}

export function OrganismIllustration({ illustration, available }: {
  illustration: ReturnType<typeof useOrganismIllustration>; available: boolean;
}) {
  const { state, generate, reportDisplayError } = illustration;
  return <section className="organism-illustration" data-image-state={state.status} aria-label="Organism field illustration">
    <div className="organism-illustration-heading"><span>FIELD ILLUSTRATION</span><small>Optional · AI generated</small></div>
    {state.status === "loading" ? <div className="organism-image-loading" role="status" aria-live="polite">
      <span className="organism-image-reticle" aria-hidden="true"><i /><i /><i /></span>
      <div><strong>Illustrating the organism</strong><p>Your analysis is ready. The field illustration follows separately.</p></div>
    </div> : state.status === "ready" ? <figure className="organism-image-figure">
      {/* A private data URL is decoded locally; it does not need Next's image proxy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state.image.dataUrl} alt={state.image.alt} width={1024} height={1024} onError={() => reportDisplayError(state.image.dataUrl)} />
      <figcaption>Speculative concept · visual details remain uncertain.</figcaption>
    </figure> : state.status === "error" ? <div className="organism-image-error" role="status" aria-live="polite">
      <strong>Illustration unavailable</strong><p>{state.message}</p>
      {state.retryable && <button className="text-button" type="button" onClick={() => void generate()}>RETRY ILLUSTRATION <span aria-hidden="true">↻</span></button>}
      {state.diagnosticId && <small>Reference: {state.diagnosticId}</small>}
    </div> : available ? <div className="organism-image-optional">
      <p>Create a scientific concept image from this organism and its environment.</p>
      <button type="button" className="text-button" onClick={() => void generate()}>GENERATE ILLUSTRATION <span aria-hidden="true">↗</span></button>
    </div> : <p className="organism-image-unavailable">Illustration unavailable for this result. Your analysis is complete.</p>}
  </section>;
}
