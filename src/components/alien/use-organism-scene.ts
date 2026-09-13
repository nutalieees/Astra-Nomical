"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OrganismSceneError, requestOrganismScene } from "../../lib/evolve-life/organism-scene-client";
import type { OrganismSceneSpec } from "../../lib/evolve-life/organism-scene";

type SceneState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; scene: OrganismSceneSpec }
  | { status: "error"; message: string; retryable: boolean; diagnosticId: string };

/** Independent of the completed analysis, and kept alive while its panel is minimized. */
export function useOrganismScene(token: string | undefined, automatic: boolean) {
  const [result, setResult] = useState<{ token?: string; state: SceneState }>({ state: { status: "idle" } });
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
    const timer = window.setTimeout(() => controller.abort("timeout"), 75_000);
    setResult({ token, state: { status: "loading" } });
    try {
      const scene = await requestOrganismScene(token, controller.signal);
      if (activeRequest.current === controller && !controller.signal.aborted) {
        setResult({ token, state: { status: "ready", scene } });
      }
    } catch (error) {
      if (activeRequest.current !== controller) return;
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      const failure = error instanceof OrganismSceneError ? error : null;
      setResult({ token, state: {
        status: "error",
        message: controller.signal.reason === "timeout"
          ? "The 3D model took too long. Your organism analysis is ready."
          : failure?.message ?? "The model connection was interrupted. Your organism analysis is ready.",
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

  // A new organism must never briefly inherit the preceding model while effects reset.
  const state: SceneState = result.token === token ? result.state : { status: "idle" };
  return { state, generate, cancel };
}
