"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, DoubleSide, BufferGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, Color, InstancedMesh, MeshStandardMaterial, Object3D, ShaderMaterial, Vector3 } from "three";
import type { PlanetEnvironment } from "../../types/environment";
import type { Planet } from "../../types/planet";
import type { VisualEnvironment } from "../../types/visual-environment";
import type { SkyExposure, SkyLoadStatus, SkyScenario } from "../../types/sky";
import { createSurface, createRocks, moltenChannelX, seedFromName, type RockPlacement } from "./surface-geometry";
import { ObserverCamera, type MovementInput } from "./observer-camera";
import { CatalogueSky } from "./catalogue-sky";

export interface PlanetSceneProps {
  planet: Planet;
  environment: PlanetEnvironment;
  visualEnvironment: VisualEnvironment;
  resetView?: number;
  movement?: MovementInput;
  skyScenario?: SkyScenario;
  skyExposure?: SkyExposure;
  onSkyStatus?: (status: SkyLoadStatus) => void;
}

/** The existing Canvas scene: all appearance comes from the visual mapper. */
export function PlanetScene({ planet, visualEnvironment: v, resetView = 0, movement,
  skyScenario = "night", skyExposure = "natural", onSkyStatus }: PlanetSceneProps) {
  const seed = useMemo(() => seedFromName(planet.name), [planet.name]);
  const celestialRotation = useMemo<[number,number,number]>(() => [
    skyScenario === "night" ? -Math.PI * 0.7 : -0.08,
    (seed % 360) * Math.PI / 180,
    0,
  ], [seed, skyScenario]);
  const surface = useMemo(() => createSurface(v, seed, v.surfacePreset === "gas-giant"), [v, seed]);
  const rocks = useMemo(() => createRocks(v, seed, surface.heightAt), [v,seed,surface]);
  useEffect(() => () => surface.geometry.dispose(), [surface]);
  return <>
    <color attach="background" args={[v.skyColor]} />
    <fog attach="fog" args={[v.horizonColor, v.fogNear, v.fogFar]} />
    <Sky v={v} />
    <CatalogueSky planetName={planet.name} scenario={skyScenario} exposure={skyExposure}
      atmosphereOpacity={v.atmosphereOpacity} rotation={celestialRotation} onStatus={onSkyStatus} />
    <CelestialHost v={v} rotation={celestialRotation} />
    <hemisphereLight args={[v.fillColor, v.groundColor, v.ambientIntensity * (skyScenario === "night" ? 0.48 : 1)]} />
    <group rotation={celestialRotation}><directionalLight position={v.starPosition} color={v.starColor}
      intensity={v.starIntensity * (skyScenario === "night" ? 0.22 : 1)}
      castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
      shadow-camera-left={-65} shadow-camera-right={65} shadow-camera-top={65} shadow-camera-bottom={-65}
      shadow-camera-near={1} shadow-camera-far={1000} shadow-normalBias={0.12} /></group>
    {v.surfacePreset === "gas-giant"
      ? <CloudDeck v={v} seed={seed} />
      : <RockySurface v={v} rocks={rocks} surface={surface} />}
    <ObserverCamera v={v} heightAt={surface.heightAt} rocks={rocks} resetView={resetView} movement={movement} />
  </>;
}

