"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, DoubleSide, Color, InstancedMesh, MeshStandardMaterial, Object3D, ShaderMaterial, Vector3 } from "three";
import type { PlanetEnvironment } from "../../types/environment";
import type { Planet } from "../../types/planet";
import type { VisualEnvironment } from "../../types/visual-environment";
import { createSurface, randomSource, seedFromName } from "./surface-geometry";
import { ObserverCamera } from "./observer-camera";

export interface PlanetSceneProps {
  planet: Planet;
  environment: PlanetEnvironment;
  visualEnvironment: VisualEnvironment;
  resetView?: number;
}

/** The existing Canvas scene: all appearance comes from the visual mapper. */
export function PlanetScene({ planet, visualEnvironment: v, resetView = 0 }: PlanetSceneProps) {
  const seed = useMemo(() => seedFromName(planet.name), [planet.name]);
  const surface = useMemo(() => createSurface(v, seed, v.surfacePreset === "gas-giant"), [v, seed]);
  useEffect(() => () => surface.geometry.dispose(), [surface]);
  return <>
    <color attach="background" args={[v.skyColor]} />
    <fog attach="fog" args={[v.horizonColor, v.fogNear, v.fogFar]} />
    <Sky v={v} />
    <HostStar v={v} />
    <Starfield v={v} seed={seed} />
    <hemisphereLight args={[v.fillColor, v.groundColor, v.ambientIntensity]} />
    <directionalLight position={v.starPosition} color={v.starColor} intensity={v.starIntensity}
      castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
      shadow-camera-left={-65} shadow-camera-right={65} shadow-camera-top={65} shadow-camera-bottom={-65}
      shadow-camera-near={1} shadow-camera-far={1000} shadow-normalBias={0.12} />
    {v.surfacePreset === "gas-giant"
      ? <CloudDeck v={v} seed={seed} />
      : <RockySurface v={v} seed={seed} surface={surface} />}
    <ObserverCamera v={v} heightAt={surface.heightAt} resetView={resetView} />
  </>;
}

function RockySurface({ v, seed, surface }: { v: VisualEnvironment; seed: number; surface: ReturnType<typeof createSurface> }) {
  const material = useMemo(() => {
    const result = new MeshStandardMaterial({ color: v.groundColor, roughness: v.roughness });
    result.onBeforeCompile = shader => {
      shader.uniforms.accent = { value: new Color(v.groundAccentColor) };
      shader.uniforms.heat = { value: v.emissiveIntensity };
      shader.uniforms.frost = { value: v.frostCoverage };
      shader.vertexShader = "varying vec3 terrainPoint;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n terrainPoint = position;");
      shader.fragmentShader = "varying vec3 terrainPoint; uniform vec3 accent; uniform float heat; uniform float frost;\n" + NOISE + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        float grit = fbm(terrainPoint.xz*1.4);
        float vein = abs(sin(terrainPoint.x*0.17 + sin(terrainPoint.z*0.055)*2.8 + fbm(terrainPoint.xz*0.09)*3.0));
        float fissure = (1.0-smoothstep(0.025,0.10,vein))*step(0.01,heat);
        diffuseColor.rgb *= mix(0.5,1.45,grit);
        diffuseColor.rgb = mix(diffuseColor.rgb,accent,frost*smoothstep(0.30,0.65,grit));
        diffuseColor.rgb = mix(diffuseColor.rgb,accent,fissure*0.7);`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n totalEmissiveRadiance = accent * heat * fissure;");
      shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        vec3 qx=dFdx(vViewPosition), qy=dFdy(vViewPosition);
        float dx=dFdx(grit), dy=dFdy(grit);
        normal=normalize(normal + 0.13*(dx*normalize(qx)+dy*normalize(qy)));`);
    };
    result.customProgramCacheKey = () => "planet-terrain-v2";
    return result;
  }, [v]);
  useEffect(() => () => material.dispose(), [material]);
  return <>
    <mesh geometry={surface.geometry} material={material} receiveShadow />
    <Rocks v={v} seed={seed} heightAt={surface.heightAt} />
  </>;
}

function Rocks({ v, seed, heightAt }: { v: VisualEnvironment; seed: number; heightAt: (x: number, z: number) => number }) {
  const instances = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const random = randomSource(seed + 19), matrix = new Object3D(), color = new Color(v.groundColor);
    for (let index = 0; index < v.rockCount; index++) {
      const angle = random() * Math.PI * 2, distance = 10 + random() * 115;
      let x = Math.cos(angle) * distance, z = 12 + Math.sin(angle) * distance;
      // Reserve the entire camera's movement corridor.
      if (Math.hypot(x, z - 12) < 6) x += x < 0 ? -8 : 8;
      const scale = (0.25 + Math.pow(random(), 3) * 3.3) * v.rockScale;
      const y = Math.min(heightAt(x,z), heightAt(x-scale,z), heightAt(x+scale,z), heightAt(x,z-scale), heightAt(x,z+scale));
      matrix.position.set(x, y + scale * 0.35, z);
      matrix.scale.set(scale * (0.8 + random()), scale * (v.landscape === "glacial" ? 1.8 : v.landscape === "craters" ? 0.4 : 0.8), scale);
      matrix.rotation.set(0, random()*Math.PI*2, 0); matrix.updateMatrix();
      instances.current!.setMatrixAt(index, matrix.matrix);
      instances.current!.setColorAt(index, color.clone().multiplyScalar(0.7 + random()*0.65));
    }
    instances.current!.instanceMatrix.needsUpdate = true;
    if (instances.current!.instanceColor) instances.current!.instanceColor.needsUpdate = true;
    instances.current!.computeBoundingSphere();
  }, [seed, v, heightAt]);
  return <instancedMesh ref={instances} args={[undefined, undefined, v.rockCount]} castShadow receiveShadow>
    <icosahedronGeometry args={[1, 1]} />
    <meshStandardMaterial roughness={v.roughness} />
  </instancedMesh>;
}

