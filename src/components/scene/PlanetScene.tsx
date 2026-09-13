"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  MathUtils,
  Points as ThreePoints,
  SphereGeometry,
  Vector3,
} from "three";
import type { PlanetEnvironment } from "../../types/environment";
import type { Planet } from "../../types/planet";
import type { VisualEnvironment } from "../../types/visual-environment";

export interface PlanetSceneProps {
  planet: Planet;
  environment: PlanetEnvironment;
  visualEnvironment: VisualEnvironment;
}

const TERRAIN_RADIUS = 80;
const STAR_POSITION = new Vector3(24, 27, -62);

/**
 * A reusable React Three Fiber scene, intended to be rendered inside a
 * `<Canvas>`. It deliberately owns scene contents only; routing, controls,
 * HUD, and page layout remain outside this component.
 */
export function PlanetScene({
  planet,
  environment,
  visualEnvironment,
}: PlanetSceneProps) {
  const terrain = useTerrainGeometry(planet.name, visualEnvironment);
  const starfield = useStarfield(planet.name);
  const terrainRadius = TERRAIN_RADIUS / visualEnvironment.horizonCurvature;
  const particles = useAtmosphereParticles(planet.name, visualEnvironment, terrainRadius);
  const starPosition = useMemo(
    () => STAR_POSITION.clone().multiplyScalar(0.72 + visualEnvironment.starSize * 0.08),
    [visualEnvironment.starSize]
  );
  const hazeDistance = MathUtils.lerp(145, 58, visualEnvironment.hazeDensity);

  useEffect(() => () => terrain.dispose(), [terrain]);
  useEffect(() => () => starfield.dispose(), [starfield]);
  useEffect(() => () => particles.dispose(), [particles]);

  return (
    <>
      <color attach="background" args={[visualEnvironment.skyColor]} />
      <fog attach="fog" args={[visualEnvironment.horizonColor, 14, hazeDistance]} />

      <Sky color={visualEnvironment.skyColor} />
      <Starfield geometry={starfield} />
      <HostStar
        color={visualEnvironment.starColor}
        position={starPosition}
        size={visualEnvironment.starSize}
        intensity={visualEnvironment.starIntensity}
      />

      <ambientLight intensity={visualEnvironment.ambientIntensity} color={visualEnvironment.horizonColor} />
      <directionalLight
        position={starPosition}
        color={visualEnvironment.starColor}
        intensity={visualEnvironment.starIntensity}
        castShadow={false}
      />

      <mesh geometry={terrain} position={[0, -terrainRadius, 0]} receiveShadow={false}>
        <meshStandardMaterial
          color={visualEnvironment.groundColor}
          roughness={visualEnvironment.surfacePreset === "gas-giant" ? 0.42 : 0.88}
          metalness={visualEnvironment.surfacePreset === "lava-rock" ? 0.18 : 0.03}
          emissive={visualEnvironment.groundAccentColor}
          emissiveIntensity={visualEnvironment.emissiveIntensity}
          vertexColors
        />
      </mesh>

      <HorizonHaze visualEnvironment={visualEnvironment} radius={terrainRadius} />
      <AtmosphericParticles geometry={particles} visualEnvironment={visualEnvironment} />
      <CameraDrift gravityEarth={environment.gravityEarth} visualEnvironment={visualEnvironment} />
    </>
  );
}

function Sky({ color }: { color: string }) {
  return (
    <mesh>
      <sphereGeometry args={[190, 24, 16]} />
      <meshBasicMaterial color={color} side={BackSide} depthWrite={false} />
    </mesh>
  );
}

