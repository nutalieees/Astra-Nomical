const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'data/source/sky/hyg-source.json');

async function main() {
  const source = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const destination = path.join(ROOT, 'data/source/sky', source.file);
  const response = await fetch(source.downloadUrl);
  if (!response.ok) throw new Error(`HYG download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== source.sha256) throw new Error(`HYG checksum mismatch: expected ${source.sha256}, received ${actual}`);
  fs.writeFileSync(destination, bytes);
  console.log(`Downloaded verified ${source.catalogue} to ${path.relative(ROOT, destination)} (${bytes.length} bytes).`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
