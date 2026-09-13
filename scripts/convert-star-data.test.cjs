const { test } = require('node:test');
const assert = require('node:assert/strict');
const { convert, rgb565ToHex } = require('./convert-star-data.cjs');

const star = (hip = 1, ra = '20.0f', dec = '-10.0f', mag = '2.0f') =>
  `{ ${hip}, ${ra}, ${dec}, ${mag}, 0xFFFF, "Test" },`;
const header = (name, count, rows) => `const uint16_t ${name === 'STARS' ? 'STAR_COUNT' : 'SEGMENT_COUNT'} = ${count};
const Entry ${name}[] PROGMEM = { ${rows} };`;
const parse = (stars, segments, starCount, segmentCount) => convert(
  header('STARS', starCount, stars), header('SEGMENTS', segmentCount, segments),
  { stars: starCount, segments: segmentCount });

test('RGB565 expands black, white, and primaries correctly', () => {
  assert.equal(rgb565ToHex(0), '#000000');
  assert.equal(rgb565ToHex(65535), '#ffffff');
  assert.equal(rgb565ToHex(0xf800), '#ff0000');
  assert.equal(rgb565ToHex(0x07e0), '#00ff00');
  assert.equal(rgb565ToHex(0x001f), '#0000ff');
  assert.throws(() => rgb565ToHex(65536));
});

test('missing and duplicate HIP IDs never resolve to the wrong star', () => {
  const result = parse(star(0) + star(0) + star(7) + star(7) + star(8),
    '{ 7, 8 }, { 0, 99 },', 5, 2);
  assert.equal(new Set(result.stars.map(s => s.id)).size, 5);
  assert.equal(result.validation.starsWithoutHip, 2);
  assert.equal(result.validation.duplicateHipIds.length, 1);
  assert.equal(result.segments[0].starId1, null);
  assert.equal(result.segments[0].starId2, result.stars[4].id);
  assert.equal(result.validation.unresolvedEndpoints.length, 3);
  assert.equal(result.stars[0].distancePc, null);
  assert.equal(result.metadata.coordinateEpoch, null);
});

test('malformed records and declared count mismatches fail rather than disappearing', () => {
  assert.throws(() => parse(star() + 'unexpected', '', 1, 0), /Unparsed/);
  assert.throws(() => parse(star(), '', 2, 0), /parsed 1/);
  assert.throws(() => parse('{ nonsense },', '', 1, 0), /Malformed/);
});

test('invalid coordinates and nonfinite magnitudes fail', () => {
  for (const [ra, dec, mag] of [['360', '0', '1'], ['-1', '0', '1'],
    ['0', '91', '1'], ['0', '-91', '1'], ['0', '0', '1e999'], ['0', '0', 'NaN']]) {
    assert.throws(() => parse(star(1, ra, dec, mag), '', 1, 0));
  }
});

test('valid boundary coordinates and negative magnitudes survive exactly', () => {
  const result = parse(star(1, '0', '-90', '-1.46'), '', 1, 0);
  assert.equal(result.stars[0].apparentVisualMagnitude, -1.46);
  assert.equal(result.stars[0].declinationDeg, -90);
  assert.equal(result.stars[0].colorRgb565, 65535);
});
