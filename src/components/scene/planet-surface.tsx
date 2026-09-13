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
        <span>Drag to look around · 360° view</span>
        <button className="text-button" type="button" onClick={() => setResetView(value => value + 1)}>RESET VIEW</button>
      </div>
    </div>
  );
}
