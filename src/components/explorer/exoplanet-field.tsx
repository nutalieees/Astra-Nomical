"use client";

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Color, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FEATURED_PLANETS } from "../../lib/astronomy/planets-featured";
import { deriveEnvironment } from "../../lib/astronomy/environment";
import type { Planet } from "../../types/planet";
import { PlanetOverview } from "../planet/planet-overview";

// Art-directed coordinates, never astronomical positions or distance scales.
const LAYOUT: [number, number, number][] = [[-8, 3, 0], [-7, -3, 2], [0, 0, 3], [7, 3, -2], [8, -3, 0]];
const PORTRAIT_LAYOUT: [number, number, number][] = [[-2.6, 5.4, 0], [2.5, 2.8, 1], [-2.5, 0, 2], [2.5, -2.6, 0], [-2.5, -5.3, 0]];
const ignoreRaycast = () => {};
const SYSTEMS = FEATURED_PLANETS.map((planet, index) => ({
  planet,
  index,
  environment: deriveEnvironment(planet),
  // Illustrative planet materials: ice, cool rock, molten rock, giant, ice.
  accent: ["#80dbff", "#b6c8ad", "#ff7542", "#c6a3ff", "#75a3ed"][index],
}));
type System = (typeof SYSTEMS)[number];

interface ExoplanetFieldProps {
  onSelect: (planet: Planet) => void;
  onEnterWorld: () => void;
}

/** Spatial entrance, with one background Points draw and five selectable groups. */
export function ExoplanetField({ onSelect, onEnterWorld }: ExoplanetFieldProps) {
  const [selected, setSelected] = useState<System | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const labels = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (system: System) => { setSelected(system); onSelect(system.planet); };

  return (
    <section className="exoplanet-field" aria-label="Interactive featured exoplanet systems">
      <div className="field-heading">
        <p className="eyebrow">DEEP SPACE / EXPLORER</p>
        <h1>Five stars. Other worlds.</h1>
        <p>Drag to explore · select a system</p>
      </div>
      <div className="field-viewport">
        <FieldBoundary onError={() => setFailed(true)}>
          <Canvas camera={{ position: [0, 0, 28], fov: 52, near: 0.1, far: 180 }}
            dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }}
            fallback={<p className="field-fallback">3D unavailable. Select a labeled system to explore.</p>}>
            <color attach="background" args={["#030610"]} />
            <BackgroundStars />
            <ReferenceLines />
            <FieldCamera />
            {SYSTEMS.map(system => <SystemNode key={system.planet.name} system={system}
              active={selected === system || hovered === system.planet.name}
              labelRefs={labels} onSelect={() => select(system)} onHover={setHovered} />)}
          </Canvas>
        </FieldBoundary>
        <div className={`field-labels${failed ? " field-labels-fallback" : ""}`} aria-label="Featured systems">
          {SYSTEMS.map(system => <button key={system.planet.name} type="button"
            ref={element => { labels.current[system.index] = element; }}
            className={`field-label${selected === system ? " is-selected" : ""}`}
            style={{ left: `${18 + (system.index % 3) * 30}%`, top: `${28 + Math.floor(system.index / 3) * 35}%`, borderColor: system.accent }}
            aria-pressed={selected === system} aria-label={`Select ${system.planet.name}`}
            onMouseEnter={() => setHovered(system.planet.name)} onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(system.planet.name)} onBlur={() => setHovered(null)}
            onClick={() => select(system)}>
            <span className="field-label-index">0{system.index + 1} / {system.environment.temperatureCategory.toUpperCase()}</span>
            <strong>{system.planet.name}</strong>
            <span>{system.planet.distanceLightYears?.toLocaleString() ?? "Unknown"} ly from Earth</span>
          </button>)}
        </div>
      </div>
      <div className="field-readout" aria-live="polite" aria-atomic="true">
        {selected ? <PlanetOverview planet={selected.planet} environment={selected.environment}
          variant="field" onEnterWorld={onEnterWorld} /> : <div className="field-invitation">
          <span className="eyebrow">05 CONFIRMED WORLDS / AWAITING SELECTION</span>
          <p>Find your next horizon.</p><span>Choose a glowing system to inspect its world.</span>
        </div>}
      </div>
      <footer className="field-caption">ILLUSTRATIVE MAP OF FEATURED EXOPLANET SYSTEMS
        <span>Positions, orbits and sizes composed for exploration · distances from archive data</span>
      </footer>
    </section>
  );
}

function FieldCamera() {
  const { camera, gl, size } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const reduced = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reduced.current = media.matches; };
    update(); media.addEventListener("change", update);
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enablePan = false; orbit.enableZoom = false;
    orbit.enableDamping = true; orbit.dampingFactor = 0.06;
    orbit.rotateSpeed = 0.4;
    orbit.minAzimuthAngle = -0.28; orbit.maxAzimuthAngle = 0.28;
    orbit.minPolarAngle = Math.PI / 2 - 0.18; orbit.maxPolarAngle = Math.PI / 2 + 0.18;
    controls.current = orbit;
    return () => { orbit.dispose(); controls.current = null; media.removeEventListener("change", update); };
  }, [camera, gl]);
  useEffect(() => {
    // Fit the composed field, including its labels, across portrait/landscape sizes.
    camera.position.set(0, 0, size.width < 700 ? 24 : Math.max(26, 24 / (size.width / size.height)));
    camera.lookAt(0, 0, 0);
    controls.current?.update();
  }, [camera, size.width, size.height]);
  useFrame(({ clock }, delta) => {
    if (!controls.current) return;
    controls.current.autoRotate = !reduced.current;
    controls.current.autoRotateSpeed = Math.cos(clock.elapsedTime * 0.13) * 0.18;
    controls.current.update(Math.min(delta, 0.05));
  });
  return null;
}

