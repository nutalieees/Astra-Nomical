// Strict parser for the supplied generated headers; never executes C/C++ input.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'src/lib/astronomy/data/arduino-sky.json');

function rgb565ToHex(value) {
  if (!Number.isInteger(value) || value < 0 || value > 65535) throw new Error('Invalid RGB565 value');
  const channels = [Math.round(((value >> 11) & 31) * 255 / 31),
    Math.round(((value >> 5) & 63) * 255 / 63), Math.round((value & 31) * 255 / 31)];
  return '#' + channels.map(c => c.toString(16).padStart(2, '0')).join('');
}

function rows(text, arrayName, countName, expectedCount) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\r\n]*/g, '');
  const count = clean.match(new RegExp(`\\b${countName}\\s*=\\s*(\\d+)\\s*;`));
  const body = clean.match(new RegExp(`\\b${arrayName}\\s*\\[\\s*\\]\\s*PROGMEM\\s*=\\s*\\{([\\s\\S]*?)\\};`));
  if (!count || !body) throw new Error(`Missing ${arrayName} array/count`);
  const records = [...body[1].matchAll(/\{([^{}]*)\}\s*,?/g)];
  if (body[1].replace(/\{([^{}]*)\}\s*,?/g, '').trim()) throw new Error(`Unparsed ${arrayName} content`);
  if (records.length !== Number(count[1]) || records.length !== expectedCount) {
    throw new Error(`${arrayName}: parsed ${records.length}, declared ${count[1]}, expected ${expectedCount}`);
  }
  return records.map(record => record[1].trim());
}

