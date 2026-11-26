/**
 * Writes `libs/<lib>/src/lib/version.ts` from that lib's `package.json` version.
 *
 * Usage:
 *   node tools/scripts/generate-version.js <lib...>   # write these libs (nx `generate-version` target)
 *   node tools/scripts/generate-version.js --all      # write every lib that has the target
 *   node tools/scripts/generate-version.js --all --check   # exit 1 on drift, write nothing
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const libsRoot = path.join(root, 'libs');

const args = process.argv.slice(2);
const check = args.includes('--check');
const all = args.includes('--all');
const named = args.filter((arg) => !arg.startsWith('--'));

const discoverLibs = () =>
  fs
    .readdirSync(libsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((lib) => {
      const projectFile = path.join(libsRoot, lib, 'project.json');
      if (!fs.existsSync(projectFile)) return false;
      const project = JSON.parse(fs.readFileSync(projectFile, 'utf-8'));
      return Boolean(project.targets?.['generate-version']);
    })
    .sort();

const libs = all || !named.length ? discoverLibs() : named;

if (!libs.length) {
  console.error('Usage: node tools/scripts/generate-version.js <lib...> | --all [--check]');
  process.exit(1);
}

const render = (lib) => {
  const libRoot = path.join(libsRoot, lib);
  const { version } = JSON.parse(fs.readFileSync(path.join(libRoot, 'package.json'), 'utf-8'));
  const constant = `${lib.replace(/-/g, '_').toUpperCase()}_VERSION`;

  return {
    constant,
    version,
    target: path.join(libRoot, 'src', 'lib', 'version.ts'),
    contents: `// Generated from package.json by tools/scripts/generate-version.js - do not edit.

/** The version of \`@ethlete/${lib}\` this build was cut from. */
export const ${constant} = '${version}';
`,
  };
};

const stale = [];

for (const lib of libs) {
  const { constant, version, target, contents } = render(lib);

  if (fs.existsSync(target) && fs.readFileSync(target, 'utf-8') === contents) continue;

  if (check) {
    stale.push(`${path.relative(root, target)} - expected ${constant} = '${version}'`);
    continue;
  }

  fs.writeFileSync(target, contents);
  console.log(`${lib}: ${constant} = ${version}`);
}

if (stale.length) {
  console.error(`Generated version constants are stale:\n${stale.map((line) => `  ${line}`).join('\n')}`);
  console.error('\nRun `yarn versions:sync` and commit the result.');
  process.exit(1);
}
