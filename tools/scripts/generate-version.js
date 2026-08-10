const fs = require('fs');
const path = require('path');

const lib = process.argv[2];

if (!lib) {
  console.error('Usage: node tools/scripts/generate-version.js <lib>');
  process.exit(1);
}

const root = path.join(__dirname, '..', '..');
const libRoot = path.join(root, 'libs', lib);
const { version } = JSON.parse(fs.readFileSync(path.join(libRoot, 'package.json'), 'utf-8'));

const constant = `${lib.replace(/-/g, '_').toUpperCase()}_VERSION`;
const target = path.join(libRoot, 'src', 'lib', 'version.ts');

const contents = `// Generated from package.json by tools/scripts/generate-version.js - do not edit.

/** The version of \`@ethlete/${lib}\` this build was cut from. */
export const ${constant} = '${version}';
`;

if (fs.existsSync(target) && fs.readFileSync(target, 'utf-8') === contents) process.exit(0);

fs.writeFileSync(target, contents);
console.log(`${lib}: ${constant} = ${version}`);
