"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import type { VisualEnvironment } from "../../types/visual-environment";
import { PlanetScene } from "./PlanetScene";
import type { ValidatedOrganism } from "../../types/astrobiology";
import type { OrganismSceneSpec } from "../../lib/evolve-life/organism-scene";

interface PlanetSurfaceProps {
  planet: Planet;
  environment: PlanetEnvironment;
  visualEnvironment: VisualEnvironment;
  organism?: ValidatedOrganism | null;
  organismScene?: OrganismSceneSpec | null;
  organismVisible?: boolean;
  focusOrganism?: number;
}

/**
 * App-owned Canvas boundary for the reusable scene contents owned by the 3D
 * layer. UI overlays remain outside this component so they never participate
 * in the WebGL render tree.
 */
export function PlanetSurface({ planet, environment, visualEnvironment, organism, organismScene, organismVisible = true, focusOrganism = 0 }: PlanetSurfaceProps) {
  const [resetView, setResetView] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  useEffect(() => { setInspecting(Boolean(organismScene && organismVisible)); }, [organismScene, organismVisible, focusOrganism]);
  return (
    <div className="planet-surface">
      <Canvas
        camera={{ fov: 58, near: 0.15, far: 10000 }}
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <PlanetScene planet={planet} environment={environment} visualEnvironment={visualEnvironment} resetView={resetView}
          organism={organism} organismScene={organismScene} organismVisible={organismVisible} focusOrganism={focusOrganism} />
      </Canvas>
      <div className="world-look-controls">
        <span>{inspecting ? "Drag to orbit · scroll to zoom" : "Drag to look around · 360° view"}</span>
        <button className="text-button" type="button" onClick={() => { setResetView(value => value + 1); setInspecting(false); }}>{inspecting ? "EXPLORE WORLD" : "RESET VIEW"}</button>
      </div>
      {organism && organismScene && organismVisible && <aside className="world-organism-caption" aria-label="Organism in the world">
        <span className="eyebrow">{organismScene.organization === "multicellular" ? "MULTICELLULAR LIFE CONCEPT" : organismScene.organization === "colony" ? "CELLULAR COLONY CONCEPT" : "MICROBIAL LIFE CONCEPT"}</span>
        <strong>{organism.name}</strong>
        <p>{organismScene.scale === "microscopic" ? "Magnified specimen" : "Concept display scale"} · {organismScene.activity === "dormant" ? "Dormant form" : "Conditional active form"}</p>
        <small>Illustrative anatomy and colour · survival is unverified{visualEnvironment.surfacePreset === "gas-giant" ? " · no solid surface assumed" : ""}</small>
      </aside>}
    </div>
  );
}
