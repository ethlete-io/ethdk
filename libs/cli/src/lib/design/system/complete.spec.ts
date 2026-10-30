import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { checkSystem } from './check-system';
import { completenessGapLineOf, completenessGapsOf, completenessOf, FoundControl, SeenFrame } from './complete';
import { designComplete } from './complete-command';
import { resolveProduct } from './resolve-product';
import { recordMerged } from './sketch/merged-parts';

const STYLES = [
  '.aa-toggle, .aa-still { display: block; border: 1px solid; background: white; }',
  ':root { --aa-fade: 120ms; }',
  '.aa-toggle { transition: background-color var(--aa-fade), color var(--aa-fade); }',
  '.aa-toggle:hover, .aa-still:hover { background: black; color: white; }',
  '.aa-toggle:focus-visible, .aa-still:focus-visible { outline: 2px solid black; }',
  '.aa-toggle:active, .aa-still:active { background: gray; }',
  '.aa-card { padding: 4px; } .aa-card:hover { background: black; }',
].join(' ');

const toggle = (attributes = '', name = 'aa-toggle') =>
  `<button class="${name}" type="button" data-et-control="more"${attributes}><span>More</span></button>`;

const CORNER = ' style="position: fixed; top: 0; left: 0; width: 100%"';

const body = '<div data-et-surface="more.body">The rest</div>';

const DISCLOSURE =
  "controls: { more: { kind: 'disclosure', input: ['pointer', 'keyboard'], surfaces: { body: 'open' } } },";

const GRID =
  "grid: { columns: ['rest', 'hover', 'active', 'focus-visible'], rows: { rest: { rest: 'rest', hover: 'hovered', active: 'pressed', 'focus-visible': 'focused' }, open: { rest: 'open', hover: 'open-hovered', active: 'open-pressed', 'focus-visible': 'open-focused' } } },";

const openRow = (attributes = '') => ({
  'open-hovered': `<div>${toggle(`${attributes} data-et-force="hover"`)}${body}</div>`,
  'open-pressed': `<div>${toggle(`${attributes} data-et-force="active"`)}${body}</div>`,
  'open-focused': `<div>${toggle(`${attributes} data-et-force="focus-visible"`)}${body}</div>`,
});

type FixturePart = {
  states: Record<string, string>;
  extra?: string;
  embed?: string;
  imports?: string;
  render?: string;
  css?: string;
};

