import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const RELATIVE_REQUIRE = /require\("(\.{1,2}\/[^"]+)"\)/g;

const resolves = (base: string) =>
  [base, `${base}.js`, `${base}.json`, join(base, 'index.js')].some((candidate) => existsSync(candidate));

const jsFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : jsFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });

/** Lists every relative `require("./…")` in a built CLI that does not resolve, plus a missing entry point. */
const unresolvedRequires = (root: string, entryFile: string) => {
  const entry = join(root, entryFile);
  if (!existsSync(entry)) return [`${relative(root, entry)} is missing`];

  return jsFiles(root).flatMap((file) =>
    Array.from(readFileSync(file, 'utf8').matchAll(RELATIVE_REQUIRE), ([, specifier = '']) => specifier)
      .filter((specifier) => !resolves(resolve(dirname(file), specifier)))
      .map((specifier) => `${relative(root, file)} requires ${specifier}`),
  );
};

/** Throws when the built CLI under `root` is partial, naming what is missing. */
export const assertCompleteBuild = (root: string, label: string, entryFile = 'src/index.js') => {
  const missing = unresolvedRequires(root, entryFile);
  if (!missing.length) return;

  const shown = missing.slice(0, 20).map((line) => `  ${line}`);
  const more = missing.length > shown.length ? [`  … and ${missing.length - shown.length} more`] : [];
  throw new Error([`${label} is a partial CLI build (${missing.length} unresolved):`, ...shown, ...more].join('\n'));
};

const entriesOf = (dir: string) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []);
const isDirectory = (path: string) => existsSync(path) && statSync(path).isDirectory();

/** Renames every staged file over its built twin, so a reader never finds the build missing. */
export const moveIntoPlace = (staging: string, target: string) => {
  mkdirSync(target, { recursive: true });

  const staged = entriesOf(staging);
  const stagedNames = new Set(staged.map((entry) => entry.name));

  for (const entry of staged) {
    const from = join(staging, entry.name);
    const to = join(target, entry.name);

    if (entry.isDirectory()) {
      if (existsSync(to) && !isDirectory(to)) rmSync(to);
      moveIntoPlace(from, to);
    } else {
      if (isDirectory(to)) rmSync(to, { recursive: true });
      renameSync(from, to);
    }
  }

  for (const entry of entriesOf(target)) {
    if (!stagedNames.has(entry.name)) rmSync(join(target, entry.name), { recursive: true, force: true });
  }

  rmSync(staging, { recursive: true, force: true });
};

/**
 * Moves a copy of the compile output into `target` and leaves the compile output in place, so builds
 * running at the same time never move files out from under each other or out of the Nx cache.
 * Throws, leaving `target` untouched, when the compile output is a partial CLI build.
 */
export const buildIntoPlace = (compiled: string, target: string) => {
  const run = mkdtempSync(`${compiled}-run-`);

  try {
    cpSync(compiled, run, { recursive: true });
    assertCompleteBuild(run, compiled);
    moveIntoPlace(run, target);
  } finally {
    rmSync(run, { recursive: true, force: true });
  }

  assertCompleteBuild(target, target);
};

if (import.meta.main) {
  const [staging, target] = process.argv.slice(2);

  if (!staging || !target) throw new Error('usage: move-into-place.mts <staging> <target>');

  try {
    buildIntoPlace(resolve(staging), resolve(target));
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