const NOISE = `
float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x),mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise2(p)*0.55+noise2(p*2.1)*0.28+noise2(p*4.3)*0.12+noise2(p*8.7)*0.05;}
`;

function Sky({ v }: { v: VisualEnvironment }) {
  const uniforms = useMemo(() => ({
    zenith: { value: new Color(v.skyColor) }, horizon: { value: new Color(v.horizonColor) },
    haze: { value: v.atmosphereOpacity },
  }), [v]);
  return <mesh renderOrder={-10}>
    <sphereGeometry args={[8000, 48, 32]} />
    <shaderMaterial side={BackSide} depthWrite={false} uniforms={uniforms}
      vertexShader={`varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
      fragmentShader={`varying vec3 direction;uniform vec3 zenith,horizon;uniform float haze;
      void main(){float altitude=normalize(direction).y;float band=exp(-abs(altitude)*7.0);
      gl_FragColor=vec4(mix(zenith,horizon,band*min(1.0,haze*2.6)),1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`} />
  </mesh>;
}

function HostStar({ v }: { v: VisualEnvironment }) {
  const distance = new Vector3(...v.starPosition).length();
  const radius = Math.tan(v.starSize) * distance;
  const uniforms = useMemo(() => ({ tint: { value: new Color(v.starColor) } }), [v.starColor]);
  return <group position={v.starPosition}>
    <mesh><sphereGeometry args={[radius, 32, 24]} /><meshBasicMaterial color={v.starColor} toneMapped={false} fog={false} /></mesh>
    <sprite scale={[radius*5, radius*5, 1]} raycast={() => {}}>
      <shaderMaterial transparent depthWrite={false} uniforms={uniforms}
        vertexShader={`varying vec2 tex;void main(){tex=uv;vec4 p=modelViewMatrix*vec4(0.,0.,0.,1.);
        p.xy+=position.xy*vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));gl_Position=projectionMatrix*p;}`}
        fragmentShader={`varying vec2 tex;uniform vec3 tint;void main(){float r=length(tex-.5)*2.;gl_FragColor=vec4(tint,pow(max(0.,1.-r),4.)*.25);}`} />
    </sprite>
  </group>;
}

function CloudDeck({ v, seed }: { v: VisualEnvironment; seed: number }) {
  return <>{[0,1,2].map(layer => <CloudLayer key={layer} layer={layer} v={v} seed={seed} />)}</>;
}
function CloudLayer({ layer, v, seed }: { layer: number; v: VisualEnvironment; seed: number }) {
  const surface = useMemo(() => createSurface(v, seed + layer*87, true), [v,seed,layer]);
  const material = useRef<ShaderMaterial>(null);
  const reduced = useRef(false);
  const uniforms = useMemo(() => ({
    time: { value: 0 }, dark: { value: new Color(v.cloudColor) }, light: { value: new Color(v.cloudAccentColor) },
    opacity: { value: layer === 0 ? 1 : v.cloudOpacity }, seed: { value: seed % 1000 + layer*19 },
    horizon: { value: new Color(v.horizonColor) },
    fogRange: { value: [v.fogNear, v.fogFar] },
  }), [v,seed,layer]);
  useEffect(() => () => surface.geometry.dispose(), [surface]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reduced.current = media.matches; };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useFrame((_, delta) => { if(material.current && !reduced.current) material.current.uniforms.time.value+=Math.min(delta, 0.1)*v.cloudSpeed*(1+layer*0.7); });
  return <mesh geometry={surface.geometry} position={[0,-26+layer*11,0]} renderOrder={layer}>
    <shaderMaterial ref={material} side={DoubleSide} transparent={layer>0} depthWrite={layer===0} uniforms={uniforms}
      vertexShader={`varying vec3 p;varying float depth;void main(){p=position;vec4 view=modelViewMatrix*vec4(position,1.);depth=-view.z;gl_Position=projectionMatrix*view;}`}
      fragmentShader={NOISE+`varying vec3 p;varying float depth;uniform float time,opacity,seed;uniform vec3 dark,light,horizon;uniform vec2 fogRange;
      void main(){vec2 q=p.xz*vec2(.012,.027)+vec2(time,seed);float n=fbm(q+vec2(fbm(q*.65)*3.,0.));
      float bands=fbm(q*vec2(.45,2.3)); float density=smoothstep(.22,.76,n*.75+bands*.25);
      float billows=fbm(q*3.1+vec2(n*2.));
      vec3 c=mix(dark,light,smoothstep(.12,.82,density*.7+billows*.3));c=mix(c,horizon,smoothstep(fogRange.x,fogRange.y,depth));
      gl_FragColor=vec4(c,opacity>=1.?1.:smoothstep(.18,.65,n)*opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`} />
  </mesh>;
}

function Starfield({ v, seed }: { v: VisualEnvironment; seed: number }) {
  const positions=useMemo(()=>{
    const random=randomSource(seed), values=new Float32Array(1200*3);
    for(let i=0;i<values.length;i+=3){const a=random()*Math.PI*2,y=random(),r=1150;
      values.set([Math.cos(a)*Math.sqrt(1-y*y)*r,y*r,Math.sin(a)*Math.sqrt(1-y*y)*r],i);}
    return values;
  },[seed]);
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]} /></bufferGeometry>
    <pointsMaterial color={v.starColor} size={0.7} transparent opacity={v.starfieldOpacity} depthWrite={false} fog={false} /></points>;
}
