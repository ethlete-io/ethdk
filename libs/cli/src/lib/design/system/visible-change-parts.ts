import { readFileSync } from 'fs';
import { dirname, isAbsolute, relative, resolve } from 'path';
import { DesignConfig } from '../paths';
import { PrepushChange, touchedPartsOf } from './touched-parts';
import { harnessEntriesOf, harnessOf } from './harness-map';
import { resolveProduct } from './resolve-product';
import { importsOf } from './ts-source';

const SOURCE_EXTENSIONS = ['.ts', '/index.ts'];

const isInside = (dir: string, file: string) => {
  const path = relative(dir, file);

  return path !== '' && !path.startsWith('..') && !isAbsolute(path);
};

/** The source files a component file reaches through relative imports. */
const closureOf = (options: { file: string; read: (file: string) => string | null }) => {
  const seen = new Set<string>();
  const queue = [options.file];

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (seen.has(file)) continue;

    const source = options.read(file);

    if (source === null) continue;

    seen.add(file);

    for (const specifier of importsOf(source)) {
      if (!specifier.startsWith('.')) continue;

      const base = resolve(dirname(file), specifier);
      const found = [base, ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`)].find(
        (candidate) => candidate.endsWith('.ts') && options.read(candidate) !== null,
      );

      if (found) queue.push(found);
    }
  }

  return seen;
};

/**
 * The harness parts whose app component, or a source file it imports relatively, changed; a changed template or
 * stylesheet counts for each part that reaches a source file in its folder. `'all'` when a changed file is one
 * every part draws with (`everyPart`).
 */
export const appPartsOf = (options: {
  entries: { part: string; file: string }[];
  changed: string[];
  everyPart: (file: string) => boolean;
  read: (file: string) => string | null;
}): Set<string> | 'all' => {
  if (options.changed.some(options.everyPart)) return 'all';

  const parts = new Set<string>();

  for (const { part, file } of options.entries) {
    const reached = closureOf({ file, read: options.read });
    const dirs = new Set([...reached].map((source) => dirname(source)));

    if (
      options.changed.some(
        (changed) => reached.has(changed) || (!changed.endsWith('.ts') && dirs.has(dirname(changed))),
      )
    )
      parts.add(part);
  }

  return parts;
};

/**
 * The harness parts of a product a push touches, for the pre-push visible-change gate: parts whose design files
 * changed, parts whose app component reaches a changed app file, or `'all'` when a change reaches every part (a
 * changed `everyPartInputs` path, or a harness that cannot be read).
 */
export const visibleChangePartsOf = (options: {
  target: string;
  config: DesignConfig;
  name: string;
  changes: PrepushChange[];
  everyPartInputs: string[];
}): Set<string> | 'all' => {
  const { target, config, name, changes } = options;
  const entry = config.products?.[name];

  if (!entry) return 'all';

  const product = resolveProduct({ target, name, config: entry });
  const harness = harnessOf(product);

  if (harness === null) return new Set();
  if (typeof harness === 'string') return 'all';

  const entries = harnessEntriesOf({ target, product, map: harness.map });

  if (typeof entries === 'string') return 'all';

  const map = resolve(target, harness.map);
  const app = appPartsOf({
    entries: entries.map(({ part, specifier }) => ({ part, file: resolve(dirname(map), `${specifier}.ts`) })),
    changed: changes.map(({ file }) => resolve(target, file)),
    everyPart: (file) =>
      options.everyPartInputs.some(
        (input) => file === resolve(target, input) || isInside(resolve(target, input), file),
      ),
    read: (file) => {
      try {
        return readFileSync(file, 'utf8');
      } catch {
        return null;
      }
    },
  });

  if (app === 'all') return 'all';

  const harnessed = new Set(entries.map(({ part }) => part));
  const design = touchedPartsOf({ target, config, changes }).get(name) ?? new Set<string>();

  return new Set([...app, ...[...design].filter((part) => harnessed.has(part))]);
};
