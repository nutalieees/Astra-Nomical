"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Float32BufferAttribute,
  MathUtils,
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
  const starPosition = useMemo(
    () => STAR_POSITION.clone().multiplyScalar(0.72 + visualEnvironment.starSize * 0.08),
    [visualEnvironment.starSize]
  );
  const hazeDistance = MathUtils.lerp(145, 58, visualEnvironment.hazeDensity);

  useEffect(() => () => terrain.dispose(), [terrain]);
  useEffect(() => () => starfield.dispose(), [starfield]);

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
        />
      </mesh>

      <HorizonHaze visualEnvironment={visualEnvironment} radius={terrainRadius} />
      <CameraDrift gravityEarth={environment.gravityEarth} />
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

function CameraDrift({ gravityEarth }: { gravityEarth: number }) {
  const { camera } = useThree();
  const lookTarget = useMemo(() => new Vector3(0, -1, -42), []);
  const height = MathUtils.clamp(3.3 - Math.log2(Math.max(gravityEarth, 0.2)) * 0.18, 2.8, 3.8);

  useEffect(() => {
    camera.position.set(0, height, 9.5);
    camera.lookAt(lookTarget);
  }, [camera, height, lookTarget]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    camera.position.x = Math.sin(elapsed * 0.13) * 0.55;
    camera.position.y = height + Math.sin(elapsed * 0.19) * 0.12;
    camera.lookAt(lookTarget.x, lookTarget.y + Math.sin(elapsed * 0.11) * 0.35, lookTarget.z);
  });

  return null;
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

      positions.setXYZ(index, unit.x * displacedRadius, unit.y * displacedRadius, unit.z * displacedRadius);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }, [
    name,
    visualEnvironment.horizonCurvature,
    visualEnvironment.surfacePreset,
    visualEnvironment.terrainAmplitude,
    visualEnvironment.terrainFrequency,
  ]);
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
