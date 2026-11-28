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

const CLI_CORE_ALIASES = ['@ethlete/cli-core/'];
const DESIGN_ALIAS = '@ethlete/design';
const SPECIFIER = /(require\(|import\(|from )(["'])([^"']+)\2/g;
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

type SourceMap = { sources: string[]; mappings?: string };
type ColumnShift = { from: number; by: number };

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

const readVlq = (segment: string, start: number) => {
  let value = 0;
  let shift = 0;
  let end = start;

  for (let digit = 32; digit & 32; shift += 5) {
    digit = BASE64.indexOf(segment[end++] ?? '');
    value += (digit & 31) * 2 ** shift;
  }

  return { value: value % 2 ? -Math.floor(value / 2) : value / 2, end };
};

const writeVlq = (value: number) => {
  let rest = value < 0 ? -value * 2 + 1 : value * 2;
  let text = '';

  do {
    const digit = rest % 32;

    rest = Math.floor(rest / 32);
    text += BASE64[rest ? digit + 32 : digit];
  } while (rest);

  return text;
};

const shiftGeneratedColumns = (mappings: string, shifts: ColumnShift[][]) =>
  mappings
    .split(';')
    .map((line, index) => {
      const lineShifts = shifts[index] ?? [];

      if (!line || !lineShifts.length) return line;

      let column = 0;
      let shifted = 0;

      return line
        .split(',')
        .map((segment) => {
          const { value, end } = readVlq(segment, 0);

          column += value;

          const next = column + lineShifts.filter(({ from }) => from <= column).reduce((sum, { by }) => sum + by, 0);
          const text = writeVlq(next - shifted) + segment.slice(end);

          shifted = next;

          return text;
        })
        .join(',');
    })
    .join(';');

/**
 * Lays the `tsc` output of libs/cli, libs/cli-core and libs/design (`emitted/{cli,cli-core,design}/**`) out as the one
 * published package: libs/cli-core's `src/lib` lands in `src/lib`, libs/design's `src/lib/design` in `src/lib/design`. The path aliases between the two libs become
 * relative requires, and every source map points at its source from where `run` is moved to (`final`).
 */
export const layOutPackage = (emitted: string, run: string, final = run) => {
  const cliSrc = join(emitted, 'cli', 'src');
  const coreSrc = join(emitted, 'cli-core', 'src');
  const designLib = join(emitted, 'design', 'src', 'lib', 'design');
  const placeOf = (path: string) => {
    if (isInside(cliSrc, path)) return join(run, 'src', relative(cliSrc, path));
    if (isInside(coreSrc, path)) return join(run, 'src', relative(coreSrc, path));
    if (isInside(designLib, path)) return join(run, 'src', 'lib', 'design', relative(designLib, path));

    return null;
  };
  const emittedTargetOf = (file: string, specifier: string) => {
    if (specifier === DESIGN_ALIAS) return designLib;
    const coreAlias = CLI_CORE_ALIASES.find((alias) => specifier.startsWith(alias));
    if (coreAlias) return join(coreSrc, 'lib', specifier.slice(coreAlias.length));
    if (specifier.startsWith('.')) return resolve(dirname(file), specifier);

    return null;
  };

  const writeMap = (mapFile: string, mapPlace: string, shifts: ColumnShift[][]) => {
    const map = JSON.parse(readFileSync(mapFile, 'utf8')) as SourceMap;
    const finalDir = join(final, relative(run, dirname(mapPlace)));

    map.sources = map.sources.map((source) =>
      relative(finalDir, resolve(dirname(mapFile), source))
        .split(sep)
        .join('/'),
    );
    if (map.mappings) map.mappings = shiftGeneratedColumns(map.mappings, shifts);
    writeFileSync(mapPlace, JSON.stringify(map));
  };

  for (const file of filesOf(emitted)) {
    const place = placeOf(file);

    if (!place) continue;

    mkdirSync(dirname(place), { recursive: true });

    if (file.endsWith('.js.map')) {
      if (!existsSync(file.slice(0, -'.map'.length))) writeMap(file, place, []);
      continue;
    }

    if (!file.endsWith('.js') && !file.endsWith('.d.ts')) {
      renameSync(file, place);
      continue;
    }

    const shifts: ColumnShift[][] = [];
    const text = readFileSync(file, 'utf8')
      .split('\n')
      .map((line, index) =>
        line.replace(SPECIFIER, (match, prefix: string, quote: string, specifier: string, at: number) => {
          const target = emittedTargetOf(file, specifier);
          const placed = target && placeOf(target);
          const aliased = specifier === DESIGN_ALIAS || CLI_CORE_ALIASES.some((alias) => specifier.startsWith(alias));

          if (aliased && !placed)
            throw new Error(`${relative(emitted, file)} imports ${specifier}, which is not in the package`);
          const crossesLibs = !specifier.startsWith('.') || isInside(cliSrc, file) !== isInside(cliSrc, target ?? '');

          if (!placed || !crossesLibs) return match;

          const replaced = `${prefix}${quote}${asSpecifier(place, placed)}${quote}`;

          (shifts[index] ??= []).push({ from: at + match.length, by: replaced.length - match.length });

          return replaced;
        }),
      )
      .join('\n');

    writeFileSync(place, text);
    if (file.endsWith('.js') && existsSync(`${file}.map`)) writeMap(`${file}.map`, `${place}.map`, shifts);
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
  const [target, final] = process.argv.slice(2);

  if (!target) throw new Error('usage: compile.mts <target> [<final place it is moved to>]');

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

    layOutPackage(emitted, run, resolve(final ?? target));
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
