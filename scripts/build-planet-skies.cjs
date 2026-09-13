const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  equatorialToCartesianPc,
  apparentToAbsoluteMagnitude,
  deriveDestinationStar,
} = require('./lib/sky-math.cjs');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_HYG = path.join(ROOT, 'data/source/sky/hygdata_v41.csv');
const HOSTS_PATH = path.join(ROOT, 'data/source/sky/featured-hosts-nasa.json');
const SOURCE_PATH = path.join(ROOT, 'data/source/sky/hyg-source.json');
const OUTPUT_DIR = path.join(ROOT, 'public/data/skies');
const LIMITING_MAGNITUDE = 10;
const MAX_RENDER_STARS = 20000;
const BINARY_VERSION = 1;
const BINARY_HEADER_BYTES = 16;
const BINARY_RECORD_BYTES = 28;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { fields.push(field); field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('Unterminated quoted CSV field');
  fields.push(field);
  return fields;
}

function readHyg(csvText) {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift());
  const required = ['id', 'hip', 'proper', 'ra', 'dec', 'dist', 'mag', 'absmag', 'ci', 'x', 'y', 'z'];
  for (const field of required) if (!headers.includes(field)) throw new Error(`HYG column missing: ${field}`);
  const column = Object.fromEntries(headers.map((name, index) => [name, index]));
  const stars = [];
  const skipped = { missingOrDubiousDistanceOrPhotometry: 0 };
  for (const [lineIndex, line] of lines.entries()) {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) throw new Error(`HYG row ${lineIndex + 2} has ${values.length} fields, expected ${headers.length}`);
    const id = values[column.id];
    const proper = values[column.proper] || null;
    const isSun = id === '0' && proper === 'Sol';
    const distancePc = Number(values[column.dist]);
    const apparentMagnitude = Number(values[column.mag]);
    const suppliedAbsolute = Number(values[column.absmag]);
    const positionPc = isSun ? [0, 0, 0] : ['x', 'y', 'z'].map(name => Number(values[column[name]]));
    if (!id || !Number.isFinite(apparentMagnitude) || !Number.isFinite(suppliedAbsolute) ||
        (!isSun && (!Number.isFinite(distancePc) || distancePc <= 0 || distancePc >= 100000 || !positionPc.every(Number.isFinite)))) {
      skipped.missingOrDubiousDistanceOrPhotometry++;
      continue;
    }
    const absoluteMagnitudeV = isSun ? suppliedAbsolute : apparentToAbsoluteMagnitude(apparentMagnitude, distancePc);
    stars.push({
      sourceId: `hyg:${id}`,
      hygId: id,
      hipId: values[column.hip] || null,
      name: proper || values[column.bf] || (values[column.hd] ? `HD ${values[column.hd]}` : null),
      positionPc,
      earthDistancePc: isSun ? 0 : distancePc,
      earthApparentMagnitudeV: apparentMagnitude,
      absoluteMagnitudeV,
      suppliedAbsoluteMagnitudeV: suppliedAbsolute,
      bMinusV: values[column.ci] === '' ? null : Number(values[column.ci]),
      isSun,
    });
  }
  if (stars.filter(star => star.isSun).length !== 1) throw new Error('Expected exactly one Sun record in HYG');
  if (new Set(stars.map(star => star.sourceId)).size !== stars.length) throw new Error('Duplicate HYG source IDs');
  return { stars, skipped };
}

function temperatureToRgb(temperatureK) {
  const temperature = Math.max(1667, Math.min(25000, temperatureK)) / 100;
  let red;
  let green;
  let blue;
  if (temperature <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temperature) - 161.1195681661;
    blue = temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * (temperature - 60) ** -0.1332047592;
    green = 288.1221695283 * (temperature - 60) ** -0.0755148492;
    blue = 255;
  }
  return [red, green, blue].map(value => Math.round(Math.max(0, Math.min(255, value))));
}

