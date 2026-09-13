/** The supplied Arduino catalogue is a 2D Earth-view sample, not 3D astrometry. */
export interface EarthViewStar {
  /** Unique source-row identity; never HIP 0. Stable while source order is unchanged. */
  id: string;
  hipId: number | null;
  name: string | null;
  rightAscensionDeg: number;
  declinationDeg: number;
  apparentVisualMagnitude: number;
  colorRgb565: number;
  /** Display RGB, not linear-light shader RGB or a measured stellar spectrum. */
  colorHex: string;
  distancePc: null;
  coordinateEpoch: null;
}

export interface EarthConstellationSegment {
  id: string;
  hip1: number;
  hip2: number;
  /** Null for missing or ambiguous endpoints; skip the segment when either is null. */
  starId1: string | null;
  starId2: string | null;
}

export interface ArduinoSkyCatalogue {
  metadata: {
    schemaVersion: number;
    observer: string;
    coordinateSystem: string;
    coordinateFrame: null;
    coordinateEpoch: null;
    distanceUnit: string;
    magnitudeDescription: string;
    colorDescription: string;
    sources: { file: string; sha256: string }[];
    limitations: string[];
  };
  stars: EarthViewStar[];
  segments: EarthConstellationSegment[];
  validation: {
    starCount: number;
    segmentCount: number;
    starsWithoutHip: number;
    duplicateHipIds: { hipId: number; starIds: string[] }[];
    unresolvedEndpoints: { segmentId: string; endpoint: number; hipId: number; reason: string }[];
    unresolvedSegmentCount: number;
    magnitudeRange: number[];
    warnings: string[];
  };
}

export type CartesianVector = [number, number, number];

/** Offline-enriched catalogue input in equatorial J2000 Cartesian coordinates. */
export interface CatalogueStar {
  sourceId: string;
  positionPc: CartesianVector;
  absoluteMagnitudeV: number;
}

/** Full-sphere result before any assumed surface orientation is applied. */
export interface DerivedSkyStar {
  sourceId: string;
  direction: CartesianVector;
  distanceFromDestinationPc: number;
  apparentMagnitudeV: number;
  relativeFluxToV0: number;
}

export interface CachedSkyManifestEntry {
  planetName: string;
  hostName: string;
  observerPositionPc: CartesianVector;
  candidateCountBeforeCap: number;
  starCount: number;
  limitingMagnitudeV: number;
  maximumRenderStars: number;
  excludedHostHygIds: string[];
  excludedHostCount: number;
  sunCount: number;
  binary: { file: string; bytes: number; sha256: string };
  sidecar: { file: string; bytes: number; sha256: string };
}
