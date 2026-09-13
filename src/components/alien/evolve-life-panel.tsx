"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import type { EvolveLifeStage } from "../../types/evolve-life";
import { readEvolveLifeStream, type OrganismResult } from "../../lib/evolve-life/stream";

const stages: { id: EvolveLifeStage; title: string; agent: string; active: string; done: string }[] = [
  { id: "scientist", title: "ANALYSING WORLD", agent: "Planet Scientist", active: "Identifying environmental pressures", done: "Environmental pressures identified" },
  { id: "evolution", title: "EVOLVING LIFE", agent: "Evolution Agent", active: "Developing a coherent organism", done: "Candidate organism generated" },
  { id: "critic", title: "SCIENTIFIC REVIEW", agent: "Critic Agent", active: "Checking every adaptation", done: "Adaptations reviewed" },
  { id: "finalize", title: "FINAL VALIDATION", agent: "Scientific synthesis", active: "Refining the organism and checking it again", done: "Organism validated" },
];
type Phase = "idle" | "running" | "validated" | "complete" | "error";
type Progress = Partial<Record<EvolveLifeStage, "running" | "complete">>;

export function EvolveLifePanel({ planet }: { planet: Planet; environment: PlanetEnvironment }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<Progress>({});
  const [result, setResult] = useState<OrganismResult | null>(null);
  const [error, setError] = useState("");
  const [diagnosticId, setDiagnosticId] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const resultTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => { activeRequest.current?.abort(); }, []);
  useEffect(() => {
    if (phase !== "validated") return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 850;
    const timer = window.setTimeout(() => setPhase("complete"), delay);
    return () => window.clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase === "complete" && !collapsed) resultTitle.current?.focus({ preventScroll: true });
  }, [phase, collapsed]);

  const evolve = async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const timer = window.setTimeout(() => controller.abort("timeout"), 195_000);
    setPhase("running"); setProgress({}); setResult(null);
    setError(""); setDiagnosticId(""); setCollapsed(false);
    try {
      const response = await fetch("/api/evolve-life", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planetName: planet.name }), signal: controller.signal,
      });
      await readEvolveLifeStream(response, (event) => {
        if (controller.signal.aborted || activeRequest.current !== controller) return;
        if (event.type === "progress") {
          setProgress((current) => ({ ...current, [event.stage]: event.status }));
        } else if (event.type === "result") {
          setResult(event.result);
          setProgress({ scientist: "complete", evolution: "complete", critic: "complete", finalize: "complete" });
          setPhase("validated");
        } else if (event.type === "error") {
          setError(event.error.message); setDiagnosticId(event.error.diagnosticId); setPhase("error");
        }
      });
    } catch {
      if (activeRequest.current !== controller) return;
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      setError(controller.signal.reason === "timeout"
        ? "The life simulation took too long. Your world is still here—please retry."
        : "The connection to the life simulation was interrupted. Please retry.");
      setPhase("error");
    } finally {
      window.clearTimeout(timer);
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  };
  const cancel = () => {
    activeRequest.current?.abort(); activeRequest.current = null;
    setPhase("idle"); setProgress({});
  };
  const currentStage = stages.find((stage) => progress[stage.id] === "running");
  const completedCount = stages.filter((stage) => progress[stage.id] === "complete").length;
  const statusText = phase === "validated" ? "ORGANISM VALIDATED"
    : phase === "complete" ? "LIFE HYPOTHESIS READY"
    : phase === "error" ? "SIMULATION INTERRUPTED"
    : currentStage?.title ?? "CONNECTING TO ASTRA";

  return (
    <section className={`evolve-panel life-panel${collapsed ? " is-collapsed" : ""}`} data-state={phase} aria-label="Evolve Life">
      <div className="life-panel-heading">
        <span className="eyebrow"><i className={phase === "running" ? "life-beacon is-active" : "life-beacon"} aria-hidden="true" /> ASTRA BIOSPHERE LAB</span>
        {phase !== "idle" && <button type="button" className="life-icon-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand life panel" : "Minimize life panel"} aria-expanded={!collapsed}>{collapsed ? "↗" : "−"}</button>}
      </div>
      {collapsed ? (
        <button type="button" className="life-reopen" onClick={() => setCollapsed(false)}><span role="status">{statusText}</span><span aria-hidden="true">↗</span></button>
      ) : phase === "idle" ? (
        <div className="life-intro">
          <h2>What could adapt<br />to this world?</h2>
          <p>Follow the science from environment to possibility.</p>
          <button className="secondary-button" type="button" onClick={evolve}>EVOLVE LIFE <span aria-hidden="true">↗</span></button>
        </div>
      ) : phase === "complete" && result ? (
        <OrganismView result={result} titleRef={resultTitle} onRestart={evolve} />
      ) : (
        <div className="life-progress-view">
          <div className="life-progress-title" role="status" aria-live="polite" aria-atomic="true">
            <span className="life-step-count">{phase === "validated" ? "04 / 04" : `${String(Math.min(completedCount + 1, 4)).padStart(2, "0")} / 04`}</span>
            <h2>{statusText}</h2><p>{planet.name}</p>
          </div>
          {phase === "error" && <div className="life-error" role="alert">
            <p>{error}</p>
            <button type="button" className="secondary-button" onClick={evolve}>RETRY <span aria-hidden="true">↻</span></button>
            {diagnosticId && <small>Reference: {diagnosticId}</small>}
          </div>}
          <ol className="life-stages" aria-label="Simulation progress">
            {stages.map((stage, index) => {
              const status = progress[stage.id];
              const done = status === "complete" && (stage.id !== "finalize" || phase === "validated");
              return <li key={stage.id} className={done ? "is-done" : status === "running" ? "is-current" : "is-pending"} aria-current={status === "running" ? "step" : undefined}>
                <span className="life-stage-marker" aria-hidden="true">{done ? "✓" : String(index + 1).padStart(2, "0")}</span>
                <div><strong>{stage.agent}</strong><span>{done ? stage.done : status === "running" ? phase === "error" ? "Interrupted — ready to retry" : stage.active : "Awaiting previous stage"}</span></div>
              </li>;
            })}
          </ol>
          {phase === "error" ? null : phase === "validated" ? <p className="life-validation-note">Reviewed for consistency. Still a hypothesis.</p> : <div className="life-progress-footer">
            <span>You can keep exploring the world.</span>
            <button type="button" className="text-button" onClick={cancel}>CANCEL</button>
          </div>}
        </div>
      )}
    </section>
  );
}

