const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  equatorialToCartesianPc,
  translateObserver,
  apparentToAbsoluteMagnitude,
  absoluteToApparentMagnitude,
  magnitudeToRelativeFlux,
  deriveDestinationStar,
} = require('./lib/sky-math.cjs');
const { buildSky, writeBinary } = require('./build-planet-skies.cjs');

const close = (actual, expected, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('equatorial coordinate axes use the documented J2000 Cartesian basis', () => {
  const cases = [
    [0, 0, [1, 0, 0]], [90, 0, [0, 1, 0]], [180, 0, [-1, 0, 0]],
    [0, 90, [0, 0, 1]], [0, -90, [0, 0, -1]],
  ];
  for (const [ra, dec, expected] of cases) {
    equatorialToCartesianPc(ra, dec, 1).forEach((value, index) => close(value, expected[index]));
  }
});

test('Earth-origin reconstruction preserves direction and apparent magnitude', () => {
  const distancePc = 42;
  const positionPc = equatorialToCartesianPc(123, -27, distancePc);
  const absoluteMagnitudeV = apparentToAbsoluteMagnitude(4.2, distancePc);
  const result = deriveDestinationStar({ sourceId: 'synthetic', positionPc, absoluteMagnitudeV }, [0, 0, 0]);
  const expected = equatorialToCartesianPc(123, -27, 1);
  result.direction.forEach((value, index) => close(value, expected[index]));
  close(result.apparentMagnitude, 4.2);
  close(result.distancePc, distancePc);
});

test('tenfold distance adds five magnitudes and reduces flux by 100', () => {
  const near = absoluteToApparentMagnitude(3, 10);
  const far = absoluteToApparentMagnitude(3, 100);
  close(far - near, 5);
  close(magnitudeToRelativeFlux(near) / magnitudeToRelativeFlux(far), 100, 1e-10);
});

test('translation rejects a star at the observer and never returns nonfinite values', () => {
  assert.throws(() => translateObserver([1, 2, 3], [1, 2, 3]), /coincident/);
  assert.throws(() => translateObserver([Number.NaN, 2, 3], [0, 0, 0]), /finite/);
  const result = translateObserver([2, 3, 6], [1, 1, 1]);
  assert.ok([...result.direction, result.distancePc].every(Number.isFinite));
  close(Math.hypot(...result.direction), 1);
});

test('host identity is excluded while the Sun and curated companion remain', () => {
  const base = { hipId: null, name: null, earthDistancePc: 1, earthApparentMagnitudeV: 1,
    suppliedAbsoluteMagnitudeV: 1, bMinusV: 0.6, isSun: false };
  const stars = [
    { ...base, sourceId: 'hyg:host', hygId: 'host', positionPc: [10, 0, 0], absoluteMagnitudeV: 1 },
    { ...base, sourceId: 'hyg:companion', hygId: 'companion', positionPc: [10, 1, 0], absoluteMagnitudeV: 20 },
    { ...base, sourceId: 'hyg:background', hygId: 'background', positionPc: [20, 0, 0], absoluteMagnitudeV: 1 },
    { ...base, sourceId: 'hyg:0', hygId: '0', name: 'Sol', positionPc: [0, 0, 0],
      earthDistancePc: 0, earthApparentMagnitudeV: -26.7, absoluteMagnitudeV: 4.85, suppliedAbsoluteMagnitudeV: 4.85, isSun: true },
  ];
  const system = { planetName: 'Synthetic b', rightAscensionDeg: 0, declinationDeg: 0, distancePc: 10,
    hostHygIds: ['host'], significantCompanions: [{ hygId: 'companion', name: 'Companion' }] };
  const result = buildSky(stars, system);
  assert.ok(!result.selected.some(star => star.hygId === 'host'));
  assert.equal(result.selected.filter(star => star.isSun).length, 1);
  assert.equal(result.selected.find(star => star.hygId === 'companion').isSignificantCompanion, true);
  assert.ok(result.selected.every(star => [...star.direction, star.distanceFromDestinationPc,
    star.apparentMagnitudeV, star.relativeFlux].every(Number.isFinite)));
});

test('compact binary generation is byte-for-byte deterministic', () => {
  const records = [{ direction: [1, 0, 0], colorRgb: [255, 200, 100], isSun: false,
    isSignificantCompanion: false, apparentMagnitudeV: 2, relativeFlux: 0.1, distanceFromDestinationPc: 12 }];
  assert.deepEqual(writeBinary(records), writeBinary(records));
});

test('committed caches have valid finite records, identities, and provenance', () => {
  const root = path.resolve(__dirname, '..');
  const outputDir = path.join(root, 'public/data/skies');
  const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'manifest.json'), 'utf8'));
  const hashes = new Set();
  for (const sky of manifest.skies) {
    const binary = fs.readFileSync(path.join(outputDir, sky.binary.file));
    const sidecar = JSON.parse(fs.readFileSync(path.join(outputDir, sky.sidecar.file), 'utf8'));
    assert.equal(binary.subarray(0, 4).toString('ascii'), 'ASKY');
    assert.equal(binary.readUInt16LE(4), 1);
    assert.equal(binary.readUInt16LE(6), 28);
    assert.equal(binary.readUInt32LE(8), sky.starCount);
    assert.equal(binary.length, 16 + sky.starCount * 28);
    assert.equal(crypto.createHash('sha256').update(binary).digest('hex'), sky.binary.sha256);
    assert.equal(sidecar.provenance.catalogue, 'HYG v4.1');
    assert.equal(sidecar.records.length, sky.starCount);
    assert.equal(new Set(sidecar.records.map(record => record[1])).size, sky.starCount);
    assert.equal(sidecar.records.filter(record => (record[5] & 1) !== 0).length, 1);
    assert.ok(!sidecar.records.some(record => sky.excludedHostHygIds.includes(record[2])));
    for (const companion of sky.significantCompanions) {
      assert.equal((sidecar.records.find(record => record[2] === companion.hygId)?.[5] & 2) !== 0, true);
    }
    for (let index = 0; index < sky.starCount; index++) {
      const offset = 16 + index * 28;
      const direction = [0, 1, 2].map(axis => binary.readFloatLE(offset + axis * 4));
      const values = [...direction, binary.readFloatLE(offset + 16), binary.readFloatLE(offset + 20), binary.readFloatLE(offset + 24)];
      assert.ok(values.every(Number.isFinite), `${sky.planetName} record ${index} is nonfinite`);
      assert.ok(Math.abs(Math.hypot(...direction) - 1) < 1e-5, `${sky.planetName} record ${index} direction is not normalized`);
    }
    hashes.add(sky.binary.sha256);
  }
  assert.equal(manifest.skies.length, 5);
  assert.equal(hashes.size, 5, 'each destination must have a distinct derived binary');
});
