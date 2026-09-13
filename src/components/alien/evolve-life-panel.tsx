"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import type { EvolveLifeStage } from "../../types/evolve-life";
import type { ValidatedOrganism } from "../../types/astrobiology";
import { readEvolveLifeStream, type OrganismResult } from "../../lib/evolve-life/stream";
import type { OrganismSceneSpec } from "../../lib/evolve-life/organism-scene";
import { useOrganismScene } from "./use-organism-scene";
import { OrganismIllustration, useOrganismIllustration } from "./organism-illustration";

const stages: { id: EvolveLifeStage; title: string; agent: string; active: string; done: string }[] = [
  { id: "scientist", title: "ANALYSING WORLD", agent: "Planet Scientist", active: "Identifying environmental pressures", done: "Environmental pressures identified" },
  { id: "evolution", title: "EVOLVING LIFE", agent: "Evolution Agent", active: "Developing a coherent organism", done: "Candidate organism generated" },
  { id: "critic", title: "SCIENTIFIC REVIEW", agent: "Critic Agent", active: "Checking every adaptation", done: "Adaptations reviewed" },
  { id: "finalize", title: "FINAL VALIDATION", agent: "Scientific synthesis", active: "Refining the organism and checking it again", done: "Organism validated" },
];
type Phase = "idle" | "running" | "complete" | "error";
type Progress = Partial<Record<EvolveLifeStage, "running" | "complete">>;

type OrganismControls = {
  organismVisible: boolean;
  onFocusOrganism: () => void;
  onToggleOrganism: () => void;
};

export function EvolveLifePanel({ planet, onOrganismScene, onFocusOrganism, onToggleOrganism, organismVisible }: {
  planet: Planet;
  environment: PlanetEnvironment;
  onOrganismScene: (organism: ValidatedOrganism | null, scene: OrganismSceneSpec | null) => void;
} & OrganismControls) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<Progress>({});
  const [result, setResult] = useState<OrganismResult | null>(null);
  const [error, setError] = useState("");
  const [diagnosticId, setDiagnosticId] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [includeModel, setIncludeModel] = useState(true);
  const [includeIllustration, setIncludeIllustration] = useState(true);
  const model = useOrganismScene(result?.illustrationToken, includeModel);
  const illustration = useOrganismIllustration(result?.illustrationToken, includeIllustration);
  const activeRequest = useRef<AbortController | null>(null);
  const resultTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => { activeRequest.current?.abort(); }, []);
  useEffect(() => {
    if (phase === "complete" && !collapsed) resultTitle.current?.focus({ preventScroll: true });
  }, [phase, collapsed]);
  useEffect(() => {
    if (!result || model.state.status !== "ready") return;
    onOrganismScene(result.organism, model.state.scene);
    onFocusOrganism();
  }, [result, model.state, onOrganismScene, onFocusOrganism]);

  const evolve = async () => {
    activeRequest.current?.abort();
    model.cancel();
    illustration.cancel();
    onOrganismScene(null, null);
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
          onOrganismScene(event.result.organism, null);
          setProgress({ scientist: "complete", evolution: "complete", critic: "complete", finalize: "complete" });
          setPhase("complete");
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
  const inspectOrganism = () => {
    onFocusOrganism();
    setCollapsed(true);
  };
  const currentStage = stages.find((stage) => progress[stage.id] === "running");
  const completedCount = stages.filter((stage) => progress[stage.id] === "complete").length;
  const statusText = phase === "complete" ? model.state.status === "ready" ? organismVisible ? "ORGANISM ON THE SURFACE" : "ORGANISM READY TO VIEW" : "LIFE HYPOTHESIS READY"
    : phase === "error" ? "SIMULATION INTERRUPTED"
    : currentStage?.title ?? "CONNECTING TO ASTRA";

  return (
    <section className={`evolve-panel life-panel${collapsed ? " is-collapsed" : ""}`} data-state={phase} aria-label="Evolve Life">
      <div className="life-panel-heading">
        <span className="eyebrow"><i className={phase === "running" ? "life-beacon is-active" : "life-beacon"} aria-hidden="true" /> ASTRA BIOSPHERE LAB</span>
        {phase !== "idle" && <button type="button" className="life-icon-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand life panel" : "Minimize life panel"} aria-expanded={!collapsed}>{collapsed ? "↗" : "−"}</button>}
      </div>
      {collapsed ? (
        <div>
          <button type="button" className="life-reopen" onClick={() => setCollapsed(false)} aria-label="Open organism analysis"><span role="status">{statusText}</span><span aria-hidden="true">↗</span></button>
          {model.state.status === "ready" && <div className="organism-world-controls is-compact"><button type="button" className="text-button" onClick={inspectOrganism}>VIEW ORGANISM <span aria-hidden="true">↗</span></button><button type="button" className="text-button" onClick={onToggleOrganism}>{organismVisible ? "HIDE" : "SHOW"}</button></div>}
          {model.state.status === "loading" && <p className="organism-compact-status" role="status"><i className="life-beacon is-active" aria-hidden="true" /> Constructing the 3D organism</p>}
          {model.state.status === "error" && <p className="organism-compact-status">3D model unavailable · analysis ready</p>}
          {illustration.state.status === "loading" && <p className="organism-compact-status" role="status">Preparing the 2D field illustration</p>}
          {illustration.state.status === "ready" && <button className="text-button" type="button" onClick={() => setCollapsed(false)}>VIEW 2D IMAGE <span aria-hidden="true">↗</span></button>}
          {illustration.state.status === "error" && <p className="organism-compact-status">2D illustration unavailable · open analysis to retry</p>}
        </div>
      ) : phase === "idle" ? (
        <div className="life-intro">
          <h2>What could adapt<br />to this world?</h2>
          <p>Follow the science from environment to possibility.</p>
          <label className="life-illustration-option"><input type="checkbox" checked={includeModel} onChange={(event) => setIncludeModel(event.target.checked)} /><span>Place organism in the world<small>Optional · 3D concept appears after the analysis</small></span></label>
          <label className="life-illustration-option"><input type="checkbox" checked={includeIllustration} onChange={(event) => setIncludeIllustration(event.target.checked)} /><span>Include a 2D field illustration<small>Optional · shown in this panel</small></span></label>
          <button className="secondary-button" type="button" onClick={evolve}>EVOLVE LIFE <span aria-hidden="true">↗</span></button>
        </div>
      ) : phase === "complete" && result ? (
        <OrganismView result={result} titleRef={resultTitle} onRestart={evolve} model={model} illustration={illustration} organismVisible={organismVisible} onFocusOrganism={inspectOrganism} onToggleOrganism={onToggleOrganism} />
      ) : (
        <div className="life-progress-view">
          <div className="life-progress-title" role="status" aria-live="polite" aria-atomic="true">
            <span className="life-step-count">{`${String(Math.min(completedCount + 1, 4)).padStart(2, "0")} / 04`}</span>
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
              const done = status === "complete";
              return <li key={stage.id} className={done ? "is-done" : status === "running" ? "is-current" : "is-pending"} aria-current={status === "running" ? "step" : undefined}>
                <span className="life-stage-marker" aria-hidden="true">{done ? "✓" : String(index + 1).padStart(2, "0")}</span>
                <div><strong>{stage.agent}</strong><span>{done ? stage.done : status === "running" ? phase === "error" ? "Interrupted — ready to retry" : stage.active : "Awaiting previous stage"}</span></div>
              </li>;
            })}
          </ol>
          {phase === "error" ? null : <div className="life-progress-footer">
            <span>You can keep exploring the world.</span>
            <button type="button" className="text-button" onClick={cancel}>CANCEL</button>
          </div>}
        </div>
      )}
    </section>
  );
}

