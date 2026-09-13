"use client";

import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import type { Planet } from "../../types/planet";
import type { PlanetEnvironment } from "../../types/environment";
import type { VisualEnvironment } from "../../types/visual-environment";
import { PlanetScene } from "./PlanetScene";

interface PlanetSurfaceProps {
  planet: Planet;
  environment: PlanetEnvironment;
  visualEnvironment: VisualEnvironment;
}

/**
 * App-owned Canvas boundary for the reusable scene contents owned by the 3D
 * layer. UI overlays remain outside this component so they never participate
 * in the WebGL render tree.
 */
export function PlanetSurface({ planet, environment, visualEnvironment }: PlanetSurfaceProps) {
  const [resetView, setResetView] = useState(0);
  return (
    <div className="planet-surface">
      <Canvas
        camera={{ fov: 58, near: 0.15, far: 10000 }}
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <PlanetScene planet={planet} environment={environment} visualEnvironment={visualEnvironment} resetView={resetView} />
      </Canvas>
      <div className="world-look-controls">
        <span>Drag to look · 360° view<br /><small>WASD / arrows to move · bounded exploration</small></span>
        <button className="text-button" type="button" onClick={() => setResetView(value => value + 1)}>RESET VIEW</button>
      </div>
      <div aria-label="Walking controls" style={{ position: "absolute", top: 130, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, zIndex: 4 }}>
        {([ ["left", "←"], ["forward", "↑"], ["back", "↓"], ["right", "→"] ] as const).map(([direction, label]) => {
          const signal = (element: HTMLButtonElement, active: boolean) => element.closest(".world-page")?.dispatchEvent(new CustomEvent("observer-move", { detail: { direction, active } }));
          return <button key={direction} type="button" className="secondary-button" aria-label={`Move ${direction}`} style={{ margin: 0, padding: "10px 16px", touchAction: "none" }}
            onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); signal(event.currentTarget, true); }}
            onPointerUp={event => signal(event.currentTarget, false)}
            onPointerCancel={event => signal(event.currentTarget, false)}
            onLostPointerCapture={event => signal(event.currentTarget, false)}>{label}</button>;
        })}
      </div>
    </div>
  );
}
