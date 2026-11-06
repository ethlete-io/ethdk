import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { assetRoot } from './paths';

/** Modules that record how a run went but never change what it produces: an edit of one keeps every cache. */
const RECORDING_ONLY = new Set(['timings', 'phase-timing', 'run-abort']);

/** Modules whose imports reach most of the cli: counted by their own text, their imports not followed. */
const HUBS = new Set(['serve']);

const TYPE_IMPORTS = /^(?:import|export) type [\s\S]*?;$/gm;
const SPECIFIERS = /(?:\{([^}]*)\}\s*from\s+|require\(\s*|from\s+|import\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
const RESOLVED = ['', '.js', '.ts', '/index.js', '/index.ts'];

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

const moduleOf = (root: string, file: string) => relative(root, file).replace(/\.(js|ts)$/, '');

const resolvedOf = (from: string, specifier: string) =>
  RESOLVED.map((suffix) => `${resolve(dirname(from), specifier)}${suffix}`).find(
    (path) => isFile(path) && !path.endsWith('.d.ts') && /\.(js|ts)$/.test(path),
  );

/** TypeScript drops an import of types only from the built cli, so the source graph drops it too. */
const isTypesOnly = (names: string, file: string) => {
  const text = readFileSync(file, 'utf8');

  return names
    .split(',')
    .map(
      (name) =>
        name
          .replace(/^\s*type\s+/, '')
          .split(/\s+as\s+/)[0]
          ?.trim() ?? '',
    )
    .filter(Boolean)
    .every((name) => new RegExp(`export (?:type|interface) ${name}\\b`).test(text));
};

const importedFilesOf = (file: string) =>
  [...readFileSync(file, 'utf8').replace(TYPE_IMPORTS, '').matchAll(SPECIFIERS)].flatMap((match) => {
    const found = resolvedOf(file, match[2] ?? '');

    return found && !(match[1] !== undefined && isTypesOnly(match[1], found)) ? [found] : [];
  });

const entryFileOf = (root: string, entry: string) => {
  const found = ['.js', '.ts'].map((suffix) => join(root, `${entry}${suffix}`)).find(isFile);

  if (!found) throw new Error(`code-hash: no module ${entry} under ${root}`);

  return found;
};

/**
 * @internal The cli modules that can change what `entries` produce: their import graph under `root`, without the
 * recording-only modules, a hub counted but not followed. Sorted, relative to `root`, no extension.
 */
export const codeModulesOf = (entries: readonly string[], root = __dirname) => {
  const seen = new Map<string, string>();
  const open = entries.map((entry) => ({ file: entryFileOf(root, entry), follow: !HUBS.has(entry) }));

  for (let next = open.pop(); next; next = open.pop()) {
    const name = moduleOf(root, next.file);

    if (seen.has(name) || RECORDING_ONLY.has(name)) continue;
    seen.set(name, next.file);

    if (!next.follow) continue;

    for (const file of importedFilesOf(next.file)) open.push({ file, follow: !HUBS.has(moduleOf(root, file)) });
  }

  return new Map([...seen].sort(([a], [b]) => a.localeCompare(b)));
};

const filesUnder = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[]).filter((file) => statSync(join(dir, file)).isFile()).sort()
    : [];

/**
 * @internal A hash of the cli code that can change what `entries` produce (`codeModulesOf`), plus every file under
 * `assets` when given: the part of a cache key that an unrelated cli edit keeps.
 */
export const codeHashOf = (options: { entries: readonly string[]; assets?: string; root?: string }) => {
  const hash = createHash('sha256');

  for (const [name, file] of codeModulesOf(options.entries, options.root))
    hash.update(`${name}\0`).update(readFileSync(file));

  if (options.assets)
    for (const file of filesUnder(options.assets))
      hash.update(`asset ${file}\0`).update(readFileSync(join(options.assets, file)));

  return hash.digest('hex').slice(0, 16);
};

const DESIGN_PICTURE_MODULES = [
  'serve',
  'shot',
  'shot-store',
  'thumb',
  'render',
  'force-interactions',
  'render-packages',
  'part-marks',
  'generated-stylesheets',
  'sketch-stylesheets',
  'system/system-modules',
];

/** @internal The code a design picture is drawn with: the frame assets, the server's transforms and the shot itself. */
export const designPictureCodeOf = () => codeHashOf({ entries: DESIGN_PICTURE_MODULES, assets: assetRoot() });

/** @internal The code render inspect draws and judges a part with, the frame assets included. */
export const renderInspectCodeOf = () =>
  codeHashOf({
    entries: [...DESIGN_PICTURE_MODULES, 'system/render-check', 'system/served-cache'],
    assets: assetRoot(),
  });

/** @internal The code an app picture is drawn and kept with. */
export const appPictureCodeOf = () => codeHashOf({ entries: ['system/harness-shot', 'system/compare-cache'] });

/** @internal The code a pixel compare of two pictures runs and is kept with. */
export const pixelCompareCodeOf = () => codeHashOf({ entries: ['system/part-compare', 'system/pixel-cache'] });

/** @internal The code the action check of a state runs, the design pictures it compares against included. */
export const actionCheckCodeOf = () =>
  codeHashOf({
    entries: [...DESIGN_PICTURE_MODULES, 'system/actions-command', 'system/action-cache', 'system/harness-shot'],
    assets: assetRoot(),
  });
