import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { syncBuiltinESMExports } from 'module';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { buildReadyInputsOf } from './check-system';
import { cachedOpenPointsOf } from './open-points-cache';
import { readOpenPoints } from './read-open-points';
import { ResolvedProduct } from './resolve-product';
import { oneProductOf } from './sketch/cli-args';
import { inputsUnchanged, LIST_READS, STAT_READS, trackedRun } from './tracked-reads';

const fs = process.getBuiltinModule('fs') as unknown as Record<string, unknown>;

const WRITES = /^(write|append|mkdir|mkdtemp|rm|unlink|utimes|rename|copy|cp|futimes|close|fsync|fstat|read$)/u;

afterEach(() => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
});

const productOf = (target: string, asked: string) =>
  oneProductOf({ target, config: readConfig(target) ?? {}, asked }) as ResolvedProduct;

const appA = () => {
  const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-open-points-cache-')));
  const design = join(target, DESIGN_DIR);

  mkdirSync(join(design, 'app-a/components/chip'), { recursive: true });
  writeFileSync(
    join(design, 'app-a/components/chip/chip.ts'),
    "export default definePart({ implements: 'apps/other/src/chip.component.ts', states: { default: {} } });\n",
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));
  mkdirSync(join(target, 'apps/other/src'), { recursive: true });
  writeFileSync(join(target, 'apps/other/src/main.ts'), '');

  return target;
};

describe('cachedOpenPointsOf', () => {
  it('keeps its result until an implements target in another app, a config value or a read folder changes', () => {
    const target = appA();
    const chipProblems = () => cachedOpenPointsOf(productOf(target, 'app-a')).inputs.problemsOf('components/chip');
    const first = cachedOpenPointsOf(productOf(target, 'app-a'));

    expect(cachedOpenPointsOf(productOf(target, 'app-a'))).toEqual(first);
    expect(cachedOpenPointsOf(productOf(target, 'app-a')).points).toBe(first.points);
    expect(chipProblems().map((problem) => problem.message)).toEqual([
      expect.stringContaining('apps/other/src/chip.component.ts'),
    ]);

    writeFileSync(join(target, 'apps/other/src/chip.component.ts'), 'export class Chip {}\n');

    expect(chipProblems()).toEqual([]);

    const settled = cachedOpenPointsOf(productOf(target, 'app-a')).points;

    expect(cachedOpenPointsOf(productOf(target, 'app-a')).points).toBe(settled);

    writeFileSync(
      join(target, DESIGN_DIR, 'config.json'),
      JSON.stringify({ products: { 'app-a': { presets: { phone: { width: 390, height: 844 } } } } }),
    );

    expect(cachedOpenPointsOf(productOf(target, 'app-a')).points).not.toBe(settled);

    rmSync(join(target, 'apps/other/src/chip.component.ts'));

    expect(chipProblems()).toHaveLength(1);
  });
});

describe('trackedRun', () => {
  it('sees a changed package version, a vanished file and a folder that gained an entry', () => {
    const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-tracked-reads-')));
    const manifest = join(target, 'node_modules/tailwindcss/package.json');
    const folder = join(target, 'parts');

    mkdirSync(dirname(manifest), { recursive: true });
    mkdirSync(folder);
    writeFileSync(manifest, JSON.stringify({ version: '4.1.0' }));

    const read = () =>
      trackedRun(() => ({
        version: (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }).version,
        parts: readdirSync(folder),
      }));
    const run = read();

    expect(run.value).toEqual({ version: '4.1.0', parts: [] });
    expect(inputsUnchanged(run.inputs)).toBe(true);

    writeFileSync(manifest, JSON.stringify({ version: '4.2.0' }));
    expect(inputsUnchanged(run.inputs)).toBe(false);

    const bumped = read();

    writeFileSync(join(folder, 'card.ts'), '');
    expect(inputsUnchanged(bumped.inputs)).toBe(false);

    const listed = read();

    rmSync(manifest);
    expect(inputsUnchanged(listed.inputs)).toBe(false);
  });

  it('records every file the open points and the static rules open', () => {
    const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-tracked-rules-')));

    cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

    const product = productOf(target, 'acme');
    const opened: { name: string; path: string }[] = [];

    for (const name of Object.keys(fs).filter(
      (key) => key.endsWith('Sync') && typeof fs[key] === 'function' && !WRITES.test(key),
    )) {
      const original = fs[name] as (...args: unknown[]) => unknown;

      vi.spyOn(fs as Record<string, (...args: unknown[]) => unknown>, name).mockImplementation(
        (path: unknown, ...rest: unknown[]) => {
          if (typeof path === 'string') opened.push({ name, path: resolve(path) });

          return original.call(fs, path, ...rest);
        },
      );
    }
    syncBuiltinESMExports();

    const { inputs } = trackedRun(() => buildReadyInputsOf(product, readOpenPoints(product)));
    const tracked = new Set(inputs.map(({ input }) => `${input.kind}\0${input.path}`));
    const kindOf = (name: string) =>
      (LIST_READS as readonly string[]).includes(name)
        ? 'list'
        : (STAT_READS as readonly string[]).includes(name)
          ? 'stat'
          : name;
    const untracked = opened.filter(({ name, path }) => !tracked.has(`${kindOf(name)}\0${path}`));

    expect(opened.length).toBeGreaterThan(0);
    expect(untracked).toEqual([]);
  });
});
