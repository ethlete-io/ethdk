import { cpSync, mkdtempSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from './paths';
import {
  changedCropsIn,
  designShot,
  gridRowsOf,
  NEW_STATE_NOTE,
  planOf,
  rowsOf,
  shotProductOf,
  shotReportOf,
  shownVariantsOf,
  withDiffRows,
} from './shot-command';
import { drawParamsOf } from './shot';
import { createSketch, parseTarget } from './system/sketch/sketch';
import { createSystemModules } from './system/system-modules';

const base = { product: 'app', part: 'components/button', preset: null, width: null, interaction: null };

describe('planOf', () => {
  it('draws one cell per state in a single row', () => {
    const plan = planOf({
      base,
      rows: [{ label: '', sketch: null }],
      statesOf: () => ['rest', 'busy'],
      states: true,
      state: null,
    });

    expect(plan).toHaveLength(1);
    expect(plan[0]?.map((cell) => cell.label)).toEqual(['rest', 'busy']);
    expect(plan[0]?.[1]?.address).toMatchObject({ state: 'busy', sketch: null });
  });

  it('labels a variant by its key alone and draws the first state, or the one asked for', () => {
    const rows = [
      { label: 'a', sketch: { target: 'components/button', variant: 'a' } },
      { label: 'b', sketch: { target: 'components/button', variant: 'b' } },
    ];
    const statesOf = () => ['rest', 'busy'];

    const first = planOf({ base, rows, statesOf, states: false, state: null });
    const asked = planOf({ base, rows, statesOf, states: false, state: 'busy' });

    expect(first.map((row) => row[0]?.label)).toEqual(['a', 'b']);
    expect(first[0]?.[0]?.address).toMatchObject({ state: 'rest', sketch: { variant: 'a' } });
    expect(asked[1]?.[0]?.address.state).toBe('busy');
  });

  it('crosses variants and states, and skips a state a variant lacks', () => {
    const rows = [
      { label: 'a', sketch: { target: 'components/button', variant: 'a' } },
      { label: 'b', sketch: { target: 'components/button', variant: 'b' } },
    ];
    const plan = planOf({
      base,
      rows,
      statesOf: (axis) => (axis.label === 'a' ? ['rest', 'busy'] : ['rest']),
      states: true,
      state: null,
    });

    expect(plan[0]?.map((cell) => cell.label)).toEqual(['a / rest', 'a / busy']);
    expect(plan[1]?.map((cell) => cell.label)).toEqual(['b / rest']);
  });

  it('draws only the states asked for, in the order asked', () => {
    const plan = planOf({
      base,
      rows: [{ label: '', sketch: null }],
      statesOf: () => ['rest', 'hover', 'busy'],
      states: true,
      state: null,
      only: ['busy', 'rest'],
    });

    expect(plan[0]?.map((cell) => cell.label)).toEqual(['busy', 'rest']);
  });
});

describe('planOf widths', () => {
  it("draws each row at its part's first width unless a width or a preset is asked", () => {
    const rows = [
      { label: 'merged', sketch: null },
      { label: 'a', sketch: { target: 'components/button', variant: 'a' } },
    ];
    const widthOf = (axis: { sketch: unknown }) => (axis.sketch ? 320 : 280);
    const statesOf = () => ['rest'];

    const fitted = planOf({ base, rows, statesOf, widthOf, states: true, state: null });
    const asked = planOf({ base: { ...base, width: 500 }, rows, statesOf, widthOf, states: true, state: null });
    const preset = planOf({ base: { ...base, preset: 'phone' }, rows, statesOf, widthOf, states: true, state: null });

    expect(fitted.map((row) => row[0]?.address.width)).toEqual([280, 320]);
    expect(asked.map((row) => row[0]?.address.width)).toEqual([500, 500]);
    expect(preset.map((row) => row[0]?.address.width)).toEqual([null, null]);
  });
});

describe('gridRowsOf', () => {
  it("draws a row per row of the part's grid in its column order, after the states the grid leaves out", () => {
    const [row = []] = planOf({
      base,
      rows: [{ label: '', sketch: null }],
      statesOf: () => ['tree', 'leaf', 'hover', 'selected'],
      states: true,
      state: null,
    });
    const rows = gridRowsOf(row, {
      columns: ['rest', 'hover'],
      rows: ['leaf', 'selected'],
      cells: [
        { row: 'leaf', column: 'hover', state: 'hover' },
        { row: 'leaf', column: 'rest', state: 'leaf' },
        { row: 'selected', column: 'rest', state: 'selected' },
      ],
    });

    expect(rows.map((cells) => cells.map((cell) => ('empty' in cell ? cell : cell.address.state)))).toEqual([
      ['tree'],
      ['leaf', 'hover'],
      ['selected', { empty: 'selected hover' }],
    ]);
  });
});

describe('designShot', () => {
  const run = async (argv: string[]) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const code = await designShot({ target: '/nowhere', argv, invocation: 'et design' });
    const text = error.mock.calls.flat().join('\n');

    error.mockRestore();

    return { code, text };
  };

  it('prints the usage without --states or --variants', async () => {
    const { code, text } = await run(['components/button']);

    expect(code).toBe(2);
    expect(text).toContain('usage: et design shot <layer>/<name> --states');
  });

  it('rejects --at without --variants', async () => {
    expect((await run(['components/button', '--states', '--at', 'HEAD'])).code).toBe(2);
  });

  it('rejects a preset together with a width, and a bad width', async () => {
    expect((await run(['components/button', '--states', '--preset', 'phone', '--width', '300'])).code).toBe(2);
    expect((await run(['components/button', '--states', '--width', 'wide'])).code).toBe(2);
  });

  it('rejects a scale that is not a whole number from 1 to 4', async () => {
    for (const scale of ['0', '5', '1.5', 'big']) {
      expect((await run(['components/button', '--states', '--scale', scale])).code).toBe(2);
    }

    expect((await run(['components/button', '--states', '--scale', '2'])).text).toContain('no config at');
  });

  it('takes an interaction a part can declare, named in the usage', async () => {
    expect((await run(['components/button', '--states', '--interaction', 'hover'])).text).toContain('no config at');

    const { code, text } = await run(['components/button', '--states', '--interaction', 'wiggle']);

    expect(code).toBe(2);
    expect(text).toContain('--interaction <hover|focus-visible|active|disabled>');
  });

  it('takes a list of states without --states', async () => {
    expect((await run(['components/button', '--state', 'rest,busy'])).text).toContain('no config at');
  });

  it('takes --diff-props only with --variants', async () => {
    expect((await run(['components/button', '--states', '--diff-props'])).code).toBe(2);
    expect((await run(['components/button', '--variants', '--diff-props'])).text).toContain('no config at');
  });

  it('takes --round and --variant only with --variants', async () => {
    expect((await run(['components/button', '--states', '--round', 'r2'])).code).toBe(2);
    expect((await run(['components/button', '--states', '--variant', 'i'])).code).toBe(2);
    expect((await run(['components/button', '--variants', '--round', 'r2', '--variant', 'i'])).text).toContain(
      'no config at',
    );
  });

  it('takes --scheme light or dark, named in the usage', async () => {
    expect((await run(['components/button', '--states', '--scheme', 'dark'])).text).toContain('no config at');

    const { code, text } = await run(['components/button', '--states', '--scheme', 'dusk']);

    expect(code).toBe(2);
    expect(text).toContain('--scheme <light|dark>');
  });

  it('takes a crop of four whole numbers', async () => {
    expect((await run(['components/button', '--states', '--crop', '1,2,3'])).code).toBe(2);
    expect((await run(['components/button', '--states', '--crop', '0,0,40,20'])).text).toContain('no config at');
  });

  it('takes --crop changed only with --variants', async () => {
    const { code, text } = await run(['components/button', '--states', '--crop', 'changed']);

    expect(code).toBe(2);
    expect(text).toContain('--crop changed');
    expect((await run(['components/button', '--variants', '--crop', 'changed'])).text).toContain('no config at');
  });

  it('says so when the checkout has no design config', async () => {
    const { code, text } = await run(['components/button', '--states']);

    expect(code).toBe(1);
    expect(text).toContain('no config at');
  });
});

