import { spawnSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { binaryOf } from '../../typecheck';
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

  const result = spawnSync(process.execPath, [prettier, '--list-different', ...files], {
    cwd: target,
    encoding: 'utf8',
  });

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

  spawnSync(process.execPath, [prettier, '--write', '--log-level', 'warn', ...files], {
    cwd: target,
    encoding: 'utf8',
  });
};