function convert(starsText, segmentsText, expected = { stars: 904, segments: 674 }) {
  const number = '([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?)[fF]?';
  const starPattern = new RegExp(`^(\\d+)\\s*,\\s*${number}\\s*,\\s*${number}\\s*,\\s*${number}\\s*,\\s*(0x[0-9a-fA-F]+)\\s*,\\s*("(?:[^"\\\\]|\\\\["\\\\])*")$`);
  const hipIndex = new Map();
  const stars = rows(starsText, 'STARS', 'STAR_COUNT', expected.stars).map((row, index) => {
    const match = row.match(starPattern);
    if (!match) throw new Error(`Malformed star row ${index + 1}`);
    const [, hipText, raText, decText, magText, colorText, labelText] = match;
    const [hip, rightAscensionDeg, declinationDeg, apparentVisualMagnitude] = [hipText, raText, decText, magText].map(Number);
    if (!Number.isInteger(hip) || hip < 0 || hip > 0xffffffff ||
      ![rightAscensionDeg, declinationDeg, apparentVisualMagnitude].every(Number.isFinite) ||
      rightAscensionDeg < 0 || rightAscensionDeg >= 360 || declinationDeg < -90 || declinationDeg > 90) {
      throw new Error(`Invalid ID, coordinates, or magnitude in star row ${index + 1}`);
    }
    // Source-row IDs stay unique even for missing or duplicated HIP identifiers.
    const id = `arduino-star-${String(index + 1).padStart(4, '0')}`;
    if (hip) hipIndex.set(hip, [...(hipIndex.get(hip) || []), id]);
    const colorRgb565 = Number(colorText);
    return { id, hipId: hip || null, name: JSON.parse(labelText) || null,
      rightAscensionDeg, declinationDeg, apparentVisualMagnitude,
      colorRgb565, colorHex: rgb565ToHex(colorRgb565), distancePc: null, coordinateEpoch: null };
  });
  const resolveHip = hip => hipIndex.get(hip)?.length === 1 ? hipIndex.get(hip)[0] : null;
  const segments = rows(segmentsText, 'SEGMENTS', 'SEGMENT_COUNT', expected.segments).map((row, index) => {
    const match = row.match(/^(\d+)\s*,\s*(\d+)$/);
    if (!match) throw new Error(`Malformed segment row ${index + 1}`);
    const [hip1, hip2] = match.slice(1).map(Number);
    if ([hip1, hip2].some(id => !Number.isInteger(id) || id < 0 || id > 0xffffffff)) throw new Error(`Invalid segment ID at row ${index + 1}`);
    return { id: `arduino-segment-${String(index + 1).padStart(4, '0')}`,
      hip1, hip2, starId1: resolveHip(hip1), starId2: resolveHip(hip2) };
  });
  const duplicateHipIds = [...hipIndex].filter(([, ids]) => ids.length > 1)
    .map(([hipId, starIds]) => ({ hipId, starIds }));
  const unresolvedEndpoints = segments.flatMap(s => [1, 2].flatMap(endpoint => {
    const hipId = s[`hip${endpoint}`];
    return s[`starId${endpoint}`] ? [] : [{ segmentId: s.id, endpoint, hipId,
      reason: hipIndex.has(hipId) ? 'ambiguous-hip' : 'missing-hip' }];
  }));
  const warnings = [];
  const withoutHip = stars.filter(s => s.hipId === null).length;
  if (withoutHip) warnings.push(`${withoutHip} stars have no HIP identifier; unique source-row IDs are used.`);
  if (duplicateHipIds.length) warnings.push(`${duplicateHipIds.length} duplicated HIP identifiers; ambiguous links are unresolved.`);
  if (unresolvedEndpoints.length) warnings.push(`${unresolvedEndpoints.length} constellation endpoints cannot resolve uniquely; affected segments must not be drawn.`);
  const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
  return {
    metadata: {
      schemaVersion: 1, observer: 'Earth', coordinateSystem: 'equatorial-ra-dec',
      coordinateFrame: null, coordinateEpoch: null, distanceUnit: 'pc',
      magnitudeDescription: 'Earth-view apparent visual magnitude as supplied; exact passband not specified.',
      colorDescription: 'RGB565 expanded to 8-bit display RGB; source color calibration is unspecified.',
      sources: [
        { file: 'stars_data.h', sha256: sha256(starsText) },
        { file: 'constellation_data.h', sha256: sha256(segmentsText) },
      ],
      limitations: [
        'Distances and coordinate epoch are not supplied; null means unknown, not zero.',
        'These are Earth-view directions and magnitudes, not a reconstructed exoplanet sky.',
        'Constellation segments preserve Earth-based patterns.',
        'Original catalogue provenance and licence are not specified in the supplied headers.',
      ],
    },
    stars, segments,
    validation: { starCount: stars.length, segmentCount: segments.length,
      starsWithoutHip: withoutHip, duplicateHipIds, unresolvedEndpoints,
      unresolvedSegmentCount: segments.filter(s => !s.starId1 || !s.starId2).length,
      magnitudeRange: [Math.min(...stars.map(s => s.apparentVisualMagnitude)), Math.max(...stars.map(s => s.apparentVisualMagnitude))],
      warnings },
  };
}

function main(args) {
  let sourceDir = path.join(ROOT, 'data/source/arduino');
  let check = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true;
    else if (args[i] === '--source-dir' && args[i + 1]) sourceDir = path.resolve(args[++i]);
    else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  const result = convert(fs.readFileSync(path.join(sourceDir, 'stars_data.h'), 'utf8'),
    fs.readFileSync(path.join(sourceDir, 'constellation_data.h'), 'utf8'));
  const serialized = JSON.stringify(result, null, 2) + '\n';
  if (check) {
    if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== serialized) throw new Error('Generated sky asset is missing or stale; run npm run stars:convert');
  } else {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, serialized);
  }
  console.log(`${check ? 'Verified' : 'Converted'} ${result.stars.length} stars and ${result.segments.length} segments.`);
  console.log(JSON.stringify({ ...result.validation, unresolvedEndpoints: result.validation.unresolvedEndpoints.length }, null, 2));
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { convert, rgb565ToHex };