function SystemNode({ system, active, labelRefs, onSelect, onHover }: {
  system: System; active: boolean; labelRefs: React.RefObject<(HTMLButtonElement | null)[]>;
  onSelect: () => void; onHover: (name: string | null) => void;
}) {
  const { size } = useThree();
  const position = (size.width < 700 ? PORTRAIT_LAYOUT : LAYOUT)[system.index];
  const projected = useMemo(() => new Vector3(), []);
  const radius = Math.min(0.48, 0.17 + Math.sqrt(system.planet.starRadiusSolar ?? 1) * 0.2);
  const orbit = 0.85 + system.index * 0.075;
  useFrame(({ camera, size: viewport }) => {
    const label = labelRefs.current[system.index];
    if (!label) return;
    projected.set(...position).project(camera);
    label.style.left = `${(projected.x * 0.5 + 0.5) * viewport.width}px`;
    label.style.top = `${(-projected.y * 0.5 + 0.5) * viewport.height + 24}px`;
    label.style.visibility = Math.abs(projected.z) < 1 ? "visible" : "hidden";
  });
  return (
    <group position={position} onPointerOver={event => { event.stopPropagation(); onHover(system.planet.name); }}
      onPointerOut={() => onHover(null)} onClick={event => { event.stopPropagation(); if (event.delta < 5) onSelect(); }}>
      <mesh><sphereGeometry args={[radius, 24, 16]} />
        <meshBasicMaterial color={system.environment.starColor} toneMapped={false} /></mesh>
      {/* Decorative shader glow must not participate in SpriteMaterial raycasting. */}
      <sprite scale={active ? 3.6 : 2.8} raycast={ignoreRaycast}>
        <shaderMaterial transparent depthWrite={false} blending={AdditiveBlending}
          uniforms={{ tint: { value: new Color(system.environment.starColor) } }}
          vertexShader={GLOW_VERTEX} fragmentShader={GLOW_FRAGMENT} />
      </sprite>
      <mesh rotation={[0.9, 0.25, system.index * 0.5]}>
        <torusGeometry args={[orbit, active ? 0.016 : 0.008, 4, 80]} />
        <meshBasicMaterial color={system.accent} transparent opacity={active ? 0.95 : 0.4} />
        <mesh position={[orbit, 0, 0]}>
          <sphereGeometry args={[system.index === 3 ? 0.18 : 0.11, 16, 12]} />
          <meshBasicMaterial color={system.accent} />
        </mesh>
      </mesh>
      <mesh><sphereGeometry args={[1.15, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} /></mesh>
    </group>
  );
}

const GLOW_VERTEX = `varying vec2 vUv;
void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const GLOW_FRAGMENT = `varying vec2 vUv; uniform vec3 tint;
void main(){float r=length(vUv-0.5)*2.0; float a=pow(max(0.0,1.0-r),4.0)*0.6;
gl_FragColor=vec4(tint,a);}`;

function BackgroundStars() {
  const data = useMemo(() => {
    const positions = new Float32Array(4200 * 3);
    const colors = new Float32Array(4200 * 3);
    let state = 7281;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    for (let i = 0; i < positions.length; i += 3) {
      const angle = random() * Math.PI * 2, y = random() * 2 - 1;
      const radius = 45 + random() * 70, horizontal = Math.sqrt(1 - y * y);
      positions[i] = Math.cos(angle) * horizontal * radius;
      positions[i + 1] = y * radius; positions[i + 2] = Math.sin(angle) * horizontal * radius;
      const brightness = 0.18 + random() * 0.65;
      colors[i] = brightness * 0.7; colors[i + 1] = brightness * 0.82; colors[i + 2] = brightness;
    }
    return { positions, colors };
  }, []);
  return <points frustumCulled={false}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
      <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
    </bufferGeometry>
    <pointsMaterial vertexColors size={0.075} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
  </points>;
}

function ReferenceLines() {
  const positions = useMemo(() => {
    const vertices: number[] = [];
    for (const radius of [5, 10, 15, 20]) for (let i = 0; i < 128; i++) {
      for (const step of [i, i + 1]) { const angle = step / 128 * Math.PI * 2;
        vertices.push(Math.cos(angle) * radius, -5.5, Math.sin(angle) * radius); }
    }
    vertices.push(-24, -5.5, 0, 24, -5.5, 0, 0, -5.5, -24, 0, -5.5, 24);
    return new Float32Array(vertices);
  }, []);
  return <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <lineBasicMaterial color="#48799d" transparent opacity={0.16} depthWrite={false} /></lineSegments>;
}

class FieldBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? <p className="field-fallback">3D unavailable. Select a labeled system to explore.</p> : this.props.children; }
}