describe('drawParamsOf', () => {
  it('passes the scheme to the frame next to the surface, so a dark surface can draw in the dark scheme', () => {
    const params = drawParamsOf({ '--surface': 'dark', '--scheme': 'dark', '--scale': '2', '--out': 'x.png' });

    expect(Object.fromEntries(params)).toEqual({ surface: 'dark', scheme: 'dark', scale: '2' });
  });
});

describe('shotProductOf', () => {
  const acme = () => {
    const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-design-shot-product-')));

    cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

    return { target, config: readConfig(target) ?? {} };
  };
  const nameOf = (resolved: ReturnType<typeof shotProductOf>) =>
    typeof resolved === 'string' ? resolved : resolved.name;

  it('takes the only product with an open sketch on the part, else the only product with the part', () => {
    const { target, config } = acme();
    const base = createSystemModules({ target, config }).productOf('acme-base');
    const card = parseTarget('components/card');

    if (!base || typeof card === 'string') throw new Error('no acme-base');

    expect(nameOf(shotProductOf({ target, config, asked: undefined, part: 'elements/hero' }))).toBe('acme');
    expect(nameOf(shotProductOf({ target, config, asked: undefined, part: 'components/card' }))).toContain(
      'more than one product',
    );

    createSketch({ product: base, sketch: card, variants: ['a'] });

    expect(nameOf(shotProductOf({ target, config, asked: undefined, part: 'components/card' }))).toBe('acme-base');
    expect(nameOf(shotProductOf({ target, config, asked: 'acme', part: 'components/card' }))).toBe('acme');
  });
});

