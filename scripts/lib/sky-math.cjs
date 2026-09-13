const DEG_TO_RAD = Math.PI / 180;

function assertFiniteVector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new Error(`${label} must contain three finite numbers`);
  }
}

function equatorialToCartesianPc(rightAscensionDeg, declinationDeg, distancePc) {
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

function translateObserver(starPositionPc, observerPositionPc) {
  assertFiniteVector(starPositionPc, 'starPositionPc');
  assertFiniteVector(observerPositionPc, 'observerPositionPc');
  const relative = starPositionPc.map((value, index) => value - observerPositionPc[index]);
  const distancePc = Math.hypot(...relative);
  if (!Number.isFinite(distancePc) || distancePc <= 1e-9) {
    throw new Error('Star is coincident with the observer');
  }
  return { relativePositionPc: relative, distancePc, direction: relative.map(value => value / distancePc) };
}

function apparentToAbsoluteMagnitude(apparentMagnitude, distancePc) {
  if (!Number.isFinite(apparentMagnitude) || !Number.isFinite(distancePc) || distancePc <= 0) {
    throw new Error('Magnitude conversion requires finite magnitude and positive distance');
  }
  return apparentMagnitude - 5 * Math.log10(distancePc / 10);
}

function absoluteToApparentMagnitude(absoluteMagnitude, distancePc) {
  if (!Number.isFinite(absoluteMagnitude) || !Number.isFinite(distancePc) || distancePc <= 0) {
    throw new Error('Magnitude conversion requires finite magnitude and positive distance');
  }
  return absoluteMagnitude + 5 * Math.log10(distancePc / 10);
}

function magnitudeToRelativeFlux(apparentMagnitude, referenceMagnitude = 0) {
  if (!Number.isFinite(apparentMagnitude) || !Number.isFinite(referenceMagnitude)) {
    throw new Error('Flux conversion requires finite magnitudes');
  }
  return 10 ** (-0.4 * (apparentMagnitude - referenceMagnitude));
}

function deriveDestinationStar(star, observerPositionPc, referenceMagnitude = 0) {
  const translated = translateObserver(star.positionPc, observerPositionPc);
  const apparentMagnitude = absoluteToApparentMagnitude(star.absoluteMagnitudeV, translated.distancePc);
  const relativeFlux = magnitudeToRelativeFlux(apparentMagnitude, referenceMagnitude);
  if (![...translated.direction, translated.distancePc, apparentMagnitude, relativeFlux].every(Number.isFinite)) {
    throw new Error(`Nonfinite destination result for ${star.sourceId}`);
  }
  return { ...translated, apparentMagnitude, relativeFlux };
}

module.exports = {
  equatorialToCartesianPc,
  translateObserver,
  apparentToAbsoluteMagnitude,
  absoluteToApparentMagnitude,
  magnitudeToRelativeFlux,
  deriveDestinationStar,
};
