import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { markPartGo } from './part-go';
import {
  allowedFilesOf,
  filesOutsideOf,
  IMPLEMENTED_FILE,
  markImplemented,
  readImplemented,
  stateHashOf,
  surfaceDirectivesOf,
  taskPartOf,
  taskStatesOf,
  verifyRangeOf,
} from './part-task';
import { resolveProduct } from './resolve-product';
import { designTask } from './task-command';
import { THEMING_TEXT } from './theming-text';
import { ComparePart } from './compare-command';
import { StartHarnessServer } from './harness-server';

const CHIP_STATES = { default: { label: 'Tag' }, removable: { label: 'Tag', removable: true } };

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-part-task-'));
  const design = join(target, DESIGN_DIR);
  const part = (path: string, source: string) => {
    mkdirSync(join(design, 'app-a', path), { recursive: true });
    writeFileSync(join(design, 'app-a', path, `${path.split('/')[1]}.ts`), source);
  };

  part(
    'components/chip',
    "export default definePart({ implements: 'libs/chip/chip.component.ts', states: { default: {} } });\n",
  );
  part('components/tag', 'export default definePart({ states: { default: {} } });\n');
  part('pages/inbox', "export default definePart({ implements: { route: '/inbox' }, states: { default: {} } });\n");
  part(
    'pages/outbox',
    "export default definePart({ implements: { route: '/outbox', component: 'src/outbox/outbox.component.ts' }, states: { default: {} } });\n",
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return { target, dir: join(design, 'app-a'), chip: join(design, 'app-a', 'components/chip/chip.ts') };
};

const productOf = (target: string) => resolveProduct({ target, name: 'app-a', config: {} });

const go = (target: string, part = 'components/chip') => markPartGo({ product: productOf(target), part, by: 'tom' });

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

const task = (
  target: string,
  argv: string[],
  diff = vi.fn((): string[] => []),
  compare: ComparePart = vi.fn(async () => 'compare must not run'),
  start: StartHarnessServer = vi.fn(async () => 'no server must start'),
) =>
  designTask({
    target,
    argv: ['components/chip', '--product', 'app-a', ...argv],
    invocation: 'et design',
    load: async () => CHIP_STATES,
    diff,
    compare,
    start,
  });

