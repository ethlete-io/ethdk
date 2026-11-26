/**
 * Fails when a published lib declares a peer dependency on an exact version. `@nx/dependency-checks`
 * writes the installed version when its fixer adds a missing peer, so an exact pin lands silently and
 * forces every consumer onto the workspace's own patch release.
 *
 * Usage: node tools/scripts/check-peer-ranges.js
 */

const fs = require('fs');
const path = require('path');
const semver = require('semver');

const libsRoot = path.join(__dirname, '..', '..', 'libs');

const failures = [];

for (const entry of fs.readdirSync(libsRoot, { withFileTypes: true })) {
  const manifestPath = path.join(libsRoot, entry.name, 'package.json');
  if (!entry.isDirectory() || !fs.existsSync(manifestPath)) continue;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  if (manifest.private) continue;

  for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
    if (semver.valid(range)) {
      failures.push(`libs/${entry.name}/package.json: "${name}": "${range}"`);
    }
  }
}

if (failures.length) {
  console.error('Peer dependencies must be ranges (e.g. "^22.1.0"), not exact versions:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
