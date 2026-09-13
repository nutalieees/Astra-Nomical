"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Group, MeshPhysicalMaterial, MeshStandardMaterial, Vector3, CatmullRomCurve3, TubeGeometry } from "three";
import type { OrganismSceneSpec } from "../../lib/evolve-life/organism-scene";
import type { VisualEnvironment } from "../../types/visual-environment";
import { createOrganismGeometry, organismDimensions } from "./organism-geometry";

const TISSUE_NOISE = `
float ohash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float onoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(ohash(i),ohash(i+vec3(1,0,0)),f.x),mix(ohash(i+vec3(0,1,0)),ohash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(ohash(i+vec3(0,0,1)),ohash(i+vec3(1,0,1)),f.x),mix(ohash(i+vec3(0,1,1)),ohash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float otissue(vec3 p){return onoise(p)*.56+onoise(p*2.07)*.27+onoise(p*4.13)*.12+onoise(p*8.11)*.05;}
vec2 ocell(vec2 p){vec2 i=floor(p),f=fract(p);float first=8.,second=8.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 q=vec2(float(x),float(y));
vec2 jitter=vec2(ohash(vec3(i+q,1.)),ohash(vec3(i+q,7.)))*.7+.15;float d=length(q+jitter-f);
if(d<first){second=first;first=d;}else if(d<second){second=d;}}
return vec2(first,second-first);}
`;

/** Physically lit tissue with procedural pores, fine folds and restrained subsurface-like fill. */
function createTissueMaterial(spec: OrganismSceneSpec, v: VisualEnvironment, seed: number) {
  const mineral = spec.surface === "mineral", plated = spec.surface === "plated", wet = spec.surface === "mucous";
  // Color is a restrained illustration convention; no unmeasured chemistry is inferred.
  const base = new Color(mineral ? "#92877a" : plated ? "#7b8470" : spec.activity === "dormant" ? "#829b87" : "#97b6a1");
  const material = new MeshPhysicalMaterial({
    color: base, roughness: mineral ? 0.86 : plated ? 0.58 : wet ? 0.3 : 0.48,
    metalness: 0, clearcoat: wet ? 0.35 : 0.16, clearcoatRoughness: 0.4,
    sheen: mineral ? 0 : 0.35, sheenColor: new Color("#c3baa5"), sheenRoughness: 0.72,
    specularIntensity: 0.65,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.organismSeed = { value: (seed % 127) * 0.31 };
    shader.uniforms.organismCells = { value: spec.organization === "unicellular" ? 0 : 1 };
    shader.uniforms.organismWarmth = { value: new Color(v.starColor).multiplyScalar(mineral || plated ? 0.012 : 0.035) };
    shader.vertexShader = "varying vec3 organismPoint;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n organismPoint=position;");
    shader.fragmentShader = "varying vec3 organismPoint; uniform float organismSeed,organismCells; uniform vec3 organismWarmth;\n" + TISSUE_NOISE + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      vec3 op=organismPoint+vec3(organismSeed);
      float mottling=otissue(op*4.3), pores=onoise(op*110.);
      vec2 cells=ocell(organismPoint.xz*19. + vec2(otissue(op*9.))*.8);
      float seams=(1.-smoothstep(.022,.095,cells.y))*organismCells;
      float folds=pow(.5+.5*sin(organismPoint.z*115.+otissue(op*17.)*8.),12.);
      float microrelief=mottling*.55 + pores*.12 - seams*.12 - folds*.065;
      diffuseColor.rgb*=mix(.5,1.5,mottling);
      diffuseColor.rgb=mix(diffuseColor.rgb, diffuseColor.rgb*vec3(.45,.61,.5),seams*.65);
      diffuseColor.rgb*=1.-folds*.09;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.38,.29,.18),smoothstep(.73,.9,otissue(op*15.))*.14);`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      vec3 oqx=dFdx(-vViewPosition),oqy=dFdy(-vViewPosition);
      vec3 os=cross(oqy,normal),ot=cross(normal,oqx);
      float odet=dot(oqx,os);
      vec3 ogradient=(dFdx(microrelief)*os+dFdy(microrelief)*ot)*sign(odet)/max(abs(odet),.000001);
      normal=normalize(normal - .022*ogradient);`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n roughnessFactor=clamp(roughnessFactor+(pores-.5)*.2+seams*.08,.2,1.);");
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance+=organismWarmth*(.35+.65*pow(1.-abs(dot(normal,normalize(vViewPosition))),3.));");
  };
  material.customProgramCacheKey = () => "organism-tissue-v1";
  return material;
}