describe('shotReportOf', () => {
  it('names a new state among the diff lines', () => {
    const sheet = [[{ label: 'b / new vs merged', note: 'new state' }], [{ label: 'merged', note: 'new part' }]];

    expect(shotReportOf({ out: '/tmp/sheet.png', diffs: ['b / rest vs merged: 0 px'], sheet })).toEqual([
      'b / rest vs merged: 0 px',
      'b / new vs merged: new state',
      '/tmp/sheet.png',
    ]);
  });

  it('prints the PNG path after the diff lines', () => {
    expect(
      shotReportOf({ out: '/tmp/sheet.png', diffs: ['a vs merged: 3 px', 'b vs merged: 0 px'], sheet: [] }),
    ).toEqual(['a vs merged: 3 px', 'b vs merged: 0 px', '/tmp/sheet.png']);
  });
});

describe('shownVariantsOf', () => {
  const sketch = {
    variants: ['a', 'b', 'i', 'j'],
    rounds: [
      { key: 'r1', title: 'First', note: '' },
      { key: 'r2', title: 'Second', note: '' },
    ],
    variantInfo: { a: { round: 'r1' }, b: { round: 'r1' }, i: { round: 'r2' }, j: { round: 'r2' } },
  };

  it('keeps every variant without a filter', () => {
    expect(shownVariantsOf({ sketch, rounds: [], variants: [] })).toEqual(['a', 'b', 'i', 'j']);
  });

  it('keeps the variants of the named rounds', () => {
    expect(shownVariantsOf({ sketch, rounds: ['r2'], variants: [] })).toEqual(['i', 'j']);
  });

  it('keeps the named variants, in sketch order, also inside a round', () => {
    expect(shownVariantsOf({ sketch, rounds: [], variants: ['j', 'a'] })).toEqual(['a', 'j']);
    expect(shownVariantsOf({ sketch, rounds: ['r2'], variants: ['j'] })).toEqual(['j']);
  });

  it('names an unknown round or variant, and an empty result', () => {
    expect(shownVariantsOf({ sketch, rounds: ['r4'], variants: [] })).toBe('no round r4 (rounds: r1, r2)');
    expect(shownVariantsOf({ sketch, rounds: [], variants: ['z'] })).toBe('no variant z (variants: a, b, i, j)');
    expect(shownVariantsOf({ sketch, rounds: ['r1'], variants: ['i'] })).toContain('no variant is in round r1');
  });
});

describe('rowsOf', () => {
  it('draws the merged state as the first row of a variants sheet', () => {
    const rows = rowsOf({ part: 'pages/a', variants: ['one', 'two'], merged: true });

    expect(rows.map((row) => row.label)).toEqual(['merged', 'one', 'two']);
    expect(rows[0]?.sketch).toBeNull();
  });

  it('draws only the variants when the part is not merged yet', () => {
    expect(rowsOf({ part: 'pages/a', variants: ['one'], merged: false }).map((row) => row.label)).toEqual(['one']);
  });

  it('still draws a rejected variant, labelled rejected', () => {
    const rows = rowsOf({ part: 'pages/a', variants: ['one', 'two'], merged: false, rejected: ['two'] });

    expect(rows.map((row) => row.label)).toEqual(['one', 'two rejected']);
    expect(rows[1]?.sketch).toEqual({ target: 'pages/a', variant: 'two' });
  });
});

