import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '../../..');
const mapPath = 'libs/cli/related-map.json';
const cliRoot = 'libs/cli';
const READS = /\b(readFileSync|spawnSync|execFileSync)\b|node:vm|from ['"]vm['"]|\bvm\./;
const LOCATES = /__dirname|import\.meta/;
const SOURCE_LITERAL = /['"`][^'"`\n]*\.(?:ts|tsx|mjs|js)['"`]/g;
const NOT_SOURCE = /__fixtures__|\.spec\.|\.d\.ts|\$\{/;

export const readsSourcePath = (text) =>
  READS.test(text) &&
  text
    .split('\n')
    .some(
      (line) => LOCATES.test(line) && (line.match(SOURCE_LITERAL) ?? []).some((literal) => !NOT_SOURCE.test(literal)),
    );

export const unmappedSpecs = (specs, map) => specs.filter((spec) => readsSourcePath(spec.text) && !(spec.path in map));

export const specsForFiles = (files, map) =>
  Object.entries(map)
    .filter(([, globs]) => files.some((file) => globs.some((glob) => file === glob || matchesGlob(file, glob))))
    .map(([spec]) => spec);

const matchesGlob = (file, glob) => {
  const pattern = new RegExp(
    '^' +
      glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\//g, '(?:.*/)?')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*') +
      '$',
  );
  return pattern.test(file);
};

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules') return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const loadMap = () => (existsSync(join(root, mapPath)) ? JSON.parse(readFileSync(join(root, mapPath), 'utf8')) : {});

const [command, ...args] = process.argv.slice(2);

if (command === 'check') {
  const map = loadMap();
  const specs = walk(join(root, cliRoot, 'src'))
    .filter((file) => file.endsWith('.spec.ts'))
    .map((file) => ({
      path: relative(join(root, cliRoot), file),
      text: readFileSync(file, 'utf8'),
    }));
  const missing = unmappedSpecs(specs, map);
  const stale = Object.keys(map).filter((spec) => !existsSync(join(root, cliRoot, spec)));
  for (const spec of missing) console.error(`${spec.path} reads a source path but has no entry in ${mapPath}`);
  for (const spec of stale) console.error(`${mapPath} maps ${spec}, which does not exist`);
  process.exit(missing.length || stale.length ? 1 : 0);
}

if (command === 'specs') {
  for (const spec of specsForFiles(args, loadMap())) console.log(join(cliRoot, spec));
}