function OrganismView({ result, titleRef, onRestart }: {
  result: OrganismResult; titleRef: RefObject<HTMLHeadingElement | null>; onRestart: () => void;
}) {
  const { organism, pressures } = result;
  const morphologyLabels = { size: "Size", bodyPlan: "Body plan", locomotion: "Locomotion", surfaceCovering: "Surface covering", sensorySystems: "Sensory systems" };
  return <div className="life-result">
    <div className="life-result-heading">
      <span className="life-reviewed">✓ ORGANISM VALIDATED</span>
      <h2 ref={titleRef} tabIndex={-1}>{organism.name}</h2>
      <p>Speculative life · reviewed for consistency</p>
    </div>
    <div className="life-result-scroll">
      <p className="life-summary">{organism.summary}</p>
      <div className="life-adaptations-heading"><span className="eyebrow">ENVIRONMENT → PRESSURE → ADAPTATION</span><span>{organism.adaptations.length} traits</span></div>
      <div className="life-adaptations">
        {organism.adaptations.map((adaptation, index) => {
          const pressure = pressures.find((item) => item.factor === adaptation.environmentalPressure)!;
          return <details className="life-adaptation" key={`${adaptation.environmentalPressure}-${index}`} open={index === 0}>
            <summary><span className="life-trait-number">{String(index + 1).padStart(2, "0")}</span><span><small>{pressure.factor}</small>{adaptation.adaptation}</span><span className="life-disclosure" aria-hidden="true">+</span></summary>
            <div className="life-causal-chain">
              <div><span>ENVIRONMENT</span><p>{pressure.knownValue ?? "Conditional / unmeasured"}</p></div>
              <div><span>PRESSURE</span><p>{pressure.pressure}</p><p className="life-consequence">{adaptation.consequence}</p></div>
              <div><span>ADAPTATION</span><p>{adaptation.adaptation}</p></div>
            </div>
            <details className="life-evidence"><summary>Why this adaptation?</summary><p>{adaptation.reasoning}</p><p className="life-source">{pressure.evidence}</p></details>
          </details>;
        })}
      </div>
      <details className="life-notes"><summary>Form & survival strategy <span aria-hidden="true">+</span></summary>
        <dl>{Object.entries(morphologyLabels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{organism.morphology[key as keyof typeof organism.morphology]}</dd></div>)}</dl>
        <h3>Survival strategy</h3><p>{organism.survivalStrategy}</p>
      </details>
      <details className="life-notes"><summary>Field notes & uncertainty <span aria-hidden="true">+</span></summary>
        <p>{organism.summary}</p><ul>{organism.uncertainty.map((item, index) => <li key={index}>{item}</li>)}</ul>
      </details>
      <p className="life-science-note">A plausible scenario is not evidence of life.</p>
      <button className="text-button life-restart" type="button" onClick={onRestart}>EVOLVE ANOTHER HYPOTHESIS <span aria-hidden="true">↗</span></button>
    </div>
  </div>;
}
