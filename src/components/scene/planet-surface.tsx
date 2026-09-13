"use client";

import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import type { VisualEnvironment } from "../../types/visual-environment";
import type { SkyExposure, SkyLoadStatus, SkyScenario } from "../../types/sky";
import { PlanetScene } from "./PlanetScene";
import type { ValidatedOrganism } from "../../types/astrobiology";
import type { OrganismSceneSpec } from "../../lib/evolve-life/organism-scene";
import { SceneBoundary, SceneHealth } from "./scene-health";
import type { MoveDirection, MovementInput } from "./observer-camera";

interface PlanetSurfaceProps {
  planet: Planet;
  environment: PlanetEnvironment;
  visualEnvironment: VisualEnvironment;
  organism?: ValidatedOrganism | null;
  organismScene?: OrganismSceneSpec | null;
  organismVisible?: boolean;
  focusOrganism?: number;
  onReturnToOverview: () => void;
}

/**
 * App-owned Canvas boundary for the reusable scene contents owned by the 3D
 * layer. UI overlays remain outside this component so they never participate
 * in the WebGL render tree.
 */
export function PlanetSurface({ planet, environment, visualEnvironment, organism, organismScene, organismVisible = true, focusOrganism = 0, onReturnToOverview }: PlanetSurfaceProps) {
  const [resetView, setResetView] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  useEffect(() => { setInspecting(Boolean(organismScene && organismVisible)); }, [organismScene, organismVisible, focusOrganism]);
  const [attempt,setAttempt]=useState(0),[failed,setFailed]=useState(false),[measure,setMeasure]=useState(0),[stats,setStats]=useState("");
  const [failureToken,setFailureToken]=useState(0);
  const [skyScenario,setSkyScenario]=useState<SkyScenario>("night");
  const [skyExposure,setSkyExposure]=useState<SkyExposure>("natural");
  const [skyStatus,setSkyStatus]=useState<SkyLoadStatus>("loading");
  const movement=useRef<MovementInput>({held:new Set(),steps:[0,0]});
  const onLost=useCallback(()=>setFailed(true),[]);
  const retry=()=>{setFailureToken(0);setMeasure(0);setFailed(false);setAttempt(value=>value+1);setResetView(0);};
  const fallback=<div className="scene-failure" role="alert"><h2>3D view unavailable</h2><p>Your browser could not start or maintain WebGL. Your selected world is preserved.</p><button onClick={retry}>RETRY 3D VIEW</button><button onClick={onReturnToOverview}>RETURN TO OVERVIEW</button></div>;
  return (
    <div className="planet-surface">
      {failed ? fallback : <SceneBoundary key={attempt} fallback={fallback}><Canvas
        camera={{ fov: 58, near: 0.15, far: 10000 }}
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        fallback={fallback}
      >
        <PlanetScene planet={planet} environment={environment} visualEnvironment={visualEnvironment} resetView={resetView}
          organism={organism} organismScene={organismScene} organismVisible={organismVisible} focusOrganism={focusOrganism}
          movement={movement.current} skyScenario={skyScenario} skyExposure={skyExposure} onSkyStatus={setSkyStatus} />
        <SceneHealth onLost={onLost} token={measure} onSample={setStats} failureToken={failureToken} />
      </Canvas></SceneBoundary>}
      <div className="world-look-controls">
        <span>{inspecting ? "Drag to orbit · scroll to zoom" : <>Drag to look around · 360° view<br /><small>WASD / arrows to {visualEnvironment.landscape === "clouds" ? "float" : "move"} · limited range</small></>}</span>
        <button className="text-button" type="button" onClick={() => { setResetView(value => value + 1); setInspecting(false); }}>{inspecting ? "EXPLORE WORLD" : "RESET VIEW"}</button>
      </div>
      {!failed && inspecting && organism && organismScene && organismVisible && <aside className="world-organism-caption" aria-label="Organism in the world">
        <span className="eyebrow">{organismScene.organization === "multicellular" ? "MULTICELLULAR LIFE CONCEPT" : organismScene.organization === "colony" ? "CELLULAR COLONY CONCEPT" : "MICROBIAL LIFE CONCEPT"}</span>
        <strong>{organism.name}</strong>
        <p>{organismScene.scale === "microscopic" ? "Magnified specimen" : "Concept display scale"} · {organismScene.activity === "dormant" ? "Dormant form" : "Conditional active form"}</p>
        <small>Illustrative anatomy and colour · survival is unverified{visualEnvironment.surfacePreset === "gas-giant" ? " · no solid surface assumed" : ""}</small>
      </aside>}
      {!failed && <div className="sky-controls" aria-label="Sky viewing controls">
        <p>{skyStatus === "catalogue" ? "APPROXIMATE CATALOGUE RECONSTRUCTION" : "ILLUSTRATIVE SKY SCENARIO"}</p>
        <div>
          <button type="button" aria-pressed={skyScenario === "night"}
            onClick={()=>setSkyScenario(value=>value === "night" ? "host-lit" : "night")}>
            {skyScenario === "night" ? "NIGHT-SIDE" : "HOST-LIT"} VIEW
          </button>
          <button type="button" aria-pressed={skyExposure === "enhanced"}
            onClick={()=>setSkyExposure(value=>value === "enhanced" ? "natural" : "enhanced")}>
            ENHANCED EXPOSURE
          </button>
        </div>
        <small>{skyStatus === "loading" ? "Loading local star catalogue…" : skyStatus === "catalogue"
          ? "Surface orientation and atmosphere are assumed; exposure is a presentation setting."
          : "Catalogue unavailable — showing a labelled illustrative fallback."}</small>
      </div>}
      {!failed && !inspecting && <div className="touch-movement" aria-label="Movement controls">
        {([['left','←'],['forward','↑'],['back','↓'],['right','→']] as [MoveDirection,string][]).map(([direction,label])=><button key={direction} aria-label={`Move ${direction}`}
          onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);movement.current.held.add(direction);movement.current.steps[0]+=direction==='left'?-.4:direction==='right'?.4:0;movement.current.steps[1]+=direction==='forward'?.4:direction==='back'?-.4:0;}}
          onPointerUp={()=>movement.current.held.delete(direction)} onPointerCancel={()=>movement.current.held.clear()} onLostPointerCapture={()=>movement.current.held.delete(direction)}>{label}</button>)}
      </div>}
      <details className="scene-performance"><summary>PERFORMANCE</summary><button onClick={()=>{setStats("Sampling 120 frames after 30 warm-up frames…");setMeasure(value=>value+1);}}>MEASURE FRAMES</button><button onClick={()=>setFailureToken(value=>value+1)}>TEST WEBGL RECOVERY</button><pre aria-label="Frame sample">{stats || "Local rendering diagnostics; results depend on this browser and machine."}</pre></details>
    </div>
  );
}
