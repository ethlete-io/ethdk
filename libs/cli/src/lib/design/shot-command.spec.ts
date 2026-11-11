import { cpSync, mkdtempSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from './design-config';
import {
  changedCropsIn,
  designShot,
  gridRowsOf,
  inPageRefusalOf,
  NEW_STATE_NOTE,
  planOf,
  rowsOf,
  sketchHoldingOf,
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
    expect(text).toContain('usage: et design shot <layer>/<name>[@<sketch>] --states');
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

  describe('flag combinations', () => {
    const accepted: string[][] = [
      ['--states'],
      ['--variants'],
      ['--states', '--variants'],
      ['--state', 'rest'],
      ['--state', 'rest', '--out', 'a.png'],
      ['--state', 'rest,busy'],
      ['--states', '--state', 'rest,busy'],
      ['--variants', '--state', 'rest'],
      ['--variants', '--out', 'a.png'],
      ['--states', '--variants', '--out', 'a.png'],
      ['--variants', '--round', 'r1', '--variant', 'a'],
      ['--variants', '--at', 'HEAD'],
      ['--variants', '--diff-props'],
      ['--variants', '--crop', 'changed'],
      ['--states', '--crop', '0,0,10,10'],
      ['--states', '--interaction', 'hover', '--scheme', 'dark', '--scale', '2'],
      ['--states', '--preset', 'phone'],
      ['--states', '--width', '300'],
      ['--states', '--product', 'studio', '--surface', 'a', '--color', 'b'],
    ];

    it.each(accepted.map((flags) => [flags]))('accepts %j', async (flags) => {
      const { code, text } = await run(['components/button', ...flags]);

      expect(code).toBe(1);
      expect(text).toContain('no config at');
    });

    const refused: [string[], string][] = [
      [[], '--states, --variants or --state'],
      [['--out', 'a.png'], '--states, --variants or --state'],
      [['--states', '--at', 'HEAD'], '--at needs --variants'],
      [['--states', '--diff-props'], '--diff-props needs --variants'],
      [['--states', '--round', 'r2'], '--round needs --variants'],
      [['--states', '--variant', 'i'], '--variant needs --variants'],
      [['--states', '--crop', 'changed'], '--crop changed needs --variants'],
      [['--states', '--crop', '1,2,3'], '--crop takes'],
      [['--states', '--preset', 'phone', '--width', '300'], '--preset and --width'],
      [['--states', '--width', 'wide'], '--width takes'],
      [['--states', '--scale', '9'], '--scale takes'],
      [['--states', '--interaction', 'wiggle'], '--interaction takes'],
      [['--states', '--scheme', 'dusk'], '--scheme takes'],
    ];

    it.each(refused)('refuses %j and names %s', async (flags, named) => {
      const { code, text } = await run(['components/button', ...flags]);

      expect(code).toBe(2);
      expect(text).toContain(named);
      expect(text).toContain('usage: et design shot');
    });

    it('refuses a missing part and an extra positional', async () => {
      const missing = await run(['--states']);
      const extra = await run(['components/button', 'components/tabs', '--states']);

      expect(missing.text).toContain('needs a <layer>/<name> part');
      expect(extra.text).toContain('takes one <layer>/<name> part');
    });
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
  it('leaves out a variant its agent withdrew, unless --all or --variant asks for it', () => {
    const withdrawn = {
      by: 'agent',
      decidedAt: '2026-11-03T10:00:00.000Z',
      status: 'withdrawn',
      withdrawnBy: 'm',
    } as const;
    const sketch = {
      variants: ['a', 'b', 'c'],
      rounds: [{ key: 'r1', title: 'r1', note: '' }],
      variantInfo: {},
      rejections: { b: [withdrawn], c: [{ by: 'designer' as const, decidedAt: '2026-11-03T10:00:00.000Z' }] },
    };

    expect(shownVariantsOf({ sketch, rounds: [], variants: [] })).toEqual(['a', 'c']);
    expect(shownVariantsOf({ sketch, rounds: [], variants: [], all: true })).toEqual(['a', 'b', 'c']);
    expect(shownVariantsOf({ sketch, rounds: [], variants: ['b'] })).toEqual(['b']);
    expect(shownVariantsOf({ sketch: { ...sketch, variants: ['b'] }, rounds: [], variants: [] })).toContain('--all');
  });

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

describe('a sketch with extra targets', () => {
  it('is found by an extra target and draws its variants under the main target', () => {
    const sketch = { target: 'pages/a', targets: ['pages/a', 'pages/b'] };

    expect(sketchHoldingOf([sketch], 'pages/b')).toBe(sketch);
    expect(sketchHoldingOf([sketch], 'pages/c')).toBeUndefined();
    expect(rowsOf({ part: 'pages/b', sketchTarget: 'pages/a', variants: ['one'], merged: false })[0]?.sketch).toEqual({
      target: 'pages/a',
      variant: 'one',
    });
  });
});

describe('two open sketches on one part', () => {
  const a = { target: 'pages/system@a', targets: ['pages/system'] };
  const b = { target: 'pages/system@b', targets: ['pages/system'] };

  it('draws the sketch a <part>@<name> shot names, not the first one on the part', () => {
    const held = sketchHoldingOf([a, b], 'pages/system@b');
    const sketchTarget = typeof held === 'string' ? held : held?.target;

    expect(sketchTarget).toBe('pages/system@b');
    expect(rowsOf({ part: 'pages/system', sketchTarget, variants: ['one'], merged: true })[1]?.sketch).toEqual({
      target: 'pages/system@b',
      variant: 'one',
    });
    expect(sketchHoldingOf([a, b], 'pages/system@c')).toBeUndefined();
  });

  it('refuses a bare part and names the <part>@<name> targets, but draws the unnamed sketch of a bare part', () => {
    expect(sketchHoldingOf([a, b], 'pages/system')).toBe(
      'pages/system has 2 open sketches - name one: pages/system@a, pages/system@b',
    );

    const unnamed = { target: 'pages/system', targets: ['pages/system'] };

    expect(sketchHoldingOf([a, unnamed], 'pages/system')).toBe(unnamed);
    expect(sketchHoldingOf([a], 'pages/system')).toBe(a);
  });

  it('refuses a bare shot of a part with two named sketches before it draws', async () => {
    const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-design-shot-named-')));

    cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

    const product = createSystemModules({ target, config: readConfig(target) ?? {} }).productOf('acme');

    if (!product) throw new Error('no acme');

    for (const name of ['a', 'b']) {
      const parsed = parseTarget(`components/button@${name}`);

      if (typeof parsed === 'string') throw new Error(parsed);

      const created = createSketch({ merge: 'override', product, sketch: parsed, variants: ['one'] });

      if (typeof created === 'string') throw new Error(created);
    }

    const run = async (part: string) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const code = await designShot({
        target,
        argv: [part, '--variants', '--product', 'acme'],
        invocation: 'et design',
      });
      const text = error.mock.calls.flat().join('\n');

      error.mockRestore();

      return { code, text };
    };

    expect(await run('components/button')).toEqual({
      code: 1,
      text: 'design-explore: components/button has 2 open sketches - name one: components/button@a, components/button@b',
    });
    expect(await run('components/button@c')).toEqual({
      code: 1,
      text: 'design-explore: components/button@c has no open sketch in product "acme"',
    });
  });
});

describe('a sketch drawn in a page that embeds its part', () => {
  const acme = () => {
    const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-design-shot-in-')));

    cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

    const product = createSystemModules({ target, config: readConfig(target) ?? {} }).productOf('acme');

    if (!product) throw new Error('no acme');

    return { target, product };
  };
  const sketchOn = (part: string) => ({ target: part, targets: [part] });

  it('takes a page that imports the part through another part, or a part every part takes as tokens', () => {
    const { product } = acme();

    expect(inPageRefusalOf({ product, sketch: sketchOn('components/button'), page: 'pages/home' })).toBeNull();
    expect(inPageRefusalOf({ product, sketch: sketchOn('foundations/tokens'), page: 'elements/hero' })).toBeNull();
  });

  it('refuses a page that does not embed the part, and a part the product lacks', () => {
    const { product } = acme();

    expect(inPageRefusalOf({ product, sketch: sketchOn('foundations/palette'), page: 'pages/home' })).toBe(
      '--in pages/home: pages/home does not embed foundations/palette (not imported, directly or through another part, and not a tokens part of product "acme")',
    );
    expect(inPageRefusalOf({ product, sketch: sketchOn('components/button'), page: 'pages/nowhere' })).toBe(
      '--in pages/nowhere: product "acme" has no part "pages/nowhere"',
    );
  });

  it('refuses --in without --variants, and a page that does not embed the sketch before it draws', async () => {
    const { target, product } = acme();
    const palette = parseTarget('foundations/palette');

    if (typeof palette === 'string') throw new Error(palette);

    const created = createSketch({ product, sketch: palette, variants: ['one'] });

    if (typeof created === 'string') throw new Error(created);

    const run = async (argv: string[]) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const code = await designShot({ target, argv: [...argv, '--product', 'acme'], invocation: 'et design' });
      const text = error.mock.calls.flat().join('\n').split('\n')[0];

      error.mockRestore();

      return { code, text };
    };

    expect(await run(['foundations/palette', '--states', '--in', 'pages/home'])).toEqual({
      code: 2,
      text: '--in needs --variants',
    });
    expect(await run(['foundations/palette', '--variants', '--in', 'pages/home'])).toEqual({
      code: 1,
      text: 'design-explore: --in pages/home: pages/home does not embed foundations/palette (not imported, directly or through another part, and not a tokens part of product "acme")',
    });
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
    const rows = rowsOf({
      part: 'pages/a',
      variants: ['one', 'two'],
      merged: false,
      rejected: { two: { by: 'designer', decidedAt: '2026-11-03T10:00:00.000Z' } },
    });

    expect(rows.map((row) => row.label)).toEqual(['one', 'two rejected']);
    expect(rows[1]?.sketch).toEqual({ target: 'pages/a', variant: 'two' });
  });

  it('labels a variant the agent withdrew as withdrawn by agent, with its reason, not as rejected', () => {
    const withdrawn = {
      by: 'agent',
      decidedAt: '2026-11-03T10:00:00.000Z',
      status: 'withdrawn',
      withdrawnBy: 'm',
    } as const;
    const rows = rowsOf({
      part: 'pages/a',
      variants: ['one', 'two'],
      merged: false,
      rejected: { one: withdrawn, two: { ...withdrawn, reason: 'same as a' } },
    });

    expect(rows.map((row) => row.label)).toEqual(['one withdrawn by agent', 'two withdrawn by agent: same as a']);
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

  it('crops a state the merged part does not draw against the first merged state', async () => {
    const rest = png(200, 100, 'a');
    const variant = [png(200, 100, 'c'), png(200, 100, 'd')];
    const plan = [
      [
        { label: 'rest', address: address('rest', null) },
        { label: 'hover', address: address('hover', null), absent: true as const },
      ],
      [
        { label: 'i rest', address: address('rest', 'i') },
        { label: 'i hover', address: address('hover', 'i') },
      ],
    ];
    const sheet = [
      [
        { label: 'rest', png: rest },
        { label: 'hover', note: NEW_STATE_NOTE },
      ],
      (plan[1] ?? []).map((cell, index) => ({ label: cell.label, png: variant[index] as Buffer })),
    ];
    const boxOf = vi.fn(async (before: Buffer, after: Buffer) =>
      before === rest && after === variant[0]
        ? [{ x: 40, y: 20, width: 10, height: 10 }]
        : before === rest && after === variant[1]
          ? [{ x: 40, y: 20, width: 120, height: 60 }]
          : [],
    );

    expect(await changedCropsIn({ plan, sheet, mergedIndex: 0, boxOf, scale: 1 })).toEqual([
      { x: 24, y: 4, width: 152, height: 92 },
    ]);
  });

  it('gives no crop when no variant changes a pixel', async () => {
    const one = png(10, 10, 'a');
    const plan = [[{ label: 'rest', address: address('rest', null) }], [{ label: 'i', address: address('rest', 'i') }]];
    const sheet = plan.map((row) => row.map((cell) => ({ label: cell.label, png: one })));

    expect(await changedCropsIn({ plan, sheet, mergedIndex: 0, boxOf: async () => [], scale: 1 })).toEqual([]);
  });
});
