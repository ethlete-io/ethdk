/**
 * Writes the `@ethlete/agent-rules` version into each Claude Code mod it ships.
 *
 * Claude Code caches an installed mod by its `plugin.json` version, so a mod whose version stays
 * the same across a package release keeps running the old code.
 *
 * Usage:
 *   node tools/scripts/sync-mod-version.js           # write the files
 *   node tools/scripts/sync-mod-version.js --check   # exit 1 on drift, write nothing
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const libRoot = path.join(root, 'libs', 'agent-rules');
const pluginsRoot = path.join(libRoot, 'content', 'mods', 'plugins');

const check = process.argv.slice(2).includes('--check');
const { version } = JSON.parse(fs.readFileSync(path.join(libRoot, 'package.json'), 'utf-8'));
const pattern = /^(\s*"version":\s*")([^"]*)(")/m;

const stale = [];

for (const mod of fs.readdirSync(pluginsRoot).sort()) {
  const file = path.join(pluginsRoot, mod, '.claude-plugin', 'plugin.json');
  const name = path.relative(root, file);
  const raw = fs.readFileSync(file, 'utf-8');
  const match = pattern.exec(raw);

  if (!match) {
    console.error(`${name} - found no version to write.`);
    process.exit(1);
  }

  if (match[2] === version) continue;

  if (check) {
    stale.push(`${name} - says ${match[2]}, expected ${version}`);
    continue;
  }

  fs.writeFileSync(file, raw.replace(pattern, `$1${version}$3`));
  console.log(`${name}: ${match[2]} -> ${version}`);
}

if (stale.length) {
  console.error(`A mod version is stale:\n${stale.map((line) => `  ${line}`).join('\n')}`);
  console.error('\nRun `yarn versions:sync` and commit the result.');
  process.exit(1);
}