describe('a state only the variants have', () => {
  const rows = rowsOf({ part: 'components/button', variants: ['a'], merged: true });
  const statesOf = (axis: { sketch: unknown }) => (axis.sketch ? ['rest', 'draft'] : ['rest']);

  it('marks the merged cell absent instead of drawing it', () => {
    const plan = planOf({ base, rows, statesOf, states: false, state: 'draft' });

    expect(plan[0]?.[0]).toMatchObject({ label: 'merged / draft', absent: true });
    expect(plan[1]?.[0]?.absent).toBeUndefined();
  });

  it('does not mark a state no version has, nor a state the merged part has', () => {
    expect(planOf({ base, rows, statesOf, states: false, state: 'typo' })[0]?.[0]?.absent).toBeUndefined();
    expect(planOf({ base, rows, statesOf, states: false, state: 'rest' })[0]?.[0]?.absent).toBeUndefined();
  });

  it('reports the variant as a new state, not as a comparison with the absent cell', () => {
    const plan = planOf({ base, rows, statesOf, states: false, state: 'draft' });
    const sheet = [[{ label: 'merged / draft', note: NEW_STATE_NOTE }], [{ label: 'a', png: Buffer.from('a') }]];

    expect(withDiffRows({ rows, plan, sheet })[2]).toEqual([{ label: 'a vs merged', note: 'new state' }]);
  });
});

describe('withDiffRows', () => {
  it('adds a row after each variant row that compares each state with the merged one', () => {
    const rows = rowsOf({ part: 'components/button', variants: ['a', 'b'], merged: true });
    const plan = planOf({
      base,
      rows,
      statesOf: (axis) => (axis.label === 'b' ? ['rest', 'new'] : ['rest']),
      states: true,
      state: null,
    });
    const png = (text: string) => Buffer.from(text);
    const sheet = [
      [{ label: 'merged / rest', png: png('m') }],
      [{ label: 'a / rest', png: png('a') }],
      [
        { label: 'b / rest', error: 'boom' },
        { label: 'b / new', png: png('b') },
      ],
    ];

    expect(withDiffRows({ rows, plan, sheet })).toEqual([
      sheet[0],
      sheet[1],
      [{ label: 'a / rest vs merged', before: png('m'), after: png('a'), over: 'a / rest' }],
      sheet[2],
      [{ label: 'b / new vs merged', note: 'new state' }],
    ]);
  });

  it("compares a variant with the merged part drawn with the variant's state props when it has them", () => {
    const rows = rowsOf({ part: 'components/button', variants: ['a'], merged: true });
    const plan = planOf({ base, rows, statesOf: () => ['rest', 'busy'], states: true, state: null });
    const png = (text: string) => Buffer.from(text);
    const sheet = [
      [
        { label: 'merged / rest', png: png('m') },
        { label: 'merged / busy', png: png('n') },
      ],
      [
        { label: 'a / rest', png: png('a') },
        { label: 'a / busy', png: png('b') },
      ],
    ];
    const props = [
      [],
      [
        { label: 'a / rest', png: png('p') },
        { label: 'a / busy', error: 'boom' },
      ],
    ];

    expect(withDiffRows({ rows, plan, sheet, props })[2]).toEqual([
      { label: 'a / rest vs merged with its props', before: png('p'), after: png('a'), over: 'a / rest' },
      { label: 'a / busy vs merged with its props', note: 'boom' },
    ]);
  });

  it('marks a comparison whose markup differs', () => {
    const rows = rowsOf({ part: 'components/button', variants: ['a'], merged: true });
    const plan = planOf({ base, rows, statesOf: () => ['rest', 'busy'], states: true, state: null });
    const png = Buffer.from('m');
    const sheet = [
      [
        { label: 'merged / rest', png, markup: '<p>rest</p>' },
        { label: 'merged / busy', png, markup: '<p>busy</p>' },
      ],
      [
        { label: 'a / rest', png, markup: '<p>rest</p><i>pin</i>' },
        { label: 'a / busy', png, markup: '<p>busy</p>' },
      ],
    ];

    expect(withDiffRows({ rows, plan, sheet })[2]).toEqual([
      { label: 'a / rest vs merged', before: png, after: png, over: 'a / rest', markupDiffers: true },
      { label: 'a / busy vs merged', before: png, after: png, over: 'a / busy' },
    ]);
  });

  it('lays out each row by the grid of its own axis, a diff row after each grid row', () => {
    const rows = rowsOf({ part: 'components/button', variants: ['a'], merged: true });
    const plan = planOf({
      base,
      rows,
      statesOf: () => ['tree', 'leaf', 'hover', 'selected'],
      states: true,
      state: null,
    });
    const png = Buffer.from('m');
    const sheet = plan.map((row) => row.map(({ label }) => ({ label, png })));
    const grid = {
      columns: ['rest', 'hover'],
      rows: ['leaf', 'selected'],
      cells: [
        { row: 'leaf', column: 'rest', state: 'leaf' },
        { row: 'leaf', column: 'hover', state: 'hover' },
        { row: 'selected', column: 'rest', state: 'selected' },
      ],
    };

    expect(
      withDiffRows({ rows, plan, sheet, grids: [undefined, grid] }).map((row) => row.map((cell) => cell.label)),
    ).toEqual([
      ['merged / tree', 'merged / leaf', 'merged / hover', 'merged / selected'],
      ['a / tree'],
      ['a / tree vs merged'],
      ['a / leaf', 'a / hover'],
      ['a / leaf vs merged', 'a / hover vs merged'],
      ['a / selected', 'selected hover'],
      ['a / selected vs merged'],
    ]);
  });

  it('heads a sheet without a merged row with a note that the part is new', () => {
    const rows = rowsOf({ part: 'components/button', variants: ['a'], merged: false });
    const plan = planOf({ base, rows, statesOf: () => ['rest'], states: true, state: null });
    const sheet = [[{ label: 'a / rest', png: Buffer.from('a') }]];

    expect(withDiffRows({ rows, plan, sheet })).toEqual([
      [{ label: 'merged', note: 'new part, nothing to compare with' }],
      ...sheet,
    ]);
  });
});

