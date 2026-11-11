import { spawnPlain } from '../../../plain-output';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { binaryOf } from '../../typecheck';
import { DEFAULT_JSON_STYLE, JsonStyle } from '../prettier-json';
import { Problem } from '../problem';
import { sharedDirOf, Sketch, SKETCH_FILE, variantDirOf } from './sketch';

const FORMATTED = /\.(ts|css|html|json)$/u;

const filesOf = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesOf(join(dir, entry.name)) : FORMATTED.test(entry.name) ? [join(dir, entry.name)] : [],
  );

/**
 * The source files of a variant that the checkout's own Prettier would reformat. A checkout
 * without Prettier has no format to hold a variant to, so it reports nothing.
 */
export const formatProblemsOf = (options: { target: string; sketch: Sketch; variant: string }): Problem[] => {
  const { target, sketch, variant } = options;
  const prettier = binaryOf({ target, pkg: 'prettier', bin: 'prettier' });

  if (!prettier) return [];

  const files = filesOf(variantDirOf(sketch, variant));

  if (files.length === 0) return [];

  const result = spawnPlain([process.execPath, prettier, '--list-different', ...files], { cwd: target });

  if (result.status !== 1) return [];

  return result.stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const file = resolve(target, line.trim());

      return {
        rule: 'FORMAT',
        file,
        message: `is not formatted - run sketch check ${sketch.target} --fix`,
      };
    });
};

/** Writes the variants, the `shared/` folder and `sketch.json` of a sketch in the checkout's Prettier format, when the checkout has Prettier. */
export const formatSketch = (options: { target: string; sketch: Sketch; variants: string[] }) => {
  const { target, sketch, variants } = options;
  const prettier = binaryOf({ target, pkg: 'prettier', bin: 'prettier' });

  if (!prettier) return;

  const dirs = [...variants.map((variant) => variantDirOf(sketch, variant)), sharedDirOf(sketch)].filter(existsSync);
  const files = [...dirs.flatMap(filesOf), resolve(sketch.dir, SKETCH_FILE)];

  spawnPlain([process.execPath, prettier, '--write', '--log-level', 'warn', ...files], { cwd: target });
};

const RESOLVE_CONFIG = `import(process.argv[1])
  .then((module) => (module.resolveConfig ? module : module.default).resolveConfig(process.argv[2], { editorconfig: true }))
  .then((config) => process.stdout.write(JSON.stringify(config ?? {})));`;

const PRETTIER = 'prettier';

const jsonStyles = new Map<string, JsonStyle | null>();

/**
 * The Prettier options of the checkout that shape a `.json` file in `dir`, or `null` when the checkout has no
 * Prettier. Spawns one process per folder and run, so a writer of many files formats them in-process.
 */
export const jsonStyleOf = (options: { target: string; dir: string }): JsonStyle | null => {
  const { target, dir } = options;
  const known = jsonStyles.get(dir);

  if (known !== undefined) return known;

  const prettier = binaryOf({ target, pkg: PRETTIER, bin: PRETTIER });
  const entry = prettier ? require.resolve(PRETTIER, { paths: [target, __dirname] }) : null;
  const result = entry
    ? spawnPlain([process.execPath, '-e', RESOLVE_CONFIG, pathToFileURL(entry).href, join(dir, 'x.json')], {
        cwd: target,
      })
    : null;
  const config = result?.status === 0 ? (JSON.parse(result.stdout) as Partial<JsonStyle>) : null;
  const style = config ? { ...DEFAULT_JSON_STYLE, ...config } : null;

  jsonStyles.set(dir, style);

  return style;
};