function bvToRgb(bMinusV) {
  if (!Number.isFinite(bMinusV)) return [255, 244, 234];
  const bounded = Math.max(-0.4, Math.min(2, bMinusV));
  const temperatureK = 4600 * (1 / (0.92 * bounded + 1.7) + 1 / (0.92 * bounded + 0.62));
  return temperatureToRgb(temperatureK);
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function writeBinary(stars) {
  const output = Buffer.alloc(BINARY_HEADER_BYTES + stars.length * BINARY_RECORD_BYTES);
  output.write('ASKY', 0, 'ascii');
  output.writeUInt16LE(BINARY_VERSION, 4);
  output.writeUInt16LE(BINARY_RECORD_BYTES, 6);
  output.writeUInt32LE(stars.length, 8);
  output.writeUInt32LE(0, 12);
  stars.forEach((star, index) => {
    const offset = BINARY_HEADER_BYTES + index * BINARY_RECORD_BYTES;
    star.direction.forEach((value, axis) => output.writeFloatLE(value, offset + axis * 4));
    star.colorRgb.forEach((value, channel) => output.writeUInt8(value, offset + 12 + channel));
    output.writeUInt8((star.isSun ? 1 : 0) | (star.isSignificantCompanion ? 2 : 0), offset + 15);
    output.writeFloatLE(star.apparentMagnitudeV, offset + 16);
    output.writeFloatLE(star.relativeFlux, offset + 20);
    output.writeFloatLE(star.distanceFromDestinationPc, offset + 24);
  });
  return output;
}

function buildSky(stars, system) {
  const observerPositionPc = equatorialToCartesianPc(system.rightAscensionDeg, system.declinationDeg, system.distancePc);
  const hostIds = new Set(system.hostHygIds);
  const companionIds = new Set(system.significantCompanions.map(companion => companion.hygId));
  for (const id of [...hostIds, ...companionIds]) {
    if (!stars.some(star => star.hygId === id)) throw new Error(`${system.planetName}: curated HYG ID ${id} is missing`);
  }
  const selected = [];
  let excludedHostCount = 0;
  for (const star of stars) {
    if (hostIds.has(star.hygId)) { excludedHostCount++; continue; }
    const derived = deriveDestinationStar(star, observerPositionPc);
    const isSignificantCompanion = companionIds.has(star.hygId);
    if (derived.apparentMagnitude > LIMITING_MAGNITUDE && !isSignificantCompanion && !star.isSun) continue;
    selected.push({
      ...star,
      direction: derived.direction,
      distanceFromDestinationPc: derived.distancePc,
      apparentMagnitudeV: derived.apparentMagnitude,
      relativeFlux: derived.relativeFlux,
      colorRgb: bvToRgb(star.bMinusV),
      isSignificantCompanion,
    });
  }
  selected.sort((left, right) => left.apparentMagnitudeV - right.apparentMagnitudeV || left.sourceId.localeCompare(right.sourceId));
  const candidateCountBeforeCap = selected.length;
  if (selected.length > MAX_RENDER_STARS) {
    const essential = selected.filter(star => star.isSun || star.isSignificantCompanion);
    const retained = selected.filter(star => !star.isSun && !star.isSignificantCompanion)
      .slice(0, MAX_RENDER_STARS - essential.length)
      .concat(essential)
      .sort((left, right) => left.apparentMagnitudeV - right.apparentMagnitudeV || left.sourceId.localeCompare(right.sourceId));
    selected.splice(0, selected.length, ...retained);
  }
  if (selected.filter(star => star.isSun).length !== 1) throw new Error(`${system.planetName}: output must contain the Sun exactly once`);
  if (selected.some(star => ![...star.direction, star.distanceFromDestinationPc, star.apparentMagnitudeV, star.relativeFlux].every(Number.isFinite))) {
    throw new Error(`${system.planetName}: nonfinite output`);
  }
  if (system.hostHygIds.length && excludedHostCount !== system.hostHygIds.length) throw new Error(`${system.planetName}: host exclusion count mismatch`);
  const binary = writeBinary(selected);
  const sidecar = {
    schemaVersion: 1,
    planetName: system.planetName,
    provenance: { catalogue: 'HYG v4.1', sourceManifest: 'data/source/sky/hyg-source.json' },
    binaryLayout: {
      byteOrder: 'little-endian', headerBytes: BINARY_HEADER_BYTES, recordBytes: BINARY_RECORD_BYTES,
      record: ['directionX:f32', 'directionY:f32', 'directionZ:f32', 'red:u8', 'green:u8', 'blue:u8',
        'flags:u8 (bit0 Sun, bit1 significant companion)', 'apparentMagnitudeV:f32', 'relativeFluxToV0:f32', 'distancePc:f32'],
    },
    recordLayout: ['binaryIndex', 'sourceId', 'hygId', 'hipId', 'name', 'flags (bit0 Sun, bit1 significant companion)'],
    records: selected.map((star, index) => [index, star.sourceId, star.hygId, star.hipId, star.name,
      (star.isSun ? 1 : 0) | (star.isSignificantCompanion ? 2 : 0)]),
  };
  return { observerPositionPc, selected, binary, sidecar, excludedHostCount, candidateCountBeforeCap };
}

function createOutputs(hygText, hosts, source) {
  if (sha256(hygText) !== source.sha256) throw new Error('HYG SHA-256 does not match the pinned source manifest');
  const { stars, skipped } = readHyg(hygText);
  const files = new Map();
  const skies = [];
  for (const system of hosts.systems) {
    const result = buildSky(stars, system);
    const slug = slugify(system.planetName);
    const binaryName = `${slug}.bin`;
    const sidecarName = `${slug}.json`;
    const sidecarBytes = Buffer.from(JSON.stringify(result.sidecar) + '\n');
    files.set(binaryName, result.binary);
    files.set(sidecarName, sidecarBytes);
    skies.push({
      planetName: system.planetName,
      hostName: system.hostName,
      observerPositionPc: result.observerPositionPc,
      candidateCountBeforeCap: result.candidateCountBeforeCap,
      starCount: result.selected.length,
      limitingMagnitudeV: LIMITING_MAGNITUDE,
      maximumRenderStars: MAX_RENDER_STARS,
      excludedHostHygIds: system.hostHygIds,
      excludedHostCount: result.excludedHostCount,
      significantCompanions: system.significantCompanions,
      companionNote: system.companionNote || null,
      sunCount: result.selected.filter(star => star.isSun).length,
      binary: { file: binaryName, bytes: result.binary.length, sha256: sha256(result.binary) },
      sidecar: { file: sidecarName, bytes: sidecarBytes.length, sha256: sha256(sidecarBytes) },
    });
  }
  const manifest = {
    schemaVersion: 1,
    generatedBy: 'scripts/build-planet-skies.cjs',
    coordinateFrame: 'equatorial J2000 Cartesian axes; NASA ICRS J2000 coordinates treated as aligned to HYG J2000',
    photometricBand: 'V',
    magnitudeReference: 'relativeFluxToV0 = 10^(-0.4 * apparentMagnitudeV)',
    catalogue: { ...source, includedValidRecords: stars.length, skippedRecords: skipped },
    hostSystems: { ...hosts.source, recordCount: hosts.systems.length },
    selection: 'Apparent V magnitude is recalculated at each destination, filtered at V <= 10, then the brightest 20,000 are retained. The Sun and significant curated companions are always retained.',
    orientation: 'Full celestial sphere in catalogue axes; no surface up, latitude, local time, or orientation is applied.',
    assumptions: [
      'The planet is approximated at the host-system position; planetary orbital offsets are neglected.',
      'Interstellar extinction is neglected in both the Earth-derived absolute magnitude and destination apparent magnitude.',
      'Light-travel-time effects and stellar space motion after the J2000 catalogue epoch are neglected.',
      'HYG is selected from the Earth viewpoint and is incomplete for stars that would be bright only near a destination.',
      'B-V color is converted to an approximate blackbody display RGB; missing B-V receives a warm-white display fallback.',
      'The host star is excluded by curated HYG identity when present and must be rendered separately by the planet scene.',
    ],
    skies,
  };
  files.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  return { files, manifest };
}

function main(args) {
  let hygPath = DEFAULT_HYG;
  let check = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--check') check = true;
    else if (args[index] === '--hyg' && args[index + 1]) hygPath = path.resolve(args[++index]);
    else throw new Error(`Unknown or incomplete argument: ${args[index]}`);
  }
  if (!fs.existsSync(hygPath)) throw new Error(`HYG input not found at ${hygPath}; see docs/planet-sky-cache.md`);
  const hygText = fs.readFileSync(hygPath, 'utf8');
  const hosts = JSON.parse(fs.readFileSync(HOSTS_PATH, 'utf8'));
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const { files, manifest } = createOutputs(hygText, hosts, source);
  if (!check) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [name, bytes] of files) {
    const outputPath = path.join(OUTPUT_DIR, name);
    if (check) {
      if (!fs.existsSync(outputPath) || !fs.readFileSync(outputPath).equals(bytes)) throw new Error(`${name} is missing or stale`);
    } else fs.writeFileSync(outputPath, bytes);
  }
  console.log(`${check ? 'Verified' : 'Generated'} ${manifest.skies.length} skies from ${manifest.catalogue.includedValidRecords} valid HYG records.`);
  for (const sky of manifest.skies) console.log(`${sky.planetName}: ${sky.starCount} stars, ${sky.binary.bytes} bytes`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { parseCsvLine, readHyg, bvToRgb, writeBinary, buildSky, createOutputs };