export function OrganismModel({ spec, v, seed, position, displayScale }: {
  spec: OrganismSceneSpec; v: VisualEnvironment; seed: number;
  position: [number, number, number]; displayScale: number;
}) {
  const group = useRef<Group>(null);
  const time = useRef(0), reduced = useRef(false);
  const geometry = useMemo(() => createOrganismGeometry(spec, seed), [spec, seed]);
  const tissue = useMemo(() => createTissueMaterial(spec, v, seed), [spec, v, seed]);
  const accent = useMemo(() => new MeshStandardMaterial({ color: spec.surface === "plated" ? "#5e5a4c" : "#5f7664", roughness: 0.64, metalness: 0 }), [spec.surface]);
  const support = useMemo(() => {
    const rock = createOrganismGeometry({ ...spec, form: "cushion", proportions: { length: 1.1, width: 1.2, height: .11 } }, seed + 11);
    const points = rock.getAttribute("position");
    for (let i=0;i<points.count;i++) {
      const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
      const uneven=1+.06*Math.sin(x*11+z*7)+.035*Math.cos(z*19-x*5);
      points.setXYZ(i,x*uneven,y,z*uneven);
    }
    rock.computeVertexNormals();
    return rock;
  }, [spec,seed]);
  const d = useMemo(() => organismDimensions(spec), [spec]);
  useEffect(() => () => { geometry.dispose(); tissue.dispose(); accent.dispose(); support.dispose(); }, [geometry, tissue, accent, support]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reduced.current = media.matches; };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useFrame((_, delta) => {
    if (!group.current) return;
    time.current += Math.min(delta, 0.05);
    // Dormant specimens remain completely still. Conditional movement never implies actual viability.
    const active = spec.activity === "conditional-active" && !reduced.current;
    const pulse = active ? Math.sin(time.current * 0.65) * 0.006 : 0;
    group.current.scale.set(displayScale * (1 - pulse * 0.3), displayScale * (1 + pulse), displayScale);
    group.current.rotation.y = active && spec.motion !== "sessile" ? Math.sin(time.current * 0.23) * 0.025 : 0;
  });
  return <group position={position} name="validated-organism">
    {v.surfacePreset !== "gas-giant" && <mesh geometry={support} position={[0,-0.21,0]} scale={[displayScale*1.13,displayScale,displayScale*1.1]} receiveShadow castShadow>
      <meshStandardMaterial color={v.groundColor} roughness={0.94} />
    </mesh>}
    <group ref={group} scale={displayScale}>
      <mesh geometry={geometry} material={tissue} castShadow receiveShadow />
      {spec.surface === "plated" && Array.from({ length: spec.segments }, (_, i) => {
        const z = ((i + 0.5) / spec.segments * 2 - 1) * d.z * 0.82;
        const width = d.x * Math.sqrt(Math.max(0.12, 1 - (z / d.z) ** 2));
        return <mesh key={`plate-${i}`} position={[0, d.y * (0.2 + 0.8 * Math.sqrt(1 - (z / d.z) ** 2)), z]} scale={[width * .92, d.y*.19, d.z / spec.segments * .9]} material={accent} castShadow receiveShadow>
          <sphereGeometry args={[1,32,14]} />
        </mesh>;
      })}
      <Appendages spec={spec} material={tissue} />
      {spec.senses === "pits" && [-1,1].map(side => <mesh key={side} position={[side*d.x*.3,d.y*.92,d.z*.65]} scale={[.035,.012,.055]}>
        <sphereGeometry args={[1,16,12]} /><meshStandardMaterial color="#28372e" roughness={.7} />
      </mesh>)}
      {spec.senses === "antennae" && [-1,1].map(side => <Tendril key={side} material={tissue} points={[
        [side*d.x*.35,d.y*.68,d.z*.7], [side*d.x*.5,d.y+0.22,d.z*.9], [side*d.x*.65,d.y+.34,d.z*1.1],
      ]} radius={.025} />)}
    </group>
    {/* A restrained observation fill keeps fine anatomy legible under the simulated host-star light. */}
    <pointLight position={[-3,4,4]} color="#d4e1e5" intensity={18} distance={14} decay={2} />
    <pointLight position={[3,2,-3]} color={v.starColor} intensity={7} distance={12} decay={2} />
  </group>;
}

function Appendages({ spec, material }: { spec: OrganismSceneSpec; material: MeshPhysicalMaterial }) {
  const d = organismDimensions(spec);
  if (spec.appendages.kind === "none") return null;
  return <>{Array.from({ length: spec.appendages.count }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const pairs = Math.max(1, Math.ceil(spec.appendages.count / 2));
    const z = ((Math.floor(index/2) + .5)/pairs * 2 - 1) * d.z * .8;
    const width = d.x * Math.sqrt(Math.max(.15, 1-(z/d.z)**2));
    const reach = spec.appendages.kind === "cilia" ? .15 : spec.appendages.kind === "legs" ? .45 : .24;
    return <Tendril key={index} material={material} points={[
      [side*width*.8, d.y*.35, z],
      [side*(width+reach*.65),d.y*.3+reach*.24,z-.07],
      [side*(width+reach), .025, z+.08],
    ]} radius={spec.appendages.kind === "cilia" ? .008 : spec.appendages.kind === "legs" ? .045 : .09} />;
  })}</>;
}

function Tendril({ points, radius, material }: { points: [number,number,number][]; radius: number; material: MeshPhysicalMaterial }) {
  const key = JSON.stringify(points);
  const geometry = useMemo(() => new TubeGeometry(new CatmullRomCurve3(points.map(p=>new Vector3(...p))),20,radius,8,false), [key,radius]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}