describe('part task', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allows the component folder, and for sdk also its changesets and component guides', () => {
    const component = 'libs/components/src/lib/chip/chip.component.ts';

    expect(allowedFilesOf({ product: 'app-a', component })).toEqual(['libs/components/src/lib/chip/**']);
    expect(allowedFilesOf({ product: 'sdk', component })).toEqual([
      'libs/components/src/lib/chip/**',
      '.changeset/*.md',
      'apps/docs/components/**',
    ]);

    const allowed = allowedFilesOf({ product: 'sdk', component });

    expect(
      filesOutsideOf({
        allowed,
        files: [
          'libs/components/src/lib/chip/chip.component.css',
          'libs/components/src/lib/chip/parts/x.ts',
          'libs/components/src/lib/chips/x.ts',
          '.changeset/a.md',
          '.changeset/nested/a.md',
          '.changeset/a.json',
          'apps/docs/components/chip.md',
          'apps/docs/cli/index.md',
        ],
      }),
    ).toEqual([
      'libs/components/src/lib/chips/x.ts',
      '.changeset/nested/a.md',
      '.changeset/a.json',
      'apps/docs/cli/index.md',
    ]);
    expect(
      filesOutsideOf({ allowed: allowedFilesOf({ product: 'app-a', component }), files: ['.changeset/a.md'] }),
    ).toEqual(['.changeset/a.md']);
  });

  it('lists every state as new without a record, then the added and changed states, then all states', () => {
    const states = { default: { label: 'a' }, open: { label: 'a', open: true } };

    expect(taskStatesOf({ states, hash: 'h1', record: undefined })).toEqual({
      added: ['default', 'open'],
      changed: [],
      all: false,
    });

    const record = { hash: 'h1', at: 'then', states: { default: stateHashOf({ label: 'a' }) } };

    expect(taskStatesOf({ states, hash: 'h2', record })).toEqual({ added: ['open'], changed: [], all: false });
    expect(taskStatesOf({ states: { default: { label: 'b' } }, hash: 'h2', record })).toEqual({
      added: [],
      changed: ['default'],
      all: false,
    });
    expect(taskStatesOf({ states: { default: { label: 'a' } }, hash: 'h2', record })).toEqual({
      added: [],
      changed: [],
      all: true,
    });
    expect(taskStatesOf({ states: { default: { label: 'a' } }, hash: 'h1', record })).toEqual({
      added: [],
      changed: [],
      all: false,
    });
    expect(stateHashOf({ a: 1, b: { c: 2, d: 3 } })).toBe(stateHashOf({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it('refuses a part without a link, with a route-only link, without a go and with a stale go', () => {
    const { target, chip } = checkout();
    const refusal = (part: string) => taskPartOf({ product: productOf(target), part });

    expect(refusal('components/tag')).toContain('has no implements link');
    go(target, 'pages/inbox');
    expect(refusal('pages/inbox')).toContain('links only its route - add the presentational component');
    go(target, 'pages/outbox');
    expect(refusal('pages/outbox')).toMatchObject({ component: 'src/outbox/outbox.component.ts' });
    expect(allowedFilesOf({ product: 'app-a', component: 'src/outbox/outbox.component.ts' })).toEqual([
      'src/outbox/**',
    ]);
    expect(refusal('components/chip')).toContain('has no go');
    go(target);
    expect(refusal('components/chip')).toMatchObject({ component: 'libs/chip/chip.component.ts' });
    appendFileSync(chip, '// changed\n');
    expect(refusal('components/chip')).toContain('changed since its go');
  });

  it('writes implemented.json sorted with a props hash per state, and reads it back', () => {
    const { target, dir } = checkout();
    const product = productOf(target);

    const chip = markImplemented({ product, part: 'components/chip', states: { b: { x: 1 }, a: {} }, at: 'now' });

    markImplemented({ product, part: 'components/tag', states: { default: {} }, at: 'now' });

    expect(chip).toMatchObject({ at: 'now', states: { a: stateHashOf({}), b: stateHashOf({ x: 1 }) } });
    expect(Object.keys(readImplemented(dir))).toEqual(['components/chip', 'components/tag']);
    expect(readImplemented(dir)['components/chip']).toEqual(chip);
    expect(readFileSync(join(dir, IMPLEMENTED_FILE), 'utf8')).toMatch(
      /"components\/chip"[\s\S]*"components\/tag"[\s\S]*\}\n$/,
    );
    expect(markImplemented({ product, part: 'components/none', states: {} })).toContain('has no part');
  });

  it('prints the task with the states since the implemented record', async () => {
    const { target, dir } = checkout();
    const lines = output();

    expect(await task(target, [])).toBe(1);
    expect(lines.join('\n')).toContain('has no go');

    const marked = go(target);

    lines.length = 0;
    expect(await task(target, [])).toBe(0);
    expect(lines).toEqual([
      'part components/chip in app-a',
      `go ${'hash' in marked ? marked.hash : ''}`,
      'implements libs/chip/chip.component.ts',
      'states:',
      '  default {"label":"Tag"}',
      '  removable {"label":"Tag","removable":true}',
      'not implemented yet:',
      '  new: default, removable',
      'allowed files:',
      '  libs/chip/**',
      'target: compare green',
      THEMING_TEXT,
    ]);

    markImplemented({ product: productOf(target), part: 'components/chip', states: { default: { label: 'Old' } } });
    expect(readImplemented(dir)['components/chip']).toBeDefined();
    lines.length = 0;
    await task(target, []);
    expect(lines).toContain('  new: removable');
    expect(lines).toContain('  changed: default');
  });

  it('maps the surface attributes of a part to the directives of @ethlete/core', async () => {
    expect(surfaceDirectivesOf('<div data-et-auto-surface><button data-et-surface-interactive>')).toEqual([
      'data-et-auto-surface -> etAutoSurface',
      'data-et-surface-interactive -> etSurfaceInteractive',
    ]);
    expect(surfaceDirectivesOf('<div data-et-auto-surface-x class="et-surface--dark">')).toEqual([]);

    const { target, chip } = checkout();
    const lines = output();

    writeFileSync(
      chip,
      "export default definePart({ implements: 'libs/chip/chip.component.ts', states: { default: {} }, render: () => ({ body: '<div data-et-auto-surface></div>' }) });\n",
    );
    go(target);

    expect(await task(target, [])).toBe(0);
    expect(lines.slice(lines.indexOf('surface directives (@ethlete/core):'))).toEqual([
      'surface directives (@ethlete/core):',
      '  data-et-auto-surface -> etAutoSurface',
      'target: compare green',
      THEMING_TEXT,
    ]);
  });

  it('verifies the files of a commit or range, then records the part only when compare is green', async () => {
    const { target, dir } = checkout();
    const lines = output();

    go(target);

    const inside = vi.fn(() => ['libs/chip/chip.component.ts', 'libs/chip/chip.component.css']);

    const stop = vi.fn(async () => undefined);
    const start = vi.fn(async () => ({ url: 'http://127.0.0.1:50001', stop }));
    const started = vi.fn<ComparePart>(async () => ({ green: false, states: CHIP_STATES }));

    expect(await task(target, ['--verify'], inside, started, start)).toBe(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(started).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://127.0.0.1:50001' }));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(readImplemented(dir)).toEqual({});

    const red = vi.fn<ComparePart>(async () => ({ green: false, states: CHIP_STATES }));

    lines.length = 0;
    expect(await task(target, ['--verify', '--url', 'http://localhost:9'], inside, red)).toBe(1);
    expect(inside).toHaveBeenCalledWith({ root: target, range: 'HEAD^..HEAD' });
    expect(red).toHaveBeenCalledWith(
      expect.objectContaining({ part: 'components/chip', url: 'http://localhost:9', only: null }),
    );
    expect(lines.join('\n')).toContain('nothing was recorded');
    expect(readImplemented(dir)).toEqual({});

    const failed = vi.fn<ComparePart>(async () => 'the harness page did not load');

    expect(await task(target, ['--verify', '--url', 'http://localhost:9'], inside, failed)).toBe(1);
    expect(readImplemented(dir)).toEqual({});

    const green = vi.fn<ComparePart>(async () => ({ green: true, states: CHIP_STATES }));

    lines.length = 0;
    expect(await task(target, ['--verify', '--url', 'http://localhost:9'], inside, green)).toBe(0);
    expect(lines.join('\n')).toContain('recorded components/chip as implemented');
    expect(readImplemented(dir)['components/chip']?.states).toEqual({
      default: stateHashOf(CHIP_STATES.default),
      removable: stateHashOf(CHIP_STATES.removable),
    });

    const outside = vi.fn(() => ['libs/chip/chip.component.ts', 'libs/other/x.ts']);

    lines.length = 0;
    expect(await task(target, ['--verify', 'a1..b2', '--url', 'http://localhost:9'], outside, red)).toBe(1);
    expect(outside).toHaveBeenCalledWith({ root: target, range: 'a1..b2' });
    expect(red).toHaveBeenCalledTimes(1);
    expect(lines).toContain('  libs/other/x.ts');
    expect(lines).not.toContain('  libs/chip/chip.component.ts');
    expect(verifyRangeOf('abc')).toBe('abc^..abc');
  });
});
