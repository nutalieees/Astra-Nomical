const fs = require('node:fs');
const path = require('node:path');
const { readHyg } = require('./build-planet-skies.cjs');

const ROOT = path.resolve(__dirname, '..');
const ARDUINO_PATH = path.join(ROOT, 'src/lib/astronomy/data/arduino-sky.json');
const HYG_PATH = path.join(ROOT, 'data/source/sky/hygdata_v41.csv');
const HYG_SOURCE_PATH = path.join(ROOT, 'data/source/sky/hyg-source.json');
const OUTPUT_PATH = path.join(ROOT, 'data/derived/arduino-star-enrichment.json');

function buildEnrichment(arduino, hygStars, source) {
  const byHip = new Map();
  for (const star of hygStars) {
    if (!star.hipId) continue;
    const matches = byHip.get(star.hipId) || [];
    matches.push(star);
    byHip.set(star.hipId, matches);
  }

  const records = arduino.stars.map(star => {
    const matches = star.hipId === null ? [] : (byHip.get(String(star.hipId)) || []);
    const status = star.hipId === null ? 'missing-hip' : matches.length === 1 ? 'matched' : matches.length > 1 ? 'ambiguous' : 'unresolved';
    const match = status === 'matched' ? matches[0] : null;
    return {
      arduinoId: star.id,
      hipId: star.hipId,
      label: star.name,
      matchStatus: status,
      matchCount: matches.length,
      originalEarthView: {
        rightAscensionDeg: star.rightAscensionDeg,
        declinationDeg: star.declinationDeg,
        apparentVisualMagnitude: star.apparentVisualMagnitude,
        displayColorHex: star.colorHex,
        displayColorProvenance: 'Expanded from the RGB565 value in the supplied Arduino header; calibration unspecified.',
      },
      hyg: match ? {
        sourceId: match.sourceId,
        hygId: match.hygId,
        name: match.name,
        positionPc: match.positionPc,
        earthDistancePc: match.earthDistancePc,
        earthApparentMagnitudeV: match.earthApparentMagnitudeV,
        absoluteMagnitudeV: match.absoluteMagnitudeV,
        bMinusV: Number.isFinite(match.bMinusV) ? match.bMinusV : null,
        distanceUncertaintyPc: null,
        qualityFlags: [],
      } : null,
    };
  });

  const count = status => records.filter(record => record.matchStatus === status).length;
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/enrich-arduino-stars.cjs',
    join: 'Exact Hipparcos identifier equality; labels and sky coordinates are never used to guess a match.',
    catalogue: {
      name: source.catalogue,
      pinnedCommit: source.pinnedCommit,
      downloadUrl: source.downloadUrl,
      retrievedAt: source.retrievedAt,
      sha256: source.sha256,
      coordinateFrame: 'equatorial Cartesian, J2000 equinox',
      referenceEpoch: 2000,
      positionUnit: 'parsec',
      photometricBand: 'V',
    },
    limitations: [
      'The supplied Arduino coordinates have no stated frame or epoch and are preserved only as Earth-view reference values.',
      'HYG v4.1 supplies no per-record distance uncertainty or uniform astrometric quality flag; null and an empty list mean unavailable, not zero or good.',
      'The HYG position is used only for an exact HIP match. Missing and ambiguous records remain unresolved.',
      'The original RGB565 color and HYG B-V color index are retained as separate provenance fields.',
    ],
    audit: {
      inputRecords: records.length,
      matched: count('matched'),
      missingHip: count('missing-hip'),
      unresolved: count('unresolved'),
      ambiguous: count('ambiguous'),
      labelledInputRecords: records.filter(record => record.label).length,
      labelsLost: records.filter(record => record.label && !record.label.trim()).length,
    },
    records,
  };
}

function main(args) {
  const check = args.length === 1 && args[0] === '--check';
  if (args.length && !check) throw new Error(`Unknown argument: ${args.join(' ')}`);
  if (!fs.existsSync(HYG_PATH)) throw new Error(`HYG input missing at ${HYG_PATH}; run npm run skies:download`);
  const arduino = JSON.parse(fs.readFileSync(ARDUINO_PATH, 'utf8'));
  const source = JSON.parse(fs.readFileSync(HYG_SOURCE_PATH, 'utf8'));
  const { stars } = readHyg(fs.readFileSync(HYG_PATH, 'utf8'));
  const output = Buffer.from(JSON.stringify(buildEnrichment(arduino, stars, source), null, 2) + '\n');
  if (check) {
    if (!fs.existsSync(OUTPUT_PATH) || !fs.readFileSync(OUTPUT_PATH).equals(output)) throw new Error('Arduino star enrichment is missing or stale');
  } else {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, output);
  }
  const audit = JSON.parse(output).audit;
  console.log(`${check ? 'Verified' : 'Generated'} ${audit.inputRecords} records: ${audit.matched} matched, ${audit.missingHip} missing HIP, ${audit.unresolved} unresolved, ${audit.ambiguous} ambiguous.`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { buildEnrichment };