function RockySurface({ v, rocks, surface }: { v: VisualEnvironment; rocks: RockPlacement[]; surface: ReturnType<typeof createSurface> }) {
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
        diffuseColor.rgb = mix(diffuseColor.rgb,accent,frost*smoothstep(0.28,0.7,grit));`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n totalEmissiveRadiance = vec3(0.0);");
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
    {[0,1,2].map(variant => <Rocks key={variant} v={v} rocks={rocks.filter((_,i)=>i%3===variant)} variant={variant} />)}
    {v.landscape === "volcanic" && <MoltenChannels v={v} heightAt={surface.heightAt} />}
  </>;
}

function Rocks({ v, rocks, variant }: { v: VisualEnvironment; rocks: RockPlacement[]; variant: number }) {
  const instances = useRef<InstancedMesh>(null);
  const material=useMemo(()=>{
    const result=new MeshStandardMaterial({roughness:v.roughness,emissive:v.groundColor,emissiveIntensity:v.ambientIntensity*.06});
    result.onBeforeCompile=shader=>{
      shader.vertexShader="varying vec3 stonePoint;\n"+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\n stonePoint=position;");
      shader.fragmentShader="varying vec3 stonePoint;\n"+NOISE+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
        vec2 q=vec2(stonePoint.x+stonePoint.y*.7,stonePoint.z-stonePoint.y*.35)*4.;
        float grit=fbm(q); float fracture=abs(sin(stonePoint.y*13.+grit*4.));
        diffuseColor.rgb*=mix(.65,1.3,grit)*mix(.72,1.,smoothstep(.03,.13,fracture));`);
    };
    result.customProgramCacheKey=()=>"weathered-stone-v1";return result;
  },[v.roughness,v.groundColor,v.ambientIntensity]);
  useEffect(()=>()=>material.dispose(),[material]);
  const geometry = useMemo(() => {
    const result = new IcosahedronGeometry(1, v.landscape === "craters" ? 2 : 1);
    const positions = result.attributes.position;
    for(let i=0;i<positions.count;i++) {
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      const factor=1+Math.sin(x*7+y*3+variant)*Math.cos(z*9+variant)*.14;
      positions.setXYZ(i,x*factor,y*factor,z*factor);
    }
    result.computeVertexNormals(); return result;
  },[v.landscape,variant]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useLayoutEffect(() => {
    const matrix = new Object3D(), color = new Color(v.groundColor).lerp(new Color(v.groundAccentColor),v.frostCoverage*.5);
    for (let index = 0; index < rocks.length; index++) {
      const rock=rocks[index];
      matrix.position.set(rock.x,rock.y,rock.z);
      matrix.scale.set(rock.sx,rock.sy,rock.sz);
      matrix.rotation.set(0,rock.rotation,0); matrix.updateMatrix();
      instances.current!.setMatrixAt(index, matrix.matrix);
      instances.current!.setColorAt(index, color.clone().multiplyScalar(rock.shade));
    }
    instances.current!.instanceMatrix.needsUpdate = true;
    if (instances.current!.instanceColor) instances.current!.instanceColor.needsUpdate = true;
    instances.current!.computeBoundingSphere();
  }, [rocks, v]);
  return <instancedMesh ref={instances} geometry={geometry} material={material} args={[undefined, undefined, rocks.length]} castShadow receiveShadow />;
}
function CelestialHost({ v, rotation }: { v: VisualEnvironment; rotation: [number,number,number] }) {
  const group = useRef<Group>(null);
  useFrame(({ camera }) => { if (group.current) group.current.position.copy(camera.position); });
  return <group ref={group} rotation={rotation}><HostStar v={v} /></group>;
}

function MoltenChannels({v,heightAt}:{v:VisualEnvironment;heightAt:(x:number,z:number)=>number}) {
  const geometry=useMemo(()=>{
    const positions:number[]=[],indices:number[]=[];
    for(let channel=0;channel<3;channel++) for(let i=0;i<=600;i++) {
      const z=-180+i*.6, x=moltenChannelX(z,channel), width=.65+.25*Math.sin(z*.13+channel);
      for(const side of [-1,1]) {const px=x+side*width;positions.push(px,heightAt(px,z)+.055,z);}
      if(i<600) {const a=(channel*601+i)*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const result=new BufferGeometry();result.setAttribute("position",new Float32BufferAttribute(positions,3));result.setIndex(indices);result.computeVertexNormals();return result;
  },[heightAt]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry}><meshStandardMaterial color={v.groundAccentColor} emissive={v.groundAccentColor} emissiveIntensity={v.emissiveIntensity} roughness={.35} side={DoubleSide} polygonOffset polygonOffsetFactor={-1} /></mesh>;
}

const NOISE = `
float hash2(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
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
    starDirection: { value: new Vector3(...v.starPosition).normalize() },
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
      vertexShader={`varying vec3 p,cloudNormal;varying float depth;void main(){p=position;cloudNormal=normalize(mat3(modelMatrix)*normal);vec4 view=modelViewMatrix*vec4(position,1.);depth=-view.z;gl_Position=projectionMatrix*view;}`}
      fragmentShader={NOISE+`varying vec3 p,cloudNormal;varying float depth;uniform float time,opacity,seed;uniform vec3 dark,light,horizon,starDirection;uniform vec2 fogRange;
      void main(){vec2 q=p.xz*vec2(.016,.024)+vec2(time,seed);float n=fbm(q+vec2(fbm(q*.65)*3.,0.));
      float bands=fbm(q*vec2(.45,2.3)); float density=smoothstep(.22,.76,n*.75+bands*.25);
      float billows=fbm(q*3.1+vec2(n*2.));
      vec3 c=mix(dark,light,smoothstep(.12,.82,density*.7+billows*.3));c*=.55+.45*max(0.,dot(normalize(cloudNormal),starDirection));c=mix(c,horizon,smoothstep(fogRange.x,fogRange.y,depth));
      gl_FragColor=vec4(c,opacity>=1.?1.:smoothstep(.18,.65,n)*opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`} />
  </mesh>;
}

