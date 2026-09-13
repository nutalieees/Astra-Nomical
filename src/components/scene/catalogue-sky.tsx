"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Group, ShaderMaterial } from "three";
import { decodeSkyBuffer, FEATURED_SKY_SLUGS, type DecodedSkyBuffer } from "../../lib/astronomy/cached-sky";
import type { SkyExposure, SkyLoadStatus, SkyScenario } from "../../types/sky";

const SHELL_RADIUS = 1800;

export function CatalogueSky({ planetName, scenario, exposure, atmosphereOpacity, rotation, onStatus }: {
  planetName: string;
  scenario: SkyScenario;
  exposure: SkyExposure;
  atmosphereOpacity: number;
  rotation: [number, number, number];
  onStatus?: (status: SkyLoadStatus) => void;
}) {
  const [data, setData] = useState<DecodedSkyBuffer | null>(null);
  const [failed, setFailed] = useState(false);
  const slug = FEATURED_SKY_SLUGS[planetName];

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setData(null);
    setFailed(false);
    onStatus?.("loading");
    if (!slug) {
      setFailed(true);
      onStatus?.("illustrative-fallback");
      return () => { active = false; controller.abort(); };
    }
    fetch(`/data/skies/${slug}.bin`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then(buffer => {
        if (!active) return;
        setData(decodeSkyBuffer(buffer));
        onStatus?.("catalogue");
      })
      .catch(error => {
        if (!active || error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
        onStatus?.("illustrative-fallback");
      });
    return () => { active = false; controller.abort(); };
  }, [slug, onStatus]);

  if (data) return <CataloguePoints data={data} scenario={scenario} exposure={exposure} atmosphereOpacity={atmosphereOpacity} rotation={rotation} />;
  return failed ? <IllustrativeFallback planetName={planetName} rotation={rotation} /> : null;
}

function CataloguePoints({ data, scenario, exposure, atmosphereOpacity, rotation }: {
  data: DecodedSkyBuffer;
  scenario: SkyScenario;
  exposure: SkyExposure;
  atmosphereOpacity: number;
  rotation: [number, number, number];
}) {
  const group = useRef<Group>(null);
  const material = useRef<ShaderMaterial>(null);
  const pixelRatio = useThree(state => state.gl.getPixelRatio());
  const geometry = useMemo(() => {
    const positions = new Float32Array(data.apparentMagnitudesV.length * 3);
    const colors = new Float32Array(positions.length);
    for (let index = 0; index < data.apparentMagnitudesV.length; index++) {
      // Catalogue axes (X=RA 0h, Y=RA 6h, Z=north) -> Three.js (X, up=Y, back=-Z).
      positions[index * 3] = data.directions[index * 3] * SHELL_RADIUS;
      positions[index * 3 + 1] = data.directions[index * 3 + 2] * SHELL_RADIUS;
      positions[index * 3 + 2] = -data.directions[index * 3 + 1] * SHELL_RADIUS;
      colors[index * 3] = data.colors[index * 3] / 255;
      colors[index * 3 + 1] = data.colors[index * 3 + 1] / 255;
      colors[index * 3 + 2] = data.colors[index * 3 + 2] / 255;
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    result.setAttribute("color", new Float32BufferAttribute(colors, 3));
    result.setAttribute("apparentMagnitude", new Float32BufferAttribute(data.apparentMagnitudesV, 1));
    result.setAttribute("relativeFlux", new Float32BufferAttribute(data.relativeFluxesToV0, 1));
    result.computeBoundingSphere();
    return result;
  }, [data]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    if (!material.current) return;
    material.current.uniforms.magnitudeLimit.value = exposure === "enhanced" ? 10 : 6.5;
    const atmosphericTransmission = Math.max(0.08, 1 - atmosphereOpacity * 0.72);
    material.current.uniforms.opacity.value = atmosphericTransmission * (scenario === "night" ? 0.9 : 0.22);
  }, [exposure, scenario, atmosphereOpacity]);
  useFrame(({ camera }) => { if (group.current) group.current.position.copy(camera.position); });
  const uniforms = useMemo(() => ({
    magnitudeLimit: { value: exposure === "enhanced" ? 10 : 6.5 },
    opacity: { value: Math.max(0.08, 1 - atmosphereOpacity * 0.72) * (scenario === "night" ? 0.9 : 0.22) },
    pixelRatio: { value: pixelRatio },
  }), [pixelRatio]);
  return <group ref={group} rotation={rotation}>
    <points geometry={geometry} frustumCulled={false} renderOrder={-2}>
      <shaderMaterial ref={material} uniforms={uniforms} vertexColors transparent depthTest depthWrite={false}
        blending={AdditiveBlending} toneMapped={false}
        vertexShader={`attribute float apparentMagnitude; attribute float relativeFlux; varying vec3 vColor; varying float vAlpha;
          uniform float magnitudeLimit, opacity, pixelRatio;
          void main(){
            float visible=1.0-smoothstep(magnitudeLimit-0.35,magnitudeLimit+0.05,apparentMagnitude);
            float compressed=log2(1.0+max(relativeFlux,0.0)*8.0)/log2(9.0);
            vColor=mix(vec3(1.0),color,0.58);
            vAlpha=visible*opacity*clamp(0.28+compressed,0.22,1.0);
            gl_PointSize=clamp((1.15+3.4*sqrt(clamp(compressed,0.0,2.0)))*pixelRatio,1.0,7.5*pixelRatio);
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
          }`}
        fragmentShader={`varying vec3 vColor; varying float vAlpha;
          void main(){float radius=length(gl_PointCoord-vec2(0.5));float core=1.0-smoothstep(0.08,0.5,radius);
            if(core<=0.0||vAlpha<=0.001)discard;gl_FragColor=vec4(vColor,core*vAlpha);}`}/>
    </points>
  </group>;
}

function IllustrativeFallback({ planetName, rotation }: { planetName: string; rotation: [number, number, number] }) {
  const group = useRef<Group>(null);
  const positions = useMemo(() => {
    let state = [...planetName].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
    const values = new Float32Array(900 * 3);
    for (let index = 0; index < 900; index++) {
      const azimuth = random() * Math.PI * 2;
      const y = random() * 2 - 1;
      const radial = Math.sqrt(1 - y * y);
      values.set([Math.cos(azimuth) * radial * SHELL_RADIUS, y * SHELL_RADIUS, Math.sin(azimuth) * radial * SHELL_RADIUS], index * 3);
    }
    return values;
  }, [planetName]);
  useFrame(({ camera }) => { if (group.current) group.current.position.copy(camera.position); });
  return <group ref={group} rotation={rotation}><points frustumCulled={false}><bufferGeometry>
    <bufferAttribute attach="attributes-position" args={[positions, 3]} />
  </bufferGeometry><pointsMaterial color="#dce8ff" size={1.15} transparent opacity={0.38} depthTest depthWrite={false} fog={false} /></points></group>;
}
