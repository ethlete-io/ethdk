import { spawnPlain } from '../../../plain-output';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { gitStatusOf } from '../../git-reader';
import { binaryOf } from '../../typecheck';
import { DEFAULT_JSON_STYLE, JsonStyle } from '../prettier-json';
import { Problem } from '../problem';
import { keepReadyThrough, sharedDirOf, Sketch, SKETCH_FILE, variantDirOf } from './sketch';

const FORMATTED = /\.(ts|css|html|json)$/u;

const filesBelowOf = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesBelowOf(join(dir, entry.name))
      : FORMATTED.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );

const unignoredOf = (target: string, files: string[]) => {
  if (files.length === 0) return files;

  const result = gitStatusOf(['check-ignore', '--stdin', '-z'], { cwd: target, input: files.join('\0') });

  if (result.status !== 0) return files;

  const ignored = new Set(result.stdout.split('\0').map((file) => resolve(target, file)));

  return files.filter((file) => !ignored.has(file));
};

const filesOf = (target: string, dir: string) => unignoredOf(target, filesBelowOf(dir));

/**
 * The source files of a variant that the checkout's own Prettier would reformat, leaving out the files git ignores. A
 * checkout without Prettier has no format to hold a variant to, so it reports nothing.
 */
export const formatProblemsOf = (options: { target: string; sketch: Sketch; variant: string }): Problem[] => {
  const { target, sketch, variant } = options;
  const prettier = binaryOf({ target, pkg: 'prettier', bin: 'prettier' });

  if (!prettier) return [];

  const files = filesOf(target, variantDirOf(sketch, variant));

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

/**
 * Writes the variants, the `shared/` folder and `sketch.json` of a sketch in the checkout's Prettier format, when the
 * checkout has Prettier. A ready variant that only this pass changed keeps its ready mark.
 */
export const formatSketch = (options: { target: string; sketch: Sketch; variants: string[] }) => {
  const { target, sketch, variants } = options;
  const prettier = binaryOf({ target, pkg: 'prettier', bin: 'prettier' });

  if (!prettier) return;

  const dirs = [...variants.map((variant) => variantDirOf(sketch, variant)), sharedDirOf(sketch)].filter(existsSync);
  const files = [...dirs.flatMap((dir) => filesOf(target, dir)), resolve(sketch.dir, SKETCH_FILE)];

  keepReadyThrough(sketch, () =>
    spawnPlain([process.execPath, prettier, '--write', '--log-level', 'warn', ...files], { cwd: target }),
  );
};

const RESOLVE_CONFIGS = `import(process.argv[1])
  .then((module) => (module.resolveConfig ? module : module.default))
  .then((prettier) =>
    Promise.all(
      process.argv.slice(2).map((file) => prettier.resolveConfig(file, { editorconfig: true }).then((config) => config ?? {}, () => null)),
    ),
  )
  .then((configs) => process.stdout.write(JSON.stringify(configs)));`;

const PRETTIER = 'prettier';

const jsonStyles = new Map<string, JsonStyle | null>();

/** Resolves the Prettier options of each of `dirs` in one process, so the `jsonStyleOf` calls after it spawn none. */
export const primeJsonStyles = (options: { target: string; dirs: string[] }) => {
  const { target } = options;
  const dirs = [...new Set(options.dirs)].filter((dir) => !jsonStyles.has(dir));

  if (dirs.length === 0) return;

  const prettier = binaryOf({ target, pkg: PRETTIER, bin: PRETTIER });
  const entry = prettier ? require.resolve(PRETTIER, { paths: [target, __dirname] }) : null;
  const result = entry
    ? spawnPlain(
        [process.execPath, '-e', RESOLVE_CONFIGS, pathToFileURL(entry).href, ...dirs.map((dir) => join(dir, 'x.json'))],
        { cwd: target },
      )
    : null;
  const configs = result?.status === 0 ? (JSON.parse(result.stdout) as (Partial<JsonStyle> | null)[]) : [];

  dirs.forEach((dir, index) => {
    const config = configs[index];

    jsonStyles.set(dir, config ? { ...DEFAULT_JSON_STYLE, ...config } : null);
  });
};

/**
 * The Prettier options of the checkout that shape a `.json` file in `dir`, or `null` when the checkout has no
 * Prettier. Spawns one process per folder and run unless `primeJsonStyles` resolved the folder, so a writer of many
 * files formats them in-process.
 */
export const jsonStyleOf = (options: { target: string; dir: string }): JsonStyle | null => {
  primeJsonStyles({ target: options.target, dirs: [options.dir] });

  return jsonStyles.get(options.dir) ?? null;
};
