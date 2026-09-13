/** All artistic controls are bounded by deriveVisualEnvironment. Scene distances are compressed. */
export interface VisualEnvironment {
  landscape: "ridges" | "craters" | "glacial" | "volcanic" | "clouds";
  surfacePreset: "cold-rock" | "temperate-rock" | "lava-rock" | "gas-giant";
  skyColor: string;
  horizonColor: string;
  groundColor: string;
  groundAccentColor: string;
  starColor: string;
  starIntensity: number;
  /** Bounded, visually scaled angular radius in radians. */
  starSize: number;
  starPosition: [number, number, number];
  ambientIntensity: number;
  fillColor: string;
  exposure: number;
  atmosphereOpacity: number;
  hazeDensity: number;
  fogNear: number;
  fogFar: number;
  terrainAmplitude: number;
  terrainFrequency: number;
  horizonRadius: number;
  horizonCurvature: number;
  roughness: number;
  rockCount: number;
  rockScale: number;
  frostCoverage: number;
  emissiveIntensity: number;
  cloudOpacity: number;
  cloudColor: string;
  cloudAccentColor: string;
  cloudSpeed: number;
  cloudHeight: number;
  starfieldOpacity: number;
  cameraHeight: number;
  cameraSway: number;
  cameraSpeed: number;
  cameraLookHeight: number;
  assumptions: string[];
}
