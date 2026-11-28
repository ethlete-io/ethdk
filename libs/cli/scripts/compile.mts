import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { assertCompleteBuild } from './move-into-place.mts';

const CLI_CORE_ALIAS = '@ethlete/cli/src/lib/';
const DESIGN_ALIAS = '@ethlete/design';
const SPECIFIER = /(require\(|import\(|from )(["'])([^"']+)\2/g;

/** Swaps `from` over `target` so a reader finds either the old or the new build, never a half-written one. */
export const swapIntoPlace = (from: string, target: string) => {
  const old = `${from}-old`;

  mkdirSync(dirname(target), { recursive: true });
  rmSync(old, { recursive: true, force: true });
  if (existsSync(target)) renameSync(target, old);
  renameSync(from, target);
  rmSync(old, { recursive: true, force: true });
};

const filesOf = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    return entry.isDirectory() ? filesOf(path) : [path];
  });

const isInside = (dir: string, path: string) => path === dir || path.startsWith(`${dir}${sep}`);

const asSpecifier = (from: string, to: string) => {
  const path = relative(dirname(from), to).split(sep).join('/');

  return path.startsWith('.') ? path : `./${path}`;
};

/**
 * Lays the `tsc` output of libs/cli and libs/design (`emitted/cli/**`, `emitted/design/**`) out as the one published
 * package: libs/design's `src/lib/design` lands in `src/lib/design`. The path aliases between the two libs become
 * relative requires, and every source map points at its source from its new place.
 */
export const layOutPackage = (emitted: string, run: string) => {
  const cliSrc = join(emitted, 'cli', 'src');
  const designLib = join(emitted, 'design', 'src', 'lib', 'design');
  const placeOf = (path: string) => {
    if (isInside(cliSrc, path)) return join(run, 'src', relative(cliSrc, path));
    if (isInside(designLib, path)) return join(run, 'src', 'lib', 'design', relative(designLib, path));

    return null;
  };
  const emittedTargetOf = (file: string, specifier: string) => {
    if (specifier === DESIGN_ALIAS) return designLib;
    if (specifier.startsWith(CLI_CORE_ALIAS)) return join(cliSrc, 'lib', specifier.slice(CLI_CORE_ALIAS.length));
    if (specifier.startsWith('.')) return resolve(dirname(file), specifier);

    return null;
  };

  for (const file of filesOf(emitted)) {
    const place = placeOf(file);

    if (!place) continue;

    mkdirSync(dirname(place), { recursive: true });

    if (file.endsWith('.js.map')) {
      const map = JSON.parse(readFileSync(file, 'utf8')) as { sources: string[] };

      map.sources = map.sources.map((source) =>
        relative(dirname(place), resolve(dirname(file), source))
          .split(sep)
          .join('/'),
      );
      writeFileSync(place, JSON.stringify(map));
      continue;
    }

    if (!file.endsWith('.js') && !file.endsWith('.d.ts')) {
      renameSync(file, place);
      continue;
    }

    const text = readFileSync(file, 'utf8').replace(
      SPECIFIER,
      (match, prefix: string, quote: string, specifier: string) => {
        const target = emittedTargetOf(file, specifier);
        const placed = target && placeOf(target);
        const aliased = specifier === DESIGN_ALIAS || specifier.startsWith(CLI_CORE_ALIAS);

        if (aliased && !placed)
          throw new Error(`${relative(emitted, file)} imports ${specifier}, which is not in the package`);
        const crossesLibs = !specifier.startsWith('.') || isInside(cliSrc, file) !== isInside(cliSrc, target ?? '');

        return placed && crossesLibs ? `${prefix}${quote}${asSpecifier(place, placed)}${quote}` : match;
      },
    );

    writeFileSync(place, text);
  }
};

const copyAssets = (run: string) => {
  for (const name of readdirSync('libs/cli').filter((entry) => entry.endsWith('.md'))) {
    cpSync(join('libs/cli', name), join(run, name));
  }

  cpSync('libs/cli/playwright', join(run, 'playwright'), { recursive: true });
  cpSync('libs/design/design', join(run, 'design'), {
    recursive: true,
    filter: (source) => !(statSync(source).isFile() && source.endsWith(`${sep}tsconfig.json`)),
  });

  const manifest = JSON.parse(readFileSync('libs/cli/package.json', 'utf8')) as Record<string, unknown>;

  writeFileSync(join(run, 'package.json'), JSON.stringify({ ...manifest, types: './src/index.d.ts' }, null, 2));
};

if (import.meta.main) {
  const [target] = process.argv.slice(2);

  if (!target) throw new Error('usage: compile.mts <target>');

  const output = resolve(target);
  const run = `${output}-run-${process.pid}`;
  const emitted = `${run}-tsc`;

  rmSync(run, { recursive: true, force: true });
  rmSync(emitted, { recursive: true, force: true });

  try {
    const result = spawnSync('npx', ['tsc', '-p', 'libs/cli/tsconfig.build.json', '--outDir', emitted], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    if (result.status !== 0) throw new Error(`tsc exited with ${result.status}`);

    layOutPackage(emitted, run);
    copyAssets(run);
    assertCompleteBuild(run, run);
    swapIntoPlace(run, output);
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    rmSync(run, { recursive: true, force: true });
    rmSync(emitted, { recursive: true, force: true });
  }
}
