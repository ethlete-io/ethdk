import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { partActionFailuresOf } from './actions-command';
import { appFilesOf } from './app-files';
import { designCompare, ShootStates } from './compare-command';
import { StartHarnessServer } from './harness-server';
import { encodePng } from './part-compare';
import { affectedPartsOf, markImplemented } from './part-task';
import { resolveProduct } from './resolve-product';

const PARTS = ['chip', 'tag', 'icon'];

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-compare-affected-'));
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), source);
  };

  write(`${DESIGN_DIR}/config.json`, JSON.stringify({ products: { 'app-a': {} } }));
  write('tsconfig.base.json', '{}\n');
  write('apps/a/shared/bar.ts', 'export const bar = 1;\n');

  for (const name of PARTS) {
    write(
      `${DESIGN_DIR}/app-a/components/${name}/${name}.ts`,
      `export default definePart({ implements: 'apps/a/${name}/${name}.component.ts', states: { default: {} } });\n`,
    );
    write(
      `apps/a/${name}/${name}.component.ts`,
      `${name === 'icon' ? '' : "import { bar } from '../shared/bar';\n"}export class Component { value = 1; }\n`,
    );
  }

  const product = () => resolveProduct({ target, name: 'app-a', config: {} });

  for (const name of PARTS) {
    markImplemented({
      product: product(),
      part: `components/${name}`,
      states: { default: {} },
      app: appFilesOf({ root: target, component: `apps/a/${name}/${name}.component.ts` }),
    });
  }

  return { target, product };
};

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

const RED = 0xff0000ff;
const BLUE = 0x0000ffff;
const pngOf = (colour: number) => {
  const data = Buffer.alloc(4);

  data.writeUInt32BE(colour >>> 0);

  return encodePng({ width: 1, height: 1, data });
};

const shootOf = (deviating: string[] = []) =>
  vi.fn<ShootStates>(async (options) => ({
    states: { default: {} },
    shots: [{ state: 'default', design: pngOf(RED), app: pngOf(deviating.includes(options.part) ? BLUE : RED) }],
  }));

afterEach(() => vi.restoreAllMocks());

describe('compare --affected', () => {
  it('names each implemented part whose app files moved since its record, with those files', () => {
    const { target, product } = checkout();

    expect(affectedPartsOf(product())).toEqual([]);

    appendFileSync(join(target, 'apps/a/shared/bar.ts'), '// moved\n');

    expect(affectedPartsOf(product())).toEqual([
      { part: 'components/chip', files: ['apps/a/shared/bar.ts'] },
      { part: 'components/tag', files: ['apps/a/shared/bar.ts'] },
    ]);
  }, 30_000);

  it('compares every affected part on one harness, checks its actions there and records each that passes', async () => {
    const { target, product } = checkout();
    const lines = output();
    const stop = vi.fn(async () => undefined);
    const start = vi.fn<StartHarnessServer>(async () => ({ url: 'http://127.0.0.1:50001', stop }));
    const actions = vi.fn<typeof partActionFailuresOf>(async () => []);
    const shoot = shootOf();
    const compare = () =>
      designCompare({
        target,
        argv: ['--affected', '--product', 'app-a'],
        invocation: 'et design',
        shoot,
        start,
        actions,
      });

    expect(await compare()).toBe(0);
    expect(lines).toEqual(['app-a: no implemented part changed since its compare']);
    expect(start).not.toHaveBeenCalled();

    appendFileSync(join(target, 'apps/a/shared/bar.ts'), '// moved\n');
    lines.length = 0;

    expect(await compare()).toBe(0);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(shoot.mock.calls.map(([options]) => options.part)).toEqual(['components/chip', 'components/tag']);
    expect(actions.mock.calls.map(([options]) => [options.part, options.harness])).toEqual([
      ['components/chip', 'http://127.0.0.1:50001'],
      ['components/tag', 'http://127.0.0.1:50001'],
    ]);
    expect(lines.map((line) => line.replace(/\(\d{4}-[^)]+\)/u, '(at)'))).toEqual([
      'affected: components/chip, components/tag',
      'started the harness app on http://127.0.0.1:50001',
      '== components/chip (changed: apps/a/shared/bar.ts)',
      'default ok',
      'recorded components/chip as compared (at)',
      '== components/tag (changed: apps/a/shared/bar.ts)',
      'default ok',
      'recorded components/tag as compared (at)',
    ]);
    expect(affectedPartsOf(product())).toEqual([]);
  }, 30_000);

  it('records no part whose compare deviates or whose actions miss, and exits 1', async () => {
    const { target, product } = checkout();
    const lines = output();
    const actions = vi.fn<typeof partActionFailuresOf>(async (options) =>
      options.part === 'components/chip' ? ['default button "x" click FAILED the state open was not reached'] : [],
    );

    appendFileSync(join(target, 'apps/a/shared/bar.ts'), '// moved\n');

    expect(
      await designCompare({
        target,
        argv: ['--affected', '--product', 'app-a', '--url', 'http://localhost:9'],
        invocation: 'et design',
        shoot: shootOf(['components/tag']),
        actions,
      }),
    ).toBe(1);
    expect(lines).toContain('default button "x" click FAILED the state open was not reached');
    expect(lines).toContain('components/chip: 1 action(s) missed, so nothing was recorded');
    expect(lines).toContain('default DIFF 1 px');
    expect(actions.mock.calls.map(([options]) => options.part)).toEqual(['components/chip']);
    expect(affectedPartsOf(product()).map(({ part }) => part)).toEqual(['components/chip', 'components/tag']);
  }, 30_000);

  it('leaves a part whose design changed since its record to task --verify', async () => {
    const { target, product } = checkout();
    const lines = output();

    appendFileSync(join(target, 'apps/a/shared/bar.ts'), '// moved\n');
    appendFileSync(join(target, DESIGN_DIR, 'app-a/components/tag/tag.ts'), '// moved\n');

    expect(
      await designCompare({
        target,
        argv: ['--affected', '--product', 'app-a', '--url', 'http://localhost:9'],
        invocation: 'et design',
        shoot: shootOf(),
        actions: async () => [],
      }),
    ).toBe(1);
    expect(lines).toContain('components/tag: its design changed since it was implemented - run task --verify');
    expect(affectedPartsOf(product()).map(({ part }) => part)).toEqual(['components/tag']);
  }, 30_000);

  it('takes no part, no --all, --state, --preset or --live', async () => {
    const { target } = checkout();

    output();

    for (const argv of [
      ['components/chip', '--affected'],
      ['--all', '--affected'],
      ['--affected', '--state', 'default'],
      ['--affected', '--live'],
    ]) {
      expect(await designCompare({ target, argv: [...argv, '--product', 'app-a'], invocation: 'et design' })).toBe(2);
    }
  }, 30_000);
});
