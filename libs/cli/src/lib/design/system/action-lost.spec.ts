import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import {
  actionKeysOfMarkup,
  actionLostOf,
  actionLostProblemsOf,
  declaredActionsOf,
  productActionsOf,
} from './action-lost';
import { PartGo } from './part-go';
import { resolveProduct } from './resolve-product';

const go = (actions?: string[]): PartGo => ({
  hash: 'h',
  by: 'tom',
  at: '2026-10-01T09:00:00.000Z',
  ...(actions ? { actions } : {}),
});

const checkout = (gos: Record<string, PartGo>) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-action-lost-'));
  const dir = join(target, DESIGN_DIR, 'app-a');

  for (const part of ['components/chip', 'pages/home']) {
    mkdirSync(join(dir, part), { recursive: true });
    writeFileSync(join(dir, part, `${part.split('/')[1]}.ts`), 'export default definePart({ states: { a: {} } });\n');
  }

  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));
  writeFileSync(join(dir, 'go.json'), JSON.stringify(gos));

  return { target, product: resolveProduct({ target, name: 'app-a', config: {} }) };
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

  it('fails a key a go recorded that no part declares now, and allows a key moved to another part', () => {
    const { target, product } = checkout({
      'components/chip': go(['emit:remove', 'open']),
      'pages/home': go(),
      'components/gone': go(['emit:dismiss']),
    });
    const lostOf = (declared: string[], part?: string) =>
      actionLostOf({ product, declared: new Set(declared), invocation: 'et design', part }).map((problem) => ({
        ...problem,
        file: relative(target, problem.file),
      }));

    expect(lostOf(['open', 'emit:remove'])).toEqual([
      {
        rule: 'ACTION-LOST',
        file: '.ethlete/design/app-a/go.json',
        message:
          'action "emit:dismiss" was declared at the go of components/gone on 2026-10-01 and exists nowhere in app-a now - draw it again, or confirm the removal with a new go: et design go components/gone --product app-a --by <name>',
      },
    ]);
    expect(lostOf(['open']).map((problem) => problem.file)).toEqual([
      '.ethlete/design/app-a/components/chip/chip.ts',
      '.ethlete/design/app-a/go.json',
    ]);
    expect(lostOf(['open'], 'components/chip')).toHaveLength(1);
  });

  it('reads no part when no go recorded actions', async () => {
    const { target, product } = checkout({ 'pages/home': go() });
    const load = vi.fn();

    expect(await actionLostProblemsOf({ target, config: {}, product, invocation: 'et design', load })).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });
});
