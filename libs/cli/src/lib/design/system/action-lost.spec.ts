import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import {
  actionKeysOfMarkup,
  actionLostOf,
  actionLostProblemsOf,
  declaredActionsOf,
  PartModuleLoader,
  partActionsOf,
  productActionsOf,
} from './action-lost';
import { recordBuildReady } from './part-build-ready';
import { PartReady, readyMarkOf } from './part-ready';
import { resolveProduct } from './resolve-product';

const record = (actions?: string[]): PartReady => ({
  hash: 'h',
  at: '2026-10-01T09:00:00.000Z',
  ...(actions ? { actions } : {}),
});

const HARNESS = { harness: { app: 'apps/app-a', map: 'apps/app-a/harness.ts' } };

const checkout = (records: Record<string, PartReady>) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-action-lost-'));
  const dir = join(target, DESIGN_DIR, 'app-a');

  for (const part of ['components/chip', 'pages/home']) {
    mkdirSync(join(dir, part), { recursive: true });
    writeFileSync(join(dir, part, `${part.split('/')[1]}.ts`), 'export default definePart({ states: { a: {} } });\n');
  }

  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': HARNESS } }));
  writeFileSync(join(dir, 'ready.json'), JSON.stringify(records));

  return { target, product: resolveProduct({ target, name: 'app-a', config: HARNESS }) };
};

describe('ACTION-LOST', () => {
  it('reads the distinct action keys of a markup, sorted, in either quote style', () => {
    expect(
      actionKeysOfMarkup(
        `<button data-et-action="open"></button><a data-et-action='emit:pick'></a><i data-et-action="open"></i><p data-et-action-probe="1"></p>`,
      ),
    ).toEqual(['emit:pick', 'open']);
  });

  it('collects the action keys of every state, and skips a state whose render throws', async () => {
    const definition = {
      states: { closed: { open: false }, open: { open: true }, broken: { fail: true } },
      render: (props: { open?: boolean; fail?: boolean }) => {
        if (props.fail) throw new Error('no fixture');

        return {
          body: props.open ? '<button data-et-action="closed">x</button>' : '<button data-et-action="open">o</button>',
        };
      },
    };

    expect(await declaredActionsOf(definition)).toEqual(['closed', 'open']);
    expect(await declaredActionsOf({ states: {} })).toEqual([]);
  });

  it('collects the declared keys of every part of the product', async () => {
    const { product } = checkout({});
    const declared = await productActionsOf({
      product,
      load: async ({ file }) => ({
        default: {
          states: { a: {} },
          render: () => ({ body: `<button data-et-action="${file.includes('chip') ? 'emit:remove' : 'open'}">` }),
        },
      }),
    });

    expect([...declared].sort()).toEqual(['emit:remove', 'open']);
  });

  it('fails a key a check record holds that no part declares now, and allows a key moved to another part', () => {
    const { target, product } = checkout({
      'components/chip': record(['emit:remove', 'open']),
      'pages/home': record(),
      'components/gone': record(['emit:dismiss']),
    });
    const lostOf = (declared: string[], part?: string) =>
      actionLostOf({ product, declared: new Set(declared), invocation: 'et design', part }).map((problem) => ({
        ...problem,
        file: relative(target, problem.file),
      }));

    expect(lostOf(['open', 'emit:remove'])).toEqual([
      {
        rule: 'ACTION-LOST',
        file: '.ethlete/design/app-a/ready.json',
        at: 'components/gone emit:dismiss',
        message:
          'action "emit:dismiss" is in the check record of components/gone from 2026-10-01 and exists nowhere in app-a now - draw it again, or confirm the removal: delete it from the actions of components/gone in ready.json and run et design check --product app-a',
      },
    ]);
    expect(lostOf(['open']).map((problem) => problem.file)).toEqual([
      '.ethlete/design/app-a/components/chip/chip.ts',
      '.ethlete/design/app-a/ready.json',
    ]);
    expect(lostOf(['open'], 'components/chip')).toHaveLength(1);
  });

  it('fails a key from the actions design check recorded, without a go', async () => {
    const { product } = checkout({});
    const load = async () => ({
      default: { states: { a: {} }, render: () => ({ body: '<button data-et-action="emit:remove">' }) },
    });

    await recordBuildReady({
      product,
      by: 'spec',
      cmd: 'check',
      parts: ['components/chip'],
      inputs: { pointsOf: () => [], problemsOf: () => [], slowOf: () => [] },
      actionsOf: async () => [],
      declaredActionsOf: (part) => partActionsOf({ load, product, part }),
    });

    expect(
      actionLostOf({ product, declared: new Set(), invocation: 'et design' }).map((problem) => problem.at),
    ).toEqual(['components/chip emit:remove']);
  });

  it('keeps failing a lost key on every check while the part stays blocked by it', async () => {
    const { target, product } = checkout({});
    const part = 'components/chip';
    const loaderOf = (keys: string[]) => async () => ({
      default: {
        states: { a: {} },
        render: () => ({ body: keys.map((key) => `<button data-et-action="${key}">`).join('') }),
      },
    });
    const lostOf = (load: PartModuleLoader) =>
      actionLostProblemsOf({ target, config: {}, product, invocation: 'et design', load });
    const check = async (load: PartModuleLoader) => {
      const lost = await lostOf(load);

      await recordBuildReady({
        product,
        by: 'spec',
        cmd: 'check',
        parts: [part],
        inputs: { pointsOf: () => [], problemsOf: () => [], slowOf: () => lost },
        actionsOf: async () => [],
        declaredActionsOf: (candidate) => partActionsOf({ load, product, part: candidate }),
      });
    };

    await check(loaderOf(['a', 'b']));
    writeFileSync(join(product.dir, part, 'chip.ts'), 'export default definePart({ states: { a: {}, b: {} } });\n');

    const shrunk = loaderOf(['a']);

    await check(shrunk);
    expect((await lostOf(shrunk)).map((problem) => problem.at)).toEqual([`${part} b`]);
    await check(shrunk);
    expect((await lostOf(shrunk)).map((problem) => problem.at)).toEqual([`${part} b`]);
    expect(readyMarkOf({ product, part })).toBeNull();
  });

  it('reads no part when no check record holds actions', async () => {
    const { target, product } = checkout({ 'pages/home': record() });
    const load = vi.fn();

    expect(await actionLostProblemsOf({ target, config: {}, product, invocation: 'et design', load })).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });
});