describe('changedCropsIn', () => {
  const png = (width: number, height: number, tag: string) => {
    const header = Buffer.alloc(25);

    header.writeUInt32BE(width, 16);
    header.writeUInt32BE(height, 20);
    header.write(tag, 24);

    return header;
  };
  const address = (state: string, variant: string | null) => ({
    ...base,
    state,
    sketch: variant ? { target: 'components/button', variant } : null,
  });

  it('crops each cluster of the boxes of every variant cell against the merged cell of its state', async () => {
    const merged = [png(200, 100, 'a'), png(200, 100, 'b')];
    const variant = [png(200, 100, 'c'), png(200, 100, 'd')];
    const plan = [
      [
        { label: 'rest', address: address('rest', null) },
        { label: 'busy', address: address('busy', null) },
      ],
      [
        { label: 'i rest', address: address('rest', 'i') },
        { label: 'i busy', address: address('busy', 'i') },
      ],
    ];
    const sheet = plan.map((row, rowIndex) =>
      row.map((cell, index) => ({ label: cell.label, png: (rowIndex === 0 ? merged : variant)[index] as Buffer })),
    );
    const boxOf = vi.fn(async (before: Buffer, after: Buffer) =>
      before === merged[0] && after === variant[0]
        ? [{ x: 40, y: 20, width: 10, height: 10 }]
        : before === merged[1] && after === variant[1]
          ? [
              { x: 60, y: 30, width: 10, height: 10 },
              { x: 160, y: 80, width: 10, height: 10 },
            ]
          : [],
    );

    expect(await changedCropsIn({ plan, sheet, mergedIndex: 0, boxOf, scale: 1 })).toEqual([
      { x: 24, y: 4, width: 62, height: 52 },
      { x: 144, y: 64, width: 42, height: 36 },
    ]);
    expect(boxOf).toHaveBeenCalledTimes(2);
  });

  it('gives no crop when no variant changes a pixel', async () => {
    const one = png(10, 10, 'a');
    const plan = [[{ label: 'rest', address: address('rest', null) }], [{ label: 'i', address: address('rest', 'i') }]];
    const sheet = plan.map((row) => row.map((cell) => ({ label: cell.label, png: one })));

    expect(await changedCropsIn({ plan, sheet, mergedIndex: 0, boxOf: async () => [], scale: 1 })).toEqual([]);
  });
});