const PARTS: Record<string, FixturePart> = {
  'pages/merge': {
    states: { open: `<main>${toggle()}</main>` },
    extra: DISCLOSURE,
  },
  'components/done': {
    states: {
      rest: `<div>${toggle()}</div>`,
      hovered: `<div>${toggle(' data-et-force="hover"')}</div>`,
      focused: `<div>${toggle(' data-et-force="focus-visible"')}</div>`,
      pressed: `<div>${toggle(' data-et-force="active"')}</div>`,
      open: `<div>${toggle()}${body}</div>`,
      ...openRow(),
    },
    extra: `${DISCLOSURE} ${GRID}`,
  },
  'components/still': {
    states: {
      rest: `<div>${toggle('', 'aa-still')}</div>`,
      hovered: `<div>${toggle(' data-et-force="hover"', 'aa-still')}</div>`,
      focused: `<div>${toggle(' data-et-force="focus-visible"', 'aa-still')}</div>`,
      pressed: `<div>${toggle(' data-et-force="active"', 'aa-still')}</div>`,
      open: `<div>${toggle('', 'aa-still')}${body}</div>`,
      'open-hovered': `<div>${toggle(' data-et-force="hover"', 'aa-still')}${body}</div>`,
      'open-pressed': `<div>${toggle(' data-et-force="active"', 'aa-still')}${body}</div>`,
      'open-focused': `<div>${toggle(' data-et-force="focus-visible"', 'aa-still')}${body}</div>`,
    },
    extra: `${DISCLOSURE} ${GRID}`,
  },
  'components/flat-done': {
    states: {
      rest: `<div>${toggle()}</div>`,
      hovered: `<div>${toggle(' data-et-force="hover"')}</div>`,
      focused: `<div>${toggle(' data-et-force="focus-visible"')}</div>`,
      pressed: `<div>${toggle(' data-et-force="active"')}</div>`,
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
  'components/corner': {
    states: {
      hovered: `<div>${toggle(`${CORNER} data-et-force="hover"`)}</div>`,
      rest: `<div>${toggle(CORNER)}</div>`,
      focused: `<div>${toggle(`${CORNER} data-et-force="focus-visible"`)}</div>`,
      pressed: `<div>${toggle(`${CORNER} data-et-force="active"`)}</div>`,
      open: `<div>${toggle(CORNER)}${body}</div>`,
      ...openRow(CORNER),
    },
    extra: `${DISCLOSURE} ${GRID}`,
  },
  'components/bare': { states: { rest: `<div>${toggle()}</div>` } },
  'components/plain': { states: { rest: '<div><p>Only text</p></div>' } },
  'components/undeclared': { states: { rest: '<div><button type="button">Go</button></div>' } },
  'components/pointer': {
    states: { rest: '<div><div style="cursor: pointer"><span>Go</span></div><div class="aa-card">Card</div></div>' },
  },
  'pages/inner': { states: { rest: '<main><button type="button">Inner</button></main>' } },
  'pages/host': { states: { rest: '' }, embed: 'pages/inner' },
  'pages/uses': {
    states: { rest: `<main>${toggle()}</main>`, open: `<main>${toggle()}${body}</main>` },
    extra: "controls: { more: { kind: 'disclosure', part: 'components/done', surfaces: { body: 'open' } } },",
  },
  'pages/uses-flat': {
    states: { rest: `<main>${toggle()}</main>`, open: `<main>${toggle()}${body}</main>` },
    extra: "controls: { more: { kind: 'disclosure', part: 'components/flat', surfaces: { body: 'open' } } },",
  },
  'elements/slot': {
    states: { rest: '' },
    render:
      '`<div class="aa-slot"><button type="button" class="aa-menu">Menu</button><section>${BODIES[state] ?? state}</section></div>`',
  },
  'pages/slotted': {
    states: { rest: '' },
    imports: "import slot from '@system/elements/slot';",
    render: '(await slot.render({ state: \'<button type="button" class="aa-own">Own</button>\' })).body',
  },
  'pages/owns': {
    states: { rest: '' },
    imports: "import done from '@system/components/done';",
    render: '`<main class="aa-page">${(await done.render({ state: \'rest\' })).body}</main>`',
    css: '.aa-page > div { margin: 4px; width: 200px; position: relative; }',
  },
  'pages/recolours': {
    states: { rest: '' },
    imports: "import done from '@system/components/done';",
    render: '`<main class="aa-page">${(await done.render({ state: \'rest\' })).body}</main>`',
    css: '.aa-page { & .aa-toggle:hover { color: red; } } .aa-page > div { padding: 2px; }',
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

  for (const [key, { states, extra = '', embed, imports = '', render, css }] of Object.entries(PARTS)) {
    const [layer = '', name = ''] = key.split('/');
    const dir = join(design, 'app-a', layer, name);

    const body =
      render ??
      (embed ? `embedPage('${embed}', { state: 'rest', width: 400, height: 300 }).body` : "BODIES[state] ?? ''");

    mkdirSync(dir, { recursive: true });
    if (css) writeFileSync(join(dir, `${name}.css`), css);
    writeFileSync(
      join(dir, `${name}.ts`),
      `import { definePart, drawing, embedPage } from '@design-system';
${imports}
${css ? `import css from './${name}.css?inline';` : 'const css = "";'}

const BODIES: Record<string, string> = ${JSON.stringify(states)};

export default definePart({
  note: 'A fixture.',
  states: { ${Object.keys(states)
    .map((state) => `'${state}': { state: '${state}' }`)
    .join(', ')} },
  ${extra}
  render: async ({ state }: { state: string }) => drawing({ body: ${body}, styles: ${JSON.stringify(STYLES)} + css }),
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

const STATES = ['rest', 'hovered', 'pressed', 'focused', 'open', 'open-hovered', 'open-pressed', 'open-focused'];

const ROWS = {
  rest: { rest: 'rest', hover: 'hovered', active: 'pressed', 'focus-visible': 'focused' },
  open: { rest: 'open', hover: 'open-hovered', active: 'open-pressed', 'focus-visible': 'open-focused' },
};

const COLUMNS = ['rest', 'hover', 'active', 'focus-visible'];

describe('completenessGapsOf', () => {
  it('passes a part without controls that draws none, and fails each undeclared control it draws once', () => {
    const button: FoundControl = { kind: 'control', what: 'button', path: 'div > button', marked: null, within: [] };
    const gapsOf = (found: FoundControl[], controls?: unknown) =>
      completenessGapsOf({
        part: 'components/a',
        controls,
        states: ['rest', 'open'],
        frames: [
          frame('rest', { controls: [], found }),
          frame('open', { controls: [], found }),
          frame('rest', { interaction: 'hover', controls: [], found: [{ ...button, path: 'hover > only' }] }),
        ],
        reviewed: true,
      }).map(completenessGapLineOf);

    expect(gapsOf([])).toEqual([]);
    expect(gapsOf([button, button])).toEqual([
      'CONTROL-UNDECLARED components/a - button at div > button in rest, open (2 of them) - mark it with data-et-control and declare it in controls',
    ]);
    expect(gapsOf([{ ...button, marked: 'more' }], {})).toEqual([]);
    expect(
      gapsOf([{ ...button, within: ['more'] }], {
        more: { kind: 'disclosure', part: 'components/b', surfaces: {} },
      }).filter((line) => line.startsWith('CONTROL-UNDECLARED')),
    ).toEqual([]);
    expect(
      gapsOf([{ kind: 'unclassified', what: 'div with cursor: pointer', path: 'div > div', marked: null, within: [] }]),
    ).toEqual([
      'CONTROL-UNCLASSIFIED components/a - div with cursor: pointer at div > div in rest, open - draw it as a native control or give it an interactive role and declare it, or drop the pointer cursor and :hover style',
    ]);
  });

  it('passes a disclosure drawn hovered, pressed, focused, collapsed and open in a reviewed part', () => {
    const frames = [
      frame('rest'),
      frame('hovered', { controls: [{ id: 'more', forced: [{ interaction: 'hover', differs: true }] }] }),
      frame('pressed', { controls: [{ id: 'more', forced: [{ interaction: 'active', differs: true }] }] }),
      frame('focused', { controls: [{ id: 'more', forced: [{ interaction: 'focus-visible', differs: true }] }] }),
      frame('open', { surfaces: [{ id: 'more.body', shown: true }] }),
    ];

    expect(
      completenessGapsOf({
        part: 'components/a',
        controls: DECLARED,
        states: STATES,
        frames,
        reviewed: true,
        grid: { columns: COLUMNS, rows: ROWS },
      }),
    ).toEqual([]);
    expect(
      completenessGapsOf({
        part: 'components/a',
        controls: DECLARED,
        states: STATES,
        frames,
        reviewed: false,
        grid: { columns: COLUMNS, rows: ROWS },
      }).map((gap) => gap.code),
    ).toEqual(['PART-UNREVIEWED']);
  });

  it('fails a control whose interactions are flat states, a grid without their columns, or a row without them', () => {
    const frames = [
      frame('rest'),
      frame('hovered', { controls: [{ id: 'more', forced: [{ interaction: 'hover', differs: true }] }] }),
      frame('pressed', { controls: [{ id: 'more', forced: [{ interaction: 'active', differs: true }] }] }),
      frame('focused', { controls: [{ id: 'more', forced: [{ interaction: 'focus-visible', differs: true }] }] }),
      frame('open', { surfaces: [{ id: 'more.body', shown: true }] }),
    ];
    const gapsOf = (grid: unknown) =>
      completenessGapsOf({
        part: 'components/a',
        controls: DECLARED,
        states: STATES,
        frames,
        reviewed: true,
        grid,
      }).map(completenessGapLineOf);

    expect(gapsOf(undefined)).toEqual([
      'CONTROL-GRID-MISSING components/a.more - the part has no grid - draw its states with interactionRows, which gives the grid a column per interaction (hover, active, focus-visible)',
    ]);
    expect(gapsOf({ columns: ['rest', 'hover'], rows: ROWS })).toEqual([
      'CONTROL-GRID-MISSING components/a.more - its grid has no column active, focus-visible - draw its states with interactionRows, which gives the grid a column per interaction (hover, active, focus-visible)',
    ]);
    expect(gapsOf({ columns: COLUMNS, rows: { rest: ROWS.rest, open: { rest: 'open', hover: 'gone' } } })).toEqual([
      'CONTROL-GRID-MISSING components/a.more - its grid draws no state in open hover, open active, open focus-visible - draw its states with interactionRows, which gives the grid a column per interaction (hover, active, focus-visible)',
    ]);
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
      'CONTROL-GRID-MISSING components/a.more',
      'REQUIREMENT-MISSING components/a.more.hover',
      'REQUIREMENT-MISSING components/a.more.active',
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
      'REQUIREMENT-MISSING pages/a.more.active - no state draws it active - draw a state that forces active on the data-et-control element, e.g. with forceInteraction',
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
      'REQUIREMENT-MISSING pages/merge.more.active - no state draws it active - draw a state that forces active on the data-et-control element, e.g. with forceInteraction',
      'REQUIREMENT-MISSING pages/merge.more.focus-visible - no state draws it focus-visible - draw a state that forces focus-visible on the data-et-control element, e.g. with forceInteraction',
      'REQUIREMENT-MISSING pages/merge.more.body - state open draws no visible, non-empty data-et-surface="more.body" next to data-et-control="more"',
    ]);

    expect(await completenessOf({ target, config, product, part: 'components/done' })).toEqual({ gaps: [] });

    const flat = await completenessOf({ target, config, product, part: 'components/flat' });

    expect('gaps' in flat && flat.gaps.map(completenessGapLineOf)).toEqual([
      'CONTROL-GRID-MISSING components/flat.more - the part has no grid - draw its states with interactionRows, which gives the grid a column per interaction (hover, active)',
      'REQUIREMENT-MISSING components/flat.more.hover - state hovered forces hover on it, but its box draws no different pixel than at rest',
      'REQUIREMENT-MISSING components/flat.more.active - no state draws it active - draw a state that forces active on the data-et-control element, e.g. with forceInteraction',
      'REQUIREMENT-MISSING components/flat.more.body - state open draws no visible, non-empty data-et-surface="more.body" next to data-et-control="more"',
    ]);

    const flatDone = await completenessOf({ target, config, product, part: 'components/flat-done' });

    expect('gaps' in flatDone && flatDone.gaps.map(completenessGapLineOf)).toEqual([
      'CONTROL-GRID-MISSING components/flat-done.more - the part has no grid - draw its states with interactionRows, which gives the grid a column per interaction (hover, active, focus-visible)',
    ]);

    const still = await completenessOf({ target, config, product, part: 'components/still' });

    expect('gaps' in still && still.gaps.map(completenessGapLineOf)).toEqual([
      "CONTROL-TRANSITION-MISSING components/still.more.hover - state hovered changes background-color, color of button.aa-still in one frame - give them a transition with the product's motion tokens",
      "CONTROL-TRANSITION-MISSING components/still.more.active - state pressed changes background-color of button.aa-still in one frame - give them a transition with the product's motion tokens",
    ]);

    expect(await completenessOf({ target, config, product, part: 'components/clipped' })).toEqual({ gaps: [] });

    const alwaysOpen = await completenessOf({ target, config, product, part: 'components/always-open' });

    expect('gaps' in alwaysOpen && alwaysOpen.gaps.map(completenessGapLineOf)).toEqual([
      'REQUIREMENT-MISSING components/always-open.more.collapsed - every state that draws it also shows its body - draw a state with more.body closed',
    ]);

    expect(await completenessOf({ target, config, product, part: 'pages/uses' })).toEqual({ gaps: [] });

    const usesFlat = await completenessOf({ target, config, product, part: 'pages/uses-flat' });

    expect('gaps' in usesFlat && usesFlat.gaps.map(completenessGapLineOf)).toEqual([
      'CONTROL-PART-INCOMPLETE pages/uses-flat.more - components/flat is not design complete: 4 gap(s) - run design complete components/flat',
    ]);

    const bare = await completenessOf({ target, config, product, part: 'components/bare' });

    expect('gaps' in bare && bare.gaps.map((gap) => gap.code)).toEqual(['CONTROL-UNKNOWN']);
  }, 120_000);

  it('discovers undeclared and unclassified controls, but not the controls of an embedded page', async (context) => {
    const { target, config, product } = checkout();
    const lines = async (part: string) => {
      const result = await completenessOf({ target, config, product, part });

      return 'gaps' in result ? result.gaps.map(completenessGapLineOf) : result;
    };
    const plain = await completenessOf({ target, config, product, part: 'components/plain' });

    if ('unavailable' in plain) return context.skip(plain.unavailable);

    expect(plain).toEqual({ gaps: [] });
    expect(await lines('components/undeclared')).toEqual([
      'CONTROL-UNDECLARED components/undeclared - button at div > button in rest - mark it with data-et-control and declare it in controls',
    ]);
    expect(await lines('components/pointer')).toEqual([
      'CONTROL-UNCLASSIFIED components/pointer - div with cursor: pointer at div > div in rest - draw it as a native control or give it an interactive role and declare it, or drop the pointer cursor and :hover style',
      'CONTROL-UNCLASSIFIED components/pointer - div.aa-card with :hover rule at div > div.aa-card in rest - draw it as a native control or give it an interactive role and declare it, or drop the pointer cursor and :hover style',
    ]);
    expect(await lines('pages/inner')).toEqual([
      'CONTROL-UNDECLARED pages/inner - button at main > button in rest - mark it with data-et-control and declare it in controls',
    ]);
    expect(await lines('pages/host')).toEqual([]);
  }, 120_000);

  it('gives a control inside an embedded part root to that part, and fails a page that restyles it', async (context) => {
    const { target, config, product } = checkout();
    const lines = async (part: string) => {
      const result = await completenessOf({ target, config, product, part });

      return 'gaps' in result ? result.gaps.map(completenessGapLineOf) : result;
    };
    const owns = await lines('pages/owns');

    if (!Array.isArray(owns)) return context.skip(JSON.stringify(owns));

    expect(owns).toEqual([]);
    expect(await lines('pages/slotted')).toEqual([
      'CONTROL-UNDECLARED pages/slotted - button at div.aa-slot > section > button.aa-own in rest - mark it with data-et-control and declare it in controls',
      'CONTROL-PART-INCOMPLETE pages/slotted - elements/slot draws 1 control(s) here and is not design complete: 1 gap(s) - run design complete elements/slot',
    ]);
    expect(await lines('pages/recolours')).toEqual([
      'CONTROL-OVERRIDDEN pages/recolours - ".aa-page > div" sets padding on main.aa-page > div, drawn by components/done, in rest - change components/done instead, or mark the control with data-et-control and declare it in controls',
      'CONTROL-OVERRIDDEN pages/recolours - ":is(.aa-page) .aa-toggle:hover" sets color on main.aa-page > div > button.aa-toggle, drawn by components/done, in rest - change components/done instead, or mark the control with data-et-control and declare it in controls',
    ]);
  }, 120_000);

  it('passes a full-width toggle at the top-left corner of its frame, which the headless pointer must not hover', async (context) => {
    const { target, config, product } = checkout();
    const corner = await completenessOf({ target, config, product, part: 'components/corner' });

    if ('unavailable' in corner) return context.skip(corner.unavailable);

    expect(corner).toEqual({ gaps: [] });
  }, 60_000);

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
    expect(errors.at(-1)).toBe('pages/merge in app-a is not design complete: 5 gap(s)');
    expect(
      await designComplete({ target, argv: ['components/done', '--product', 'app-a'], invocation: 'et design' }),
    ).toBe(0);
    expect(await designComplete({ target, argv: [], invocation: 'et design' })).toBe(2);
  }, 120_000);
});
