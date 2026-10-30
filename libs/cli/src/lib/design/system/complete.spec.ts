import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { checkSystem } from './check-system';
import { completenessGapLineOf, completenessGapsOf, completenessOf, SeenFrame } from './complete';
import { designComplete } from './complete-command';
import { resolveProduct } from './resolve-product';
import { recordMerged } from './sketch/merged-parts';

const STYLES =
  '.aa-toggle { display: block; border: 0; background: white; } .aa-toggle:hover { background: black; color: white; } .aa-toggle:focus-visible { outline: 2px solid black; }';

const toggle = (attributes = '') =>
  `<button class="aa-toggle" type="button" data-et-control="more"${attributes}>More</button>`;

const body = '<div data-et-surface="more.body">The rest</div>';

const DISCLOSURE =
  "controls: { more: { kind: 'disclosure', input: ['pointer', 'keyboard'], surfaces: { body: 'open' } } },";

const PARTS: Record<string, { states: Record<string, string>; extra?: string }> = {
  'pages/merge': {
    states: { open: `<main>${toggle()}</main>` },
    extra: DISCLOSURE,
  },
  'components/done': {
    states: {
      rest: `<div>${toggle()}</div>`,
      hovered: `<div>${toggle(' data-et-force="hover"')}</div>`,
      focused: `<div>${toggle(' data-et-force="focus-visible"')}</div>`,
      open: `<div>${toggle()}${body}</div>`,
    },
    extra: DISCLOSURE,
  },
  'components/flat': {
    states: {
      rest: '<div><span data-et-control="more">More</span></div>',
      hovered: '<div><span data-et-control="more" data-et-force="hover">More</span></div>',
      open: '<div><span data-et-control="more">More</span><div data-et-surface="more.body" hidden>The rest</div></div>',
    },
    extra: "controls: { more: { kind: 'disclosure', input: ['pointer'], surfaces: { body: 'open' } } },",
  },
  'components/clipped': {
    states: {
      rest: `<div>${toggle()}<div style="height: 0; overflow: hidden">${body}</div></div>`,
      open: `<div>${toggle()}${body}</div>`,
    },
    extra: "controls: { more: { kind: 'disclosure', input: [], surfaces: { body: 'open' } } },",
  },
  'components/always-open': {
    states: { rest: `<div>${toggle()}${body}</div>`, open: `<div>${toggle()}${body}</div>` },
    extra: "controls: { more: { kind: 'disclosure', input: [], surfaces: { body: 'open' } } },",
  },
  'components/bare': { states: { rest: `<div>${toggle()}</div>` } },
  'pages/uses': {
    states: { rest: `<main>${toggle()}</main>`, open: `<main>${toggle()}${body}</main>` },
    extra: "controls: { more: { kind: 'disclosure', part: 'components/done', surfaces: { body: 'open' } } },",
  },
  'pages/uses-flat': {
    states: { rest: `<main>${toggle()}</main>`, open: `<main>${toggle()}${body}</main>` },
    extra: "controls: { more: { kind: 'disclosure', part: 'components/flat', surfaces: { body: 'open' } } },",
  },
};

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-complete-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(design, { recursive: true });
  writeFileSync(
    join(design, 'config.json'),
    JSON.stringify({ products: { 'app-a': { presets: { desktop: { width: 400, height: 300 } } } } }),
  );

  for (const [key, { states, extra = '' }] of Object.entries(PARTS)) {
    const [layer = '', name = ''] = key.split('/');
    const dir = join(design, 'app-a', layer, name);

    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${name}.ts`),
      `import { definePart, drawing } from '@design-system';

const BODIES: Record<string, string> = ${JSON.stringify(states)};

export default definePart({
  note: 'A fixture.',
  states: { ${Object.keys(states)
    .map((state) => `'${state}': { state: '${state}' }`)
    .join(', ')} },
  ${extra}
  render: ({ state }: { state: string }) => drawing({ body: BODIES[state] ?? '', styles: ${JSON.stringify(STYLES)} }),
});
`,
    );
  }

  const config = readConfig(target) ?? {};
  const product = resolveProduct({ target, name: 'app-a', config: config.products?.['app-a'] ?? {} });

  recordMerged({ product, parts: Object.keys(PARTS) });

  return { target, config, product };
};

const cwd = process.cwd();

afterEach(() => {
  process.chdir(cwd);
  vi.restoreAllMocks();
});

const frame = (state: string, seen: Partial<SeenFrame> = {}): SeenFrame => ({
  state,
  interaction: null,
  controls: [{ id: 'more', forced: [] }],
  surfaces: [],
  ...seen,
});

const DECLARED = { more: { kind: 'disclosure', input: ['pointer', 'keyboard'], surfaces: { body: 'open' } } };

describe('completenessGapsOf', () => {
  it('fails a part that declares no controls', () => {
    expect(
      completenessGapsOf({
        part: 'components/a',
        controls: undefined,
        states: ['rest'],
        frames: [],
        reviewed: true,
      }).map((gap) => gap.code),
    ).toEqual(['CONTROLS-MISSING']);
  });

  it('passes a disclosure drawn hovered, focused, collapsed and open in a reviewed part', () => {
    const frames = [
      frame('rest'),
      frame('hovered', { controls: [{ id: 'more', forced: [{ interaction: 'hover', differs: true }] }] }),
      frame('focused', { controls: [{ id: 'more', forced: [{ interaction: 'focus-visible', differs: true }] }] }),
      frame('open', { surfaces: [{ id: 'more.body', shown: true }] }),
    ];

    expect(
      completenessGapsOf({
        part: 'components/a',
        controls: DECLARED,
        states: ['rest', 'open'],
        frames,
        reviewed: true,
      }),
    ).toEqual([]);
    expect(
      completenessGapsOf({
        part: 'components/a',
        controls: DECLARED,
        states: ['rest', 'open'],
        frames,
        reviewed: false,
      }).map((gap) => gap.code),
    ).toEqual(['PART-UNREVIEWED']);
  });

  it('fails a stale declaration, an undrawn control and an unknown marker', () => {
    const gaps = completenessGapsOf({
      part: 'components/a',
      controls: {
        ...DECLARED,
        gone: { kind: 'disclosure', input: [], surfaces: { body: 'open' } },
        tip: { kind: 'tooltip' },
      },
      states: ['rest'],
      frames: [
        frame('rest', {
          controls: [
            { id: 'more', forced: [] },
            { id: 'stray', forced: [] },
          ],
          surfaces: [{ id: 'more.menu', shown: true }],
        }),
      ],
      reviewed: true,
    });

    expect(gaps.map(completenessGapLineOf)).toContain(
      'REQUIREMENT-MISSING components/a.more.body - surfaces.body names state open, which the part does not declare',
    );
    expect(gaps.map((gap) => `${gap.code} ${gap.target}`)).toEqual([
      'CONTROL-UNKNOWN components/a.stray',
      'CONTROL-UNKNOWN components/a.more',
      'REQUIREMENT-MISSING components/a.more.hover',
      'REQUIREMENT-MISSING components/a.more.focus-visible',
      'REQUIREMENT-MISSING components/a.more.body',
      'CONTROL-UNDRAWN components/a.gone',
      'CONTROL-KIND components/a.tip',
    ]);
  });

  it('fails a page control that names no part, and takes the interactions from the part it names', () => {
    const frames = [frame('rest'), frame('open', { surfaces: [{ id: 'more.body', shown: true }] })];
    const used = { more: { kind: 'disclosure', part: 'components/toggle', surfaces: { body: 'open' } } };
    const gapsOf = (controls: unknown, referenced = {}) =>
      completenessGapsOf({
        part: 'pages/a',
        controls,
        states: ['rest', 'open'],
        frames,
        reviewed: true,
        referenced,
      }).map(completenessGapLineOf);

    expect(gapsOf(DECLARED)).toEqual([
      "CONTROL-PART-MISSING pages/a.more - a page draws no interactions of its controls - name the part that draws them, e.g. part: 'components/disclosure'",
      'REQUIREMENT-MISSING pages/a.more.hover - no state draws it hover - draw a state that forces hover on the data-et-control element, e.g. with forceInteraction',
      'REQUIREMENT-MISSING pages/a.more.focus-visible - no state draws it focus-visible - draw a state that forces focus-visible on the data-et-control element, e.g. with forceInteraction',
    ]);
    expect(gapsOf(used, { 'components/toggle': [] })).toEqual([]);
    expect(gapsOf(used, { 'components/toggle': [{ code: 'X', target: 'components/toggle', detail: '' }] })).toEqual([
      'CONTROL-PART-INCOMPLETE pages/a.more - components/toggle is not design complete: 1 gap(s) - run design complete components/toggle',
    ]);
    expect(gapsOf(used, { 'components/toggle': 'product "app-a" has no part "components/toggle"' })).toEqual([
      'CONTROL-PART-INCOMPLETE pages/a.more - components/toggle: product "app-a" has no part "components/toggle"',
    ]);
  });
});

describe('completenessOf', () => {
  it('fails the merge accordion that is only drawn open without its body, and passes a fully drawn one', async (context) => {
    const { target, config, product } = checkout();

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(checkSystem({ target, config, products: ['app-a'] })).toBe(0);

    const merge = await completenessOf({ target, config, product, part: 'pages/merge' });

    if ('unavailable' in merge) return context.skip(merge.unavailable);
    if ('problem' in merge) throw new Error(merge.problem);

    expect(merge.gaps.map(completenessGapLineOf)).toEqual([
      "CONTROL-PART-MISSING pages/merge.more - a page draws no interactions of its controls - name the part that draws them, e.g. part: 'components/disclosure'",
      'REQUIREMENT-MISSING pages/merge.more.hover - no state draws it hover - draw a state that forces hover on the data-et-control element, e.g. with forceInteraction',
      'REQUIREMENT-MISSING pages/merge.more.focus-visible - no state draws it focus-visible - draw a state that forces focus-visible on the data-et-control element, e.g. with forceInteraction',
      'REQUIREMENT-MISSING pages/merge.more.body - state open draws no visible, non-empty data-et-surface="more.body" next to data-et-control="more"',
    ]);

    expect(await completenessOf({ target, config, product, part: 'components/done' })).toEqual({ gaps: [] });

    const flat = await completenessOf({ target, config, product, part: 'components/flat' });

    expect('gaps' in flat && flat.gaps.map(completenessGapLineOf)).toEqual([
      'REQUIREMENT-MISSING components/flat.more.hover - state hovered forces hover on it, but its box draws no different pixel than at rest',
      'REQUIREMENT-MISSING components/flat.more.body - state open draws no visible, non-empty data-et-surface="more.body" next to data-et-control="more"',
    ]);

    expect(await completenessOf({ target, config, product, part: 'components/clipped' })).toEqual({ gaps: [] });

    const alwaysOpen = await completenessOf({ target, config, product, part: 'components/always-open' });

    expect('gaps' in alwaysOpen && alwaysOpen.gaps.map(completenessGapLineOf)).toEqual([
      'REQUIREMENT-MISSING components/always-open.more.collapsed - every state that draws it also shows its body - draw a state with more.body closed',
    ]);

    expect(await completenessOf({ target, config, product, part: 'pages/uses' })).toEqual({ gaps: [] });

    const usesFlat = await completenessOf({ target, config, product, part: 'pages/uses-flat' });

    expect('gaps' in usesFlat && usesFlat.gaps.map(completenessGapLineOf)).toEqual([
      'CONTROL-PART-INCOMPLETE pages/uses-flat.more - components/flat is not design complete: 2 gap(s) - run design complete components/flat',
    ]);

    const bare = await completenessOf({ target, config, product, part: 'components/bare' });

    expect('gaps' in bare && bare.gaps.map((gap) => gap.code)).toEqual(['CONTROLS-MISSING']);
  }, 120_000);

  it('exits 1 with one line per gap from the command', async (context) => {
    const { target, config, product } = checkout();
    const errors: string[] = [];

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation((line: string) => errors.push(line));
    expect(checkSystem({ target, config, products: ['app-a'] })).toBe(0);

    const probe = await completenessOf({ target, config, product, part: 'components/bare' });

    if ('unavailable' in probe) return context.skip(probe.unavailable);

    errors.length = 0;

    expect(await designComplete({ target, argv: ['pages/merge', '--product', 'app-a'], invocation: 'et design' })).toBe(
      1,
    );
    expect(errors.at(-1)).toBe('pages/merge in app-a is not design complete: 4 gap(s)');
    expect(
      await designComplete({ target, argv: ['components/done', '--product', 'app-a'], invocation: 'et design' }),
    ).toBe(0);
    expect(await designComplete({ target, argv: [], invocation: 'et design' })).toBe(2);
  }, 120_000);
});
