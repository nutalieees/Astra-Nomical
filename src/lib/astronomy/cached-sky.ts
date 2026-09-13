import type { CachedSkyManifestEntry, CartesianVector } from '../../types/sky';

const HEADER_BYTES = 16;
const RECORD_BYTES = 28;

export interface DecodedSkyBuffer {
  directions: Float32Array;
  colors: Uint8Array;
  flags: Uint8Array;
  apparentMagnitudesV: Float32Array;
  relativeFluxesToV0: Float32Array;
  distancesPc: Float32Array;
}

export const FEATURED_SKY_SLUGS: Record<string, string> = {
  'TRAPPIST-1 e': 'trappist-1-e',
  'Proxima Centauri b': 'proxima-centauri-b',
  '55 Cancri e': '55-cancri-e',
  'WASP-121 b': 'wasp-121-b',
  'Kepler-186 f': 'kepler-186-f',
};

export function decodeSkyBuffer(arrayBuffer: ArrayBuffer): DecodedSkyBuffer {
  const view = new DataView(arrayBuffer);
  if (arrayBuffer.byteLength < HEADER_BYTES ||
      String.fromCharCode(...new Uint8Array(arrayBuffer, 0, 4)) !== 'ASKY') {
    throw new Error('Invalid cached sky header');
  }
  const version = view.getUint16(4, true);
  const stride = view.getUint16(6, true);
  const count = view.getUint32(8, true);
  if (version !== 1 || stride !== RECORD_BYTES || arrayBuffer.byteLength !== HEADER_BYTES + count * stride) {
    throw new Error('Unsupported or truncated cached sky');
  }
  const directions = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 3);
  const flags = new Uint8Array(count);
  const apparentMagnitudesV = new Float32Array(count);
  const relativeFluxesToV0 = new Float32Array(count);
  const distancesPc = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    const offset = HEADER_BYTES + index * stride;
    for (let axis = 0; axis < 3; axis++) directions[index * 3 + axis] = view.getFloat32(offset + axis * 4, true);
    for (let channel = 0; channel < 3; channel++) colors[index * 3 + channel] = view.getUint8(offset + 12 + channel);
    flags[index] = view.getUint8(offset + 15);
    apparentMagnitudesV[index] = view.getFloat32(offset + 16, true);
    relativeFluxesToV0[index] = view.getFloat32(offset + 20, true);
    distancesPc[index] = view.getFloat32(offset + 24, true);
  }
  return { directions, colors, flags, apparentMagnitudesV, relativeFluxesToV0, distancesPc };
}

export async function loadCachedSky(entry: CachedSkyManifestEntry): Promise<DecodedSkyBuffer> {
  const response = await fetch(`/data/skies/${entry.binary.file}`);
  if (!response.ok) throw new Error(`Unable to load cached sky for ${entry.planetName}: HTTP ${response.status}`);
  return decodeSkyBuffer(await response.arrayBuffer());
}

export function isUnitDirection(direction: CartesianVector, tolerance = 1e-5): boolean {
  return Math.abs(Math.hypot(...direction) - 1) <= tolerance;
}
