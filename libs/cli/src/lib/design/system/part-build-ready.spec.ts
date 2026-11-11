import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { originOf } from './write-origin';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { ActionsOf, BuildReadyInputs, buildReadyOf, recordBuildReady } from './part-build-ready';
import { readReady, READY_FILE, readyMarkOf, readyPartOf, writePartRecord } from './part-ready';
import { resolveProduct } from './resolve-product';

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-build-ready-'));
  const design = join(target, DESIGN_DIR);
  const part = (path: string, source: string) => {
    mkdirSync(join(design, 'app-a', path), { recursive: true });
    writeFileSync(join(design, 'app-a', path, `${path.split('/')[1]}.ts`), source);
  };

  part('components/chip', 'export default definePart({ controls: { remove: {} }, states: { default: {} } });\n');
  part(
    'pages/home',
    "import chip from '@system/components/chip';\nexport default definePart({ states: { default: { chip } } });\n",
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return { target, dir: join(design, 'app-a') };
};

const harness = { app: 'apps/app-a', map: 'apps/app-a/src/map.ts', baseBranch: 'x' };

const productOf = (target: string) => resolveProduct({ target, name: 'app-a', config: { harness } });

const green: BuildReadyInputs = { pointsOf: () => [], problemsOf: () => [], slowOf: () => [] };

describe('buildReadyOf', () => {
  it('blocks a host whose embedded part has an open point', () => {
    const { target } = checkout();
    const product = productOf(target);

    writePartRecord({ product, part: 'pages/home', origin: originOf('spec') });

    const inputs: BuildReadyInputs = {
      ...green,
      pointsOf: (part) => (part === 'components/chip' ? [{ kind: 'missing-state', control: 'remove' }] : []),
    };

    expect(buildReadyOf({ product, part: 'pages/home', inputs })).toEqual({
      ready: false,
      blockers: [{ kind: 'embedded', text: 'components/chip is not build-ready', part: 'components/chip' }],
    });
  });

  it('blocks a part with a static rule problem, and one whose slow result is pending', () => {
    const { target } = checkout();
    const product = productOf(target);
    const part = 'components/chip';

    writePartRecord({ product, part, origin: originOf('spec') });

    expect(
      buildReadyOf({
        product,
        part,
        inputs: { ...green, problemsOf: () => [{ rule: 'HARD-CODED-COLOUR', file: 'chip.ts', message: '#fff' }] },
      }),
    ).toEqual({ ready: false, blockers: [{ kind: 'problem', text: 'HARD-CODED-COLOUR: #fff' }] });
    expect(buildReadyOf({ product, part, inputs: { ...green, slowOf: () => 'pending' } })).toEqual({
      ready: false,
      blockers: [{ kind: 'pending', text: 'the slow checks have not run on the current inputs' }],
    });
    expect(
      buildReadyOf({
        product,
        part,
        inputs: { ...green, slowOf: () => [{ rule: 'COMPARE', file: 'chip.ts', message: 'differs' }] },
      }),
    ).toEqual({ ready: false, blockers: [{ kind: 'compare', text: 'COMPARE: differs' }] });
  });

  it('answers a green part ready, signed, and blocks it once the design moves', () => {
    const { target, dir } = checkout();
    const product = productOf(target);

    expect(buildReadyOf({ product, part: 'components/chip', inputs: green })).toEqual({
      ready: false,
      blockers: [expect.objectContaining({ kind: 'stale-record' })],
    });

    writePartRecord({ product, part: 'components/chip', origin: originOf('spec') });

    expect(buildReadyOf({ product, part: 'components/chip', inputs: green })).toEqual({ ready: true });
    expect(readFileSync(join(dir, READY_FILE), 'utf8')).toContain('"by": "spec"');

    writeFileSync(join(dir, 'components/chip/chip.ts'), 'export default definePart({ states: { other: {} } });\n');

    expect(buildReadyOf({ product: productOf(target), part: 'components/chip', inputs: green })).toEqual({
      ready: false,
      blockers: [expect.objectContaining({ kind: 'stale-record' })],
    });
  });

  it('reads an old record that names who marked it', () => {
    const { target, dir } = checkout();
    const found = readyPartOf({ product: productOf(target), part: 'components/chip' });
    const old = typeof found === 'string' ? {} : { hash: found.hash, files: found.design.files };

    writeFileSync(
      join(dir, READY_FILE),
      JSON.stringify({ 'components/chip': { ...old, by: 'tom', at: '2026-01-01T00:00:00.000Z' } }),
    );

    expect(buildReadyOf({ product: productOf(target), part: 'components/chip', inputs: green })).toEqual({
      ready: true,
    });
  });
});

