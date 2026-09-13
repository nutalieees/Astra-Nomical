import type { CartesianVector, CatalogueStar, DerivedSkyStar } from '../../types/sky';

const DEG_TO_RAD = Math.PI / 180;

export function equatorialToCartesianPc(
  rightAscensionDeg: number,
  declinationDeg: number,
  distancePc: number,
): CartesianVector {
  if (![rightAscensionDeg, declinationDeg, distancePc].every(Number.isFinite) ||
      rightAscensionDeg < 0 || rightAscensionDeg >= 360 ||
      declinationDeg < -90 || declinationDeg > 90 || distancePc < 0) {
    throw new Error('Invalid equatorial coordinate or distance');
  }
  const ra = rightAscensionDeg * DEG_TO_RAD;
  const dec = declinationDeg * DEG_TO_RAD;
  const radial = distancePc * Math.cos(dec);
  return [radial * Math.cos(ra), radial * Math.sin(ra), distancePc * Math.sin(dec)];
}

export function apparentToAbsoluteMagnitude(apparentMagnitude: number, distancePc: number): number {
  if (!Number.isFinite(apparentMagnitude) || !Number.isFinite(distancePc) || distancePc <= 0) {
    throw new Error('Magnitude conversion requires finite magnitude and positive distance');
  }
  return apparentMagnitude - 5 * Math.log10(distancePc / 10);
}

export function absoluteToApparentMagnitude(absoluteMagnitude: number, distancePc: number): number {
  if (!Number.isFinite(absoluteMagnitude) || !Number.isFinite(distancePc) || distancePc <= 0) {
    throw new Error('Magnitude conversion requires finite magnitude and positive distance');
  }
  return absoluteMagnitude + 5 * Math.log10(distancePc / 10);
}

export function magnitudeToRelativeFlux(apparentMagnitude: number, referenceMagnitude = 0): number {
  if (!Number.isFinite(apparentMagnitude) || !Number.isFinite(referenceMagnitude)) {
    throw new Error('Flux conversion requires finite magnitudes');
  }
  return 10 ** (-0.4 * (apparentMagnitude - referenceMagnitude));
}

/** Converts catalogue axes (X=RA 0h, Y=RA 6h, Z=north) to the scene's Y-up basis. */
export function catalogueDirectionToScene([x, y, z]: CartesianVector): CartesianVector {
  return [x, z, -y];
}

export function deriveDestinationStar(star: CatalogueStar, observerPositionPc: CartesianVector): DerivedSkyStar {
  const relative: CartesianVector = [
    star.positionPc[0] - observerPositionPc[0],
    star.positionPc[1] - observerPositionPc[1],
    star.positionPc[2] - observerPositionPc[2],
  ];
  const distanceFromDestinationPc = Math.hypot(...relative);
  if (!Number.isFinite(distanceFromDestinationPc) || distanceFromDestinationPc <= 1e-9) {
    throw new Error(`Star ${star.sourceId} is coincident with the observer`);
  }
  const direction = relative.map(value => value / distanceFromDestinationPc) as CartesianVector;
  const apparentMagnitudeV = absoluteToApparentMagnitude(star.absoluteMagnitudeV, distanceFromDestinationPc);
  const relativeFluxToV0 = magnitudeToRelativeFlux(apparentMagnitudeV);
  if (![...direction, apparentMagnitudeV, relativeFluxToV0].every(Number.isFinite)) {
    throw new Error(`Nonfinite destination result for ${star.sourceId}`);
  }
  return { sourceId: star.sourceId, direction, distanceFromDestinationPc, apparentMagnitudeV, relativeFluxToV0 };
}
