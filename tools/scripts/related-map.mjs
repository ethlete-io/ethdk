import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '../../..');
const PROJECT_ROOTS = ['libs/cli', 'libs/cli-core', 'libs/design'];
const mapPathOf = (projectRoot) => `${projectRoot}/related-map.json`;
const READS = /\b(readFileSync|spawnSync|execFileSync)\b|node:vm|from ['"]vm['"]|\bvm\./;
const LOCATES = /__dirname|import\.meta/;
const SOURCE_LITERAL =
  /['"`][^'"`\n]*\.(?:ts|tsx|mjs|js)['"`]|['"`](?:[^'"`\n]*\/)?(?:migrations|generators)\.json['"`]/g;
const NOT_SOURCE = /__fixtures__|\.spec\.|\.d\.ts|\$\{/;

export const readsSourcePath = (text) =>
  READS.test(text) &&
  text
    .split('\n')
    .some(
      (line) => LOCATES.test(line) && (line.match(SOURCE_LITERAL) ?? []).some((literal) => !NOT_SOURCE.test(literal)),
    );

export const unmappedSpecs = (specs, map) =>
  specs.filter((spec) => readsSourcePath(spec.text) && !(spec.path in map) && !map.sourceWide?.includes(spec.path));

const SOURCE_WIDE = 'sourceWide';

export const specsForFiles = (files, map) => [
  ...Object.entries(map)
    .filter(([spec]) => spec !== SOURCE_WIDE)
    .filter(([, globs]) => files.some((file) => globs.some((glob) => file === glob || matchesGlob(file, glob))))
    .map(([spec]) => spec),
  ...(files.some((file) => PROJECT_ROOTS.some((projectRoot) => file.startsWith(`${projectRoot}/src/`)))
    ? (map[SOURCE_WIDE] ?? [])
    : []),
];

export const matchesGlob = (file, glob) => {
  const pattern = new RegExp(
    '^' +
      glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\//g, '@DEEP@')
        .replace(/\*\*/g, '@ANY@')
        .replace(/\*/g, '[^/]*')
        .replace(/@DEEP@/g, '(?:.*/)?')
        .replace(/@ANY@/g, '.*') +
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

const loadMap = (projectRoot) =>
  existsSync(join(root, mapPathOf(projectRoot)))
    ? JSON.parse(readFileSync(join(root, mapPathOf(projectRoot)), 'utf8'))
    : {};

const [command, ...args] = process.argv.slice(2);

if (command === 'check') {
  const problems = PROJECT_ROOTS.flatMap((projectRoot) => {
    const mapPath = mapPathOf(projectRoot);
    const map = loadMap(projectRoot);
    const specs = walk(join(root, projectRoot, 'src'))
      .filter((file) => file.endsWith('.spec.ts'))
      .map((file) => ({
        path: relative(join(root, projectRoot), file),
        text: readFileSync(file, 'utf8'),
      }));
    const missing = unmappedSpecs(specs, map);
    const stale = [...Object.keys(map).filter((key) => key !== SOURCE_WIDE), ...(map.sourceWide ?? [])].filter(
      (spec) => !existsSync(join(root, projectRoot, spec)),
    );

    return [
      ...missing.map((spec) => `${projectRoot}/${spec.path} reads a source path but has no entry in ${mapPath}`),
      ...stale.map((spec) => `${mapPath} maps ${spec}, which does not exist`),
    ];
  });
  for (const problem of problems) console.error(problem);
  process.exit(problems.length ? 1 : 0);
}

if (command === 'specs') {
  for (const projectRoot of PROJECT_ROOTS)
    for (const spec of specsForFiles(args, loadMap(projectRoot))) console.log(join(projectRoot, spec));
}