describe('recordBuildReady', () => {
  it('writes embedded parts before their hosts once the actions pass, and drops a record that turns blocked', async () => {
    const { target, dir } = checkout();
    const product = productOf(target);
    const actionsOf = vi.fn<ActionsOf>(async () => []);

    const written = await recordBuildReady({
      product,
      parts: ['pages/home', 'components/chip'],
      inputs: green,
      actionsOf,
    });

    expect(written.get('pages/home')).toEqual({ ready: true });
    expect(actionsOf.mock.calls.map(([part]) => part)).toEqual(['components/chip', 'pages/home']);
    expect(Object.keys(readReady(dir))).toEqual(['components/chip', 'pages/home']);
    expect(Object.values(readReady(dir)).every((record) => record.by === 'et design check')).toBe(true);

    const blocked = await recordBuildReady({
      product,
      parts: ['components/chip'],
      inputs: { ...green, problemsOf: () => [{ rule: 'HARD-CODED-COLOUR', file: 'chip.ts', message: '#fff' }] },
      actionsOf,
    });

    expect(blocked.get('components/chip')).toEqual({
      ready: false,
      blockers: [expect.objectContaining({ kind: 'problem' })],
    });
    expect(Object.keys(readReady(dir))).toEqual(['pages/home']);
  });

  it('writes no new record without an action check, and none when the actions fail', async () => {
    const { target, dir } = checkout();
    const product = productOf(target);

    await recordBuildReady({ product, parts: ['components/chip'], inputs: green });

    expect(readReady(dir)).toEqual({});

    const failed = await recordBuildReady({
      product,
      parts: ['components/chip'],
      inputs: green,
      actionsOf: async () => ['default button "remove" click FAILED'],
    });

    expect(failed.get('components/chip')).toEqual({
      ready: false,
      blockers: [{ kind: 'action', text: 'default button "remove" click FAILED' }],
    });
    expect(readReady(dir)).toEqual({});
  });

  it('records the actions the part declares, and keeps the held ones when they cannot be read', async () => {
    const { target, dir } = checkout();
    const product = productOf(target);
    const record = (declaredActionsOf: (part: string) => Promise<string[] | string>) =>
      recordBuildReady({
        product,
        parts: ['components/chip'],
        inputs: green,
        actionsOf: async () => [],
        declaredActionsOf,
      });

    writeFileSync(
      join(dir, READY_FILE),
      JSON.stringify({ 'components/chip': { hash: 'old', at: 'then', actions: ['go:old'] } }),
    );
    await record(async () => ['emit:remove']);

    expect(readReady(dir)['components/chip']?.actions).toEqual(['emit:remove']);

    writeFileSync(
      join(dir, READY_FILE),
      JSON.stringify({ 'components/chip': { hash: 'old', at: 'then', actions: ['go:old'] } }),
    );
    await record(async () => 'cannot load the part');

    expect(readReady(dir)['components/chip']?.actions).toEqual(['go:old']);
  });

  it('writes the record of a host whose embedded part is not build-ready, and keeps the host from build-ready', async () => {
    const { target } = checkout();
    const product = productOf(target);
    const inputs: BuildReadyInputs = {
      ...green,
      problemsOf: (part) =>
        part === 'components/chip' ? [{ rule: 'HARD-CODED-COLOUR', file: 'chip.ts', message: '#fff' }] : [],
    };
    const lines: string[] = [];

    const results = await recordBuildReady({
      product,
      parts: ['pages/home', 'components/chip'],
      inputs,
      actionsOf: async () => [],
      onNoRecord: (line) => lines.push(line),
    });

    expect(readyMarkOf({ product, part: 'pages/home' })).not.toBeNull();
    expect(readyMarkOf({ product, part: 'components/chip' })).toBeNull();
    expect(results.get('pages/home')).toEqual({
      ready: false,
      blockers: [{ kind: 'embedded', text: 'components/chip is not build-ready', part: 'components/chip' }],
    });
    expect(buildReadyOf({ product, part: 'pages/home', inputs })).toEqual(results.get('pages/home'));
    expect(lines).toEqual(['NO RECORD app-a components/chip: problem: HARD-CODED-COLOUR: #fff']);
  });

  it('keeps a page from build-ready while a part two levels down is not, though the part between has its record', async () => {
    const { target } = checkout();
    const design = join(target, DESIGN_DIR, 'app-a', 'pages/shell');

    mkdirSync(design, { recursive: true });
    writeFileSync(
      join(design, 'shell.ts'),
      "import home from '@system/pages/home';\nexport default definePart({ states: { default: { home } } });\n",
    );

    const product = productOf(target);
    const inputs: BuildReadyInputs = {
      ...green,
      problemsOf: (part) =>
        part === 'components/chip' ? [{ rule: 'HARD-CODED-COLOUR', file: 'chip.ts', message: '#fff' }] : [],
    };

    await recordBuildReady({
      product,
      parts: ['pages/shell', 'pages/home', 'components/chip'],
      inputs,
      actionsOf: async () => [],
    });

    expect(readyMarkOf({ product, part: 'pages/home' })).not.toBeNull();
    expect(buildReadyOf({ product, part: 'pages/shell', inputs })).toEqual({
      ready: false,
      blockers: [{ kind: 'embedded', text: 'components/chip is not build-ready', part: 'components/chip' }],
    });
  });

  it('says why it wrote no record when the actions did not run', async () => {
    const { target } = checkout();
    const lines: string[] = [];

    await recordBuildReady({
      product: productOf(target),
      parts: ['components/chip'],
      inputs: green,
      onNoRecord: (line) => lines.push(line),
    });

    expect(lines).toEqual(['NO RECORD app-a components/chip: the actions did not run']);
  });

  it('drops the record of each part of a product without a harness, with a definite blocker', async () => {
    const { target } = checkout();
    const product = resolveProduct({ target, name: 'app-a', config: {} });
    const lines: string[] = [];

    writePartRecord({ product, part: 'components/chip', origin: originOf('spec') });

    const results = await recordBuildReady({
      product,
      parts: ['components/chip', 'pages/home'],
      inputs: { pointsOf: () => [], problemsOf: () => [] },
      actionsOf: async () => [],
      onNoRecord: (line) => lines.push(line),
    });
    const kindsOf = (part: string) => {
      const ready = results.get(part);

      return ready && !ready.ready ? ready.blockers.map((blocker) => blocker.kind) : [];
    };

    expect(kindsOf('components/chip')).toEqual(['no-harness']);
    expect(kindsOf('pages/home')).toContain('no-harness');
    expect(kindsOf('pages/home')).not.toContain('pending');
    expect(readyMarkOf({ product, part: 'components/chip' })).toBeNull();
    expect(lines[0]).toMatch(/^NO RECORD app-a components\/chip: no-harness: /u);
  });

  it('says which record it dropped and why, and stays silent for a part without a record', async () => {
    const { target } = checkout();
    const product = resolveProduct({ target, name: 'app-a', config: {} });
    const lines: string[] = [];

    writePartRecord({ product, part: 'components/chip', origin: originOf('spec') });

    await recordBuildReady({
      product,
      parts: ['components/chip', 'pages/home'],
      inputs: { pointsOf: () => [], problemsOf: () => [] },
      actionsOf: async () => [],
      onRecordDropped: (line) => lines.push(line),
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^RECORD DROPPED app-a components\/chip: no-harness: /u);
  });
});