function OrganismView({ result, titleRef, onRestart, model, illustration, organismVisible, onFocusOrganism, onToggleOrganism }: {
  result: OrganismResult; titleRef: RefObject<HTMLHeadingElement | null>; onRestart: () => void;
  model: ReturnType<typeof useOrganismScene>;
  illustration: ReturnType<typeof useOrganismIllustration>;
} & OrganismControls) {
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
      <OrganismIllustration illustration={illustration} available={Boolean(result.illustrationToken)} />
      <OrganismModelStatus model={model} organism={organism} available={Boolean(result.illustrationToken)} organismVisible={organismVisible} onFocusOrganism={onFocusOrganism} onToggleOrganism={onToggleOrganism} />
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

function OrganismModelStatus({ model, organism, available, organismVisible, onFocusOrganism, onToggleOrganism }: {
  model: ReturnType<typeof useOrganismScene>; organism: ValidatedOrganism; available: boolean;
} & OrganismControls) {
  const { state, generate } = model;
  return <section className="organism-world-status" data-model-state={state.status} aria-label="Organism in the world">
    <div className="organism-world-heading"><span>3D FIELD SPECIMEN</span><small>Speculative anatomy</small></div>
    {state.status === "loading" ? <div className="organism-model-loading" role="status" aria-live="polite">
      <span className="organism-model-scaffold" aria-hidden="true"><i /><i /><i /></span>
      <div><strong>Constructing the organism</strong><p>Your analysis is ready. Its body form is being prepared for the surface.</p></div>
    </div> : state.status === "ready" ? <div className="organism-model-ready">
      <p>{state.scene.organization === "multicellular" ? "Multicellular organism" : state.scene.organization === "colony" ? "Cell colony" : "Single-cell organism"} · {state.scene.activity === "dormant" ? "dormant concept" : "conditional life scenario"}</p>
      <div className="organism-world-controls"><button type="button" className="text-button" onClick={onFocusOrganism}>VIEW ORGANISM <span aria-hidden="true">↗</span></button><button type="button" className="text-button" onClick={onToggleOrganism}>{organismVisible ? "HIDE" : "SHOW"}</button></div>
      <p className="organism-scale-note">Concept scale for inspection · proposed size: {organism.morphology.size}</p>
    </div> : state.status === "error" ? <div className="organism-model-error" role="status" aria-live="polite">
      <strong>3D model unavailable</strong><p>{state.message}</p>
      {state.retryable && <button className="text-button" type="button" onClick={() => void generate()}>RETRY 3D MODEL <span aria-hidden="true">↻</span></button>}
      {state.diagnosticId && <small>Reference: {state.diagnosticId}</small>}
    </div> : available ? <div className="organism-model-optional">
      <p>Place a scientific 3D concept of this organism on the planet surface.</p>
      <button type="button" className="text-button" onClick={() => void generate()}>PLACE ORGANISM IN WORLD <span aria-hidden="true">↗</span></button>
    </div> : <p className="organism-model-optional">The 3D model is unavailable for this result. Your analysis is complete.</p>}
  </section>;
}
