/**
 * Writes the Timetrack app version into the files the Tauri build reads.
 *
 * `apps/timetrack/package.json` is the source. It is a private workspace package, so
 * `changeset version` bumps it like a published lib, and this script carries that version into
 * `tauri.conf.json` (what `getVersion()` and the bundler return), `Cargo.toml` and `Cargo.lock`.
 *
 * Usage:
 *   node tools/scripts/sync-tauri-version.js           # write the files
 *   node tools/scripts/sync-tauri-version.js --check   # exit 1 on drift, write nothing
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const appRoot = path.join(root, 'apps', 'timetrack');
const tauriRoot = path.join(appRoot, 'src-tauri');
const crate = 'timetrack';

const check = process.argv.slice(2).includes('--check');

const { version } = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf-8'));

/** The `version` key of the config object, which is the only one at the top level of the file. */
const config = /^(\s*"version":\s*")([^"]*)(")/m;

/** The `version` of the first `[package]` section, and never a dependency of the same name. */
const manifest = /(\[package\][\s\S]*?\nversion = ")([^"]*)(")/;

const lock = new RegExp(`(name = "${crate}"\\nversion = ")([^"]*)(")`);

const targets = [
  { file: path.join(tauriRoot, 'tauri.conf.json'), pattern: config },
  { file: path.join(tauriRoot, 'Cargo.toml'), pattern: manifest },
  { file: path.join(tauriRoot, 'Cargo.lock'), pattern: lock },
];

const stale = [];

for (const { file, pattern } of targets) {
  const name = path.relative(root, file);
  const raw = fs.readFileSync(file, 'utf-8');
  const match = pattern.exec(raw);

  if (!match) {
    console.error(`${name} - found no version to write. The layout of the file changed.`);
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
  console.error(`The Timetrack app version is stale:\n${stale.map((line) => `  ${line}`).join('\n')}`);
  console.error('\nRun `yarn versions:sync` and commit the result.');
  process.exit(1);
}