function HostStar({
  color,
  position,
  size,
  intensity,
}: {
  color: string;
  position: Vector3;
  size: number;
  intensity: number;
}) {
  const starRadius = 1.6 + size * 0.68;
  return (
    <mesh position={position}>
      <sphereGeometry args={[starRadius, 24, 16]} />
      <meshBasicMaterial color={color} toneMapped={false} />
      <mesh scale={1.9 + intensity * 0.16}>
        <sphereGeometry args={[starRadius, 20, 14]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh scale={3.1 + intensity * 0.2}>
        <sphereGeometry args={[starRadius, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.035} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <pointLight color={color} intensity={intensity * 1.15} distance={150} decay={1.4} />
    </mesh>
  );
}

function HorizonHaze({
  visualEnvironment,
  radius,
}: {
  visualEnvironment: VisualEnvironment;
  radius: number;
}) {
  if (visualEnvironment.atmosphereOpacity <= 0.03) return null;

  return (
    <mesh position={[0, -radius, 0]}>
      <sphereGeometry args={[radius + 0.45, 64, 40]} />
      <meshBasicMaterial
        color={visualEnvironment.horizonColor}
        transparent
        opacity={visualEnvironment.atmosphereOpacity}
        side={BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function CameraDrift({
  gravityEarth,
  visualEnvironment,
}: {
  gravityEarth: number;
  visualEnvironment: VisualEnvironment;
}) {
  const { camera } = useThree();
  const treatment = useMemo(
    () => cameraTreatmentFor(visualEnvironment.surfacePreset),
    [visualEnvironment.surfacePreset]
  );
  const lookTarget = useMemo(
    () => new Vector3(0, treatment.targetHeight, treatment.targetDistance),
    [treatment.targetDistance, treatment.targetHeight]
  );
  const height = MathUtils.clamp(3.3 - Math.log2(Math.max(gravityEarth, 0.2)) * 0.18, 2.8, 3.8);

  useEffect(() => {
    camera.position.set(0, height + treatment.heightOffset, treatment.distance);
    camera.lookAt(lookTarget);
  }, [camera, height, lookTarget]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    camera.position.x = Math.sin(elapsed * treatment.swaySpeed) * treatment.sway;
    camera.position.y = height + treatment.heightOffset + Math.sin(elapsed * treatment.bobSpeed) * treatment.bob;
    camera.lookAt(lookTarget.x, lookTarget.y + Math.sin(elapsed * 0.11) * treatment.targetDrift, lookTarget.z);
  });

  return null;
}

function AtmosphericParticles({
  geometry,
  visualEnvironment,
}: {
  geometry: BufferGeometry;
  visualEnvironment: VisualEnvironment;
}) {
  const points = useRef<ThreePoints>(null);
  const isGiant = visualEnvironment.surfacePreset === "gas-giant";
  const isLava = visualEnvironment.surfacePreset === "lava-rock";

  useFrame((_, delta) => {
    if (points.current) points.current.rotation.y += delta * (isGiant ? 0.024 : isLava ? 0.06 : 0.015);
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        color={visualEnvironment.groundAccentColor}
        size={isGiant ? 0.72 : isLava ? 0.38 : 0.24}
        sizeAttenuation
        transparent
        opacity={isGiant ? 0.34 : isLava ? 0.5 : 0.25}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

function Starfield({ geometry }: { geometry: BufferGeometry }) {
  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#d7e7ff"
        size={0.38}
        sizeAttenuation
        transparent
        opacity={0.78}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

function useTerrainGeometry(name: string, visualEnvironment: VisualEnvironment): SphereGeometry {
  return useMemo(() => {
    const radius = TERRAIN_RADIUS / visualEnvironment.horizonCurvature;
    const geometry = new SphereGeometry(radius, 96, 56);
    const positions = geometry.attributes.position;
    const seed = hash(name);
    const amplitude = visualEnvironment.terrainAmplitude * radius;
    const colors = new Float32Array(positions.count * 3);
    const ground = new Color(visualEnvironment.groundColor);
    const accent = new Color(visualEnvironment.groundAccentColor);
    const vertexColor = new Color();

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      const unit = new Vector3(x, y, z).normalize();
      const noise = terrainNoise(unit, seed, visualEnvironment.terrainFrequency);
      const banding =
        visualEnvironment.surfacePreset === "gas-giant"
          ? Math.sin((unit.y * 11 + unit.x * 2.5 + seed) * 1.7) * 0.42
          : 0;
      const displacedRadius = radius + (noise + banding) * amplitude;
      const accentMix = terrainAccentMix(visualEnvironment.surfacePreset, noise, banding, unit.y);

      positions.setXYZ(index, unit.x * displacedRadius, unit.y * displacedRadius, unit.z * displacedRadius);
      vertexColor.copy(ground).lerp(accent, accentMix);
      vertexColor.toArray(colors, index * 3);
    }

    positions.needsUpdate = true;
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [
    name,
    visualEnvironment.horizonCurvature,
    visualEnvironment.groundAccentColor,
    visualEnvironment.groundColor,
    visualEnvironment.surfacePreset,
    visualEnvironment.terrainAmplitude,
    visualEnvironment.terrainFrequency,
  ]);
}

function useAtmosphereParticles(
  name: string,
  visualEnvironment: VisualEnvironment,
  radius: number
): BufferGeometry {
  return useMemo(() => {
    const count = visualEnvironment.surfacePreset === "gas-giant" ? 340 : 220;
    const random = seededRandom(hash(`${name}:${visualEnvironment.surfacePreset}:particles`));
    const positions = new Float32Array(count * 3);

    for (let index = 0; index < positions.length; index += 3) {
      const theta = random() * Math.PI * 2;
      const y = random() * 2 - 1;
      const horizontal = Math.sqrt(1 - y * y);
      const shell = radius + 0.8 + random() * (visualEnvironment.surfacePreset === "gas-giant" ? 10 : 4);
      positions[index] = Math.cos(theta) * horizontal * shell;
      positions[index + 1] = y * shell - radius;
      positions[index + 2] = Math.sin(theta) * horizontal * shell;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return geometry;
  }, [name, radius, visualEnvironment.surfacePreset]);
}

function terrainAccentMix(
  preset: VisualEnvironment["surfacePreset"],
  noise: number,
  banding: number,
  elevation: number
): number {
  if (preset === "gas-giant") return MathUtils.clamp(0.42 + banding * 1.05 + noise * 0.2, 0.08, 0.88);
  if (preset === "lava-rock") return MathUtils.clamp(0.18 + (noise + 0.8) * 0.48, 0.08, 0.92);
  if (preset === "ice-rock") return MathUtils.clamp(0.36 + noise * 0.25 + Math.max(elevation, 0) * 0.18, 0.12, 0.82);
  return MathUtils.clamp(0.24 + noise * 0.34, 0.08, 0.72);
}

function cameraTreatmentFor(preset: VisualEnvironment["surfacePreset"]) {
  switch (preset) {
    case "gas-giant":
      return { distance: 11.5, heightOffset: 0.3, targetHeight: -2.2, targetDistance: -50, sway: 0.86, swaySpeed: 0.09, bob: 0.18, bobSpeed: 0.14, targetDrift: 0.65 };
    case "lava-rock":
      return { distance: 8.4, heightOffset: -0.25, targetHeight: -0.5, targetDistance: -35, sway: 0.34, swaySpeed: 0.19, bob: 0.08, bobSpeed: 0.28, targetDrift: 0.22 };
    case "ice-rock":
      return { distance: 10.8, heightOffset: 0.45, targetHeight: -1.8, targetDistance: -48, sway: 0.66, swaySpeed: 0.11, bob: 0.1, bobSpeed: 0.16, targetDrift: 0.4 };
    default:
      return { distance: 9.5, heightOffset: 0, targetHeight: -1, targetDistance: -42, sway: 0.55, swaySpeed: 0.13, bob: 0.12, bobSpeed: 0.19, targetDrift: 0.35 };
  }
}

function useStarfield(name: string): BufferGeometry {
  return useMemo(() => {
    const random = seededRandom(hash(`${name}:starfield`));
    const positions = new Float32Array(900 * 3);

    for (let index = 0; index < positions.length; index += 3) {
      const radius = 95 + random() * 72;
      const theta = random() * Math.PI * 2;
      const y = random() * 2 - 1;
      const horizontal = Math.sqrt(1 - y * y);
      positions[index] = Math.cos(theta) * horizontal * radius;
      positions[index + 1] = y * radius + 20;
      positions[index + 2] = Math.sin(theta) * horizontal * radius;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return geometry;
  }, [name]);
}

function terrainNoise(point: Vector3, seed: number, frequency: number): number {
  const x = point.x * frequency;
  const y = point.y * frequency;
  const z = point.z * frequency;
  return (
    Math.sin(x * 2.1 + seed) * 0.45 +
    Math.sin(y * 3.7 - seed * 0.7) * 0.28 +
    Math.sin(z * 4.9 + seed * 0.3) * 0.18 +
    Math.sin((x + z) * 7.2 + seed) * 0.09
  );
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0) / 4294967296 * Math.PI * 2;
}

function seededRandom(seed: number): () => number {
  let state = Math.floor(seed * 4294967296) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
