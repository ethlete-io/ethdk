import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { checkSystem } from './check-system';
import {
  completenessGapLineOf,
  completenessGapsOf,
  completenessOf,
  controlStateGapsOf,
  FoundControl,
  isInteractionState,
  SeenFrame,
  smallChangeHintsOf,
} from './complete';
import { designComplete } from './complete-command';
import { approveException } from './exceptions';
import { readHandoff, recordHandoff } from './handoff';
import { writeInventoryApproval } from './inventory-approval';
import { ResolvedProduct, resolveProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
import { createSketch } from './sketch/sketch';
import { createSystemModules } from './system-modules';
import { recordMerged } from './sketch/merged-parts';

const STYLES = [
  '.aa-toggle, .aa-still { display: block; border: 1px solid; background: white; }',
  ':root { --aa-fade: 120ms; }',
  '.aa-toggle { transition: background-color var(--aa-fade), color var(--aa-fade); }',
  '.aa-toggle:hover, .aa-still:hover { background: black; color: white; }',
  '.aa-toggle:focus-visible, .aa-still:focus-visible { outline: 2px solid black; }',
  '.aa-toggle:active, .aa-still:active { background: gray; }',
  '.aa-card { padding: 4px; } .aa-card:hover { background: black; }',
  '.aa-row { display: block; background: white; color: black; }',
  '.aa-row[aria-current="true"], .aa-row[aria-selected="true"] { background: navy; color: white; }',
  '.aa-row:hover { background: silver; } .aa-row:focus-visible { outline: 2px solid black; }',
  '.aa-row[aria-current="true"]:hover { background: blue; }',
  '.aa-row.aa-active { background: teal; }',
  '.aa-frame { display: block; background: white; transition: background-color var(--aa-fade); }',
  '.aa-frame:hover { background: black; } .aa-frame:active { background: gray; }',
  '.aa-trigger[aria-disabled="true"] { color: gray; }',
].join(' ');

const field = (attributes: string, marker: string, trigger = '') =>
  `<div data-et-control="field"${attributes}><span class="aa-frame"${marker}><button class="aa-trigger" type="button"${marker}${trigger}>Field</button></span></div>`;

const fieldStates = (marker: string) => ({
  rest: `<div>${field('', marker)}</div>`,
  hovered: `<div>${field(' data-et-force="hover"', marker)}</div>`,
  pressed: `<div>${field(' data-et-force="active"', marker)}</div>`,
  off: `<div>${field('', marker, ' aria-disabled="true"')}</div>`,
});

const FIELD =
  "controls: { field: { kind: 'button', input: ['pointer'], disabled: true } }, grid: { columns: ['rest', 'hover', 'active'], rows: { rest: { rest: 'rest', hover: 'hovered', active: 'pressed' } } },";

const row = (attributes = '', name = 'aa-row') =>
  `<button class="${name}" type="button" data-et-control="row"${attributes}>Row</button>`;

const pick = '<button class="aa-toggle" type="button" data-et-control="pick">Pick</button>';

const option = (attributes = '', name = 'aa-row') => `<li class="${name}" role="option"${attributes}>Option</li>`;

const OPTIONS = `<ul data-et-surface="pick.open">${option(' aria-selected="true"')}${option()}${option(' data-et-force="hover"')}${option(' data-et-force="focus-visible" tabindex="0"')}</ul>`;

const named = (name: string) =>
  `<div><button class="aa-toggle" type="button" data-et-control="pick" aria-activedescendant="aa-b">Pick</button><ul data-et-surface="pick.open">${option(' aria-selected="true"')}${option(' id="aa-b"', name)}${option()}${option(' data-et-force="hover"')}</ul></div>`;

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
  'components/field': { states: fieldStates(' data-et-control-part'), extra: FIELD },
  'components/field-unmarked': { states: fieldStates(''), extra: FIELD },
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
  'components/rows': {
    states: {
      rest: `<div>${row(' aria-current="true"')}${row()}</div>`,
      'selected-hovered': `<div>${row(' aria-current="true" data-et-force="hover"')}</div>`,
    },
    extra: "controls: { row: { kind: 'row', input: [] } },",
  },
  'components/rows-flat': {
    states: {
      rest: `<div>${row(' aria-current="true"', 'aa-toggle')}${row('', 'aa-toggle')}</div>`,
      'selected-hovered': `<div>${row(' aria-current="true" data-et-force="hover"', 'aa-plain')}</div>`,
    },
    extra: "controls: { row: { kind: 'row', input: [] } },",
  },
  'components/picker': {
    states: { rest: `<div>${pick}</div>`, open: `<div>${pick}${OPTIONS}</div>` },
    extra: "controls: { pick: { kind: 'select', input: [], surfaces: { open: 'open' } } },",
  },
  'components/picker-named': {
    states: { rest: `<div>${pick}</div>`, open: named('aa-row aa-active') },
    extra: "controls: { pick: { kind: 'select', input: [], surfaces: { open: 'open' } } },",
  },
  'components/picker-named-plain': {
    states: { rest: `<div>${pick}</div>`, open: named('aa-row') },
    extra: "controls: { pick: { kind: 'select', input: [], surfaces: { open: 'open' } } },",
  },
  'components/picker-keyboard': {
    states: {
      rest: `<div>${pick}</div>`,
      open: `<div>${pick}<ul data-et-surface="pick.open">${option(' aria-selected="true"')}${option(' data-active-source="keyboard"', 'aa-row aa-active')}${option()}${option(' data-et-force="hover"')}</ul></div>`,
    },
    extra: "controls: { pick: { kind: 'select', input: [], surfaces: { open: 'open' } } },",
  },
  'components/picker-closed': {
    states: {
      rest: `<div>${pick}</div>`,
      open: `<div>${pick}<ul data-et-surface="pick.open" hidden>${option()}</ul></div>`,
    },
    extra: "controls: { pick: { kind: 'select', input: [], surfaces: { open: 'open' } } },",
  },
  'components/picker-control-option': {
    states: {
      rest: `<div>${pick}</div>`,
      open: `<div>${pick}<ul data-et-surface="pick.open">${option(' data-et-control="row" data-et-force="hover"')}</ul></div>`,
    },
    extra: "controls: { pick: { kind: 'select', input: [], surfaces: { open: 'open' } } },",
  },
  'components/plain': { states: { rest: '<div><p>Only text</p></div>' } },
  'elements/legacy': { states: { rest: '<p>Legacy</p>', hover: '<p>Hover</p>' } },
  'elements/card': {
    states: {
      rest: '<div style="width: 360px; height: 240px; border: 1px solid"><p>Card</p></div>',
      badge: '<div style="width: 360px; height: 240px; border: 1px solid"><p>Card <b>3</b></p></div>',
      filled: '<div style="width: 360px; height: 240px; border: 1px solid; background: black"><p>Card</p></div>',
    },
  },
  'components/undeclared': { states: { rest: '<div><button type="button">Go</button></div>' } },
  'components/focus-containers': {
    states: {
      rest: '<div><div role="menu" tabindex="-1"><button type="button" role="menuitem">Copy</button></div><ul role="listbox" tabindex="0" aria-activedescendant="aa-one"><li role="option" id="aa-one">One</li></ul></div>',
    },
  },
  'components/focusable-box': { states: { rest: '<div><div tabindex="-1">Box</div></div>' } },
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

const approve = (options: { product: ResolvedProduct; part: string; ids: string[]; hash?: string }) =>
  writeInventoryApproval({
    productDir: options.product.dir,
    part: options.part,
    approval: {
      ids: options.ids,
      hash: options.hash ?? partHashOf({ product: options.product, dir: join(options.product.dir, options.part) }),
      by: 'claude-opus-5-5',
      at: '2026-10-30T00:00:00.000Z',
    },
  });

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

describe('controlStateGapsOf', () => {
  it('reads an interaction from any word of a state name', () => {
    expect(
      ['hover', 'row-hover', 'collapseFocus', 'focus-visible', 'pressed', 'tab_active', 'selected', 'open'].filter(
        isInteractionState,
      ),
    ).toEqual(['hover', 'row-hover', 'collapseFocus', 'focus-visible', 'pressed', 'tab_active', 'selected']);
    expect(['inactive', 'unfocusable', 'hovercard', 'rest'].filter(isInteractionState)).toEqual([]);
  });

  it('names the element to extract for each interaction state of a part that is no control part', () => {
    const states = ['open', 'row-hover', 'row-selected', 'collapse-focus-visible', 'hover'];

    expect(
      controlStateGapsOf({ part: 'elements/shell', controls: undefined, states }).map(completenessGapLineOf),
    ).toEqual([
      'CONTROL-STATE elements/shell - states row-hover, row-selected draw an interaction (hover, focus, pressed, active or selected), which only a control part draws, and elements/shell declares no control of a kind disclosure, button, select, menu, row, field, tooltip - extract the row as its own control part and draw these states there',
      'CONTROL-STATE elements/shell - state collapse-focus-visible draws an interaction (hover, focus, pressed, active or selected), which only a control part draws, and elements/shell declares no control of a kind disclosure, button, select, menu, row, field, tooltip - extract the collapse as its own control part and draw this state there',
      'CONTROL-STATE elements/shell - state hover draws an interaction (hover, focus, pressed, active or selected), which only a control part draws, and elements/shell declares no control of a kind disclosure, button, select, menu, row, field, tooltip - extract the control as its own control part and draw this state there',
    ]);
  });

  it('allows interaction states on a part that declares a control of a checked kind, never on a page', () => {
    const states = ['rest', 'rest-hover', 'selected'];

    expect(controlStateGapsOf({ part: 'components/row', controls: { row: { kind: 'row' } }, states })).toEqual([]);
    expect(
      controlStateGapsOf({ part: 'components/odd', controls: { odd: { kind: 'slider' } }, states }).map(
        (gap) => gap.code,
      ),
    ).toEqual(['CONTROL-STATE', 'CONTROL-STATE']);
    expect(
      controlStateGapsOf({
        part: 'pages/home',
        controls: { more: { kind: 'disclosure', part: 'components/disclosure' } },
        states,
      }).map((gap) => gap.detail.split(' - ')[0]?.endsWith('a page is no control part')),
    ).toEqual([true, true]);
  });

  it('does not block completeness for an interaction state', () => {
    expect(
      completenessGapsOf({
        part: 'elements/card',
        controls: undefined,
        states: ['rest', 'hover'],
        frames: [],
        reviewed: true,
      }).map((gap) => gap.code),
    ).toEqual([]);
  });
});

describe('smallChangeHintsOf', () => {
  it('hints a state that changes under a tenth of the frame of a part that is no control part', () => {
    const changes = [
      { state: 'badge', base: 'rest', share: 0.02 },
      { state: 'same', base: 'rest', share: 0 },
      { state: 'expanded', base: 'rest', share: 0.4 },
      { state: 'row-hover', base: 'rest', share: 0.01 },
    ];

    expect(smallChangeHintsOf({ part: 'elements/card', controls: undefined, changes })).toEqual([
      'HINT elements/card badge - changes 2.0 % of the frame against rest - extract the changed element as its own part',
    ]);
    expect(smallChangeHintsOf({ part: 'components/row', controls: { row: { kind: 'row' } }, changes })).toEqual([]);
    expect(smallChangeHintsOf({ part: 'pages/home', controls: undefined, changes })).toEqual([]);
  });
});

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
        tip: { kind: 'slider' },
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
      'REQUIREMENT-MISSING pages/a.more.hover - no state draws it hover - draw a state that forces hover on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too',
      'REQUIREMENT-MISSING pages/a.more.active - no state draws it active - draw a state that forces active on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too',
      'REQUIREMENT-MISSING pages/a.more.focus-visible - no state draws it focus-visible - draw a state that forces focus-visible on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too',
    ]);
    expect(gapsOf(used, { 'components/toggle': [] })).toEqual([]);
    expect(gapsOf(used, { 'components/toggle': [{ code: 'X', target: 'components/toggle', detail: '' }] })).toEqual([
      'CONTROL-PART-INCOMPLETE pages/a.more - components/toggle is not design complete: 1 gap(s) - run design complete components/toggle',
    ]);
    expect(gapsOf(used, { 'components/toggle': 'product "app-a" has no part "components/toggle"' })).toEqual([
      'CONTROL-PART-INCOMPLETE pages/a.more - components/toggle: product "app-a" has no part "components/toggle"',
    ]);
  });

  it('requires active of a button, and a disabled look only when the control declares disabled', () => {
    const forced = (interaction: string, differs = true) => ({ interaction, differs });
    const frames = [
      frame('rest', { controls: [{ id: 'go', forced: [], look: 'a' }] }),
      frame('focused', { controls: [{ id: 'go', forced: [forced('focus-visible')], look: 'b' }] }),
      frame('off', { controls: [{ id: 'go', forced: [], disabled: true, look: 'a' }] }),
    ];
    const gapsOf = (controls: unknown, seen = frames) =>
      completenessGapsOf({
        part: 'components/a',
        controls,
        states: ['rest', 'focused', 'off'],
        frames: seen,
        reviewed: true,
      })
        .filter((gap) => gap.code === 'REQUIREMENT-MISSING')
        .map(completenessGapLineOf);

    expect(gapsOf({ go: { kind: 'button', input: ['keyboard'] } })).toEqual([
      'REQUIREMENT-MISSING components/a.go.active - no state draws it active - draw a state that forces active on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too',
    ]);
    expect(gapsOf({ go: { kind: 'button', input: ['keyboard'], disabled: true } })).toEqual([
      'REQUIREMENT-MISSING components/a.go.active - no state draws it active - draw a state that forces active on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too',
      'REQUIREMENT-MISSING components/a.go.disabled - it looks the same disabled as without - give the disabled look its own colours',
    ]);
    expect(
      gapsOf({ go: { kind: 'button', input: [], disabled: true } }, [
        frame('rest', { controls: [{ id: 'go', forced: [forced('active')], look: 'a' }] }),
        frame('on', { controls: [{ id: 'go', forced: [], look: 'a' }] }),
        frame('off', { controls: [{ id: 'go', forced: [], disabled: true, look: 'c' }] }),
      ]),
    ).toEqual([]);
    expect(
      gapsOf({ go: { kind: 'button', input: [], disabled: true } }, [
        frame('rest', { controls: [{ id: 'go', forced: [forced('active')], look: 'a' }] }),
      ]),
    ).toEqual([
      'REQUIREMENT-MISSING components/a.go.disabled - no state draws it disabled - mark it with disabled or aria-disabled="true" on it or a data-et-control-part in it in a state',
    ]);
  });

  it('checks a field with hover and focus-visible but no active', () => {
    const forced = (interaction: string) => ({ interaction, differs: true });
    const gapsOf = (controls: unknown, seen: SeenFrame[]) =>
      completenessGapsOf({
        part: 'components/a',
        controls,
        states: ['rest', 'hovered', 'focused'],
        frames: seen,
        reviewed: true,
      })
        .filter((gap) => gap.code === 'REQUIREMENT-MISSING' || gap.code === 'CONTROL-KIND')
        .map(completenessGapLineOf);
    const rest = frame('rest', { controls: [{ id: 'f', forced: [], look: 'a' }] });
    const hovered = frame('hovered', { controls: [{ id: 'f', forced: [forced('hover')], look: 'b' }] });
    const focused = frame('focused', { controls: [{ id: 'f', forced: [forced('focus-visible')], look: 'c' }] });
    const field = { f: { kind: 'field', input: ['pointer', 'keyboard'] } };

    expect(gapsOf(field, [rest, hovered, focused])).toEqual([]);
    expect(gapsOf(field, [rest, focused]).join()).toContain('components/a.f.hover');
  });

  it('requires a selected look and a selected hover of a row', () => {
    const gapsOf = (frames: SeenFrame[]) =>
      completenessGapsOf({
        part: 'components/a',
        controls: { more: { kind: 'row', input: [] } },
        states: ['rest', 'picked'],
        frames,
        reviewed: true,
      }).map(completenessGapLineOf);

    expect(
      gapsOf([
        frame('rest', {
          controls: [
            { id: 'more', forced: [], selected: true, look: 'navy' },
            { id: 'more', forced: [], look: 'white' },
          ],
        }),
        frame('picked', {
          controls: [{ id: 'more', forced: [{ interaction: 'hover', differs: true }], selected: true, look: 'x' }],
        }),
      ]),
    ).toEqual([]);
    expect(gapsOf([frame('rest')])).toEqual([
      'REQUIREMENT-MISSING components/a.more.selected - no state draws it selected - mark it with aria-selected="true", aria-checked="true", aria-pressed="true" or aria-current in a state',
      'REQUIREMENT-MISSING components/a.more.selected-hover - no state draws it selected hover - force hover on it, e.g. with forceInteraction',
    ]);
    expect(gapsOf([frame('rest', { controls: [{ id: 'more', forced: [], selected: true, look: 'navy' }] })])).toEqual([
      'REQUIREMENT-MISSING components/a.more.selected - every state draws it selected - draw it without selected too, to compare',
      'REQUIREMENT-MISSING components/a.more.selected-hover - no state draws it selected hover - force hover on it, e.g. with forceInteraction',
    ]);
  });

  it('counts a row marked data-active-source="keyboard" as its focus-visible look', () => {
    const gapsOf = (frames: SeenFrame[]) =>
      completenessGapsOf({
        part: 'components/a',
        controls: { more: { kind: 'row', input: ['keyboard'] } },
        states: ['rest', 'picked'],
        frames,
        reviewed: true,
      })
        .map(completenessGapLineOf)
        .filter((line) => line.includes('.focus-visible'));
    const rows = (keyboardLook: string) => [
      frame('rest', {
        controls: [
          { id: 'more', forced: [], selected: true, look: 'navy' },
          { id: 'more', forced: [], look: 'white' },
          { id: 'more', forced: [], keyboard: true, look: keyboardLook },
        ],
      }),
    ];

    expect(gapsOf(rows('teal'))).toEqual([]);
    expect(gapsOf(rows('white'))).toEqual([
      'REQUIREMENT-MISSING components/a.more.focus-visible - it looks the same with data-active-source="keyboard" as plain - give the active look its own colours',
    ]);
    expect(gapsOf([frame('rest', { controls: [{ id: 'more', forced: [], look: 'white' }] })])).toEqual([
      'REQUIREMENT-MISSING components/a.more.focus-visible - no state draws it focus-visible - draw a state that forces focus-visible on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too; no state marks it data-active-source="keyboard" either',
    ]);
  });

  it('requires the open surface of a select or menu with its option states, and takes the options from its part', () => {
    const shown = (options: SeenFrame['surfaces'][number]['options']) => [{ id: 'more.open', shown: true, options }];
    const full = [
      frame('rest'),
      frame('open', {
        surfaces: shown([
          { selected: true, look: 'navy', forced: [] },
          { selected: false, look: 'white', forced: [] },
          { selected: false, look: 'x', forced: [{ interaction: 'hover', differs: true }] },
          { selected: false, look: 'y', forced: [{ interaction: 'focus-visible', differs: true }] },
        ]),
      }),
    ];
    const gapsOf = (control: unknown, frames: SeenFrame[], part = 'components/a') =>
      completenessGapsOf({
        part,
        controls: { more: control },
        states: ['rest', 'open'],
        frames,
        reviewed: true,
        referenced: { 'components/select': [] },
      }).map(completenessGapLineOf);
    const select = { kind: 'select', input: [], surfaces: { open: 'open' } };

    expect(gapsOf(select, full)).toEqual([]);
    expect(gapsOf({ ...select, kind: 'menu' }, full)).toEqual([]);
    expect(
      gapsOf(select, [frame('rest'), frame('open', { surfaces: shown([{ selected: false, look: 'a', forced: [] }]) })]),
    ).toEqual([
      'REQUIREMENT-MISSING components/a.more.option-hover - no state draws an option in more.open hover - force hover on it, e.g. with forceInteraction',
      'REQUIREMENT-MISSING components/a.more.option-focus-visible - no state draws an option in more.open focus-visible - force focus-visible on it, e.g. with forceInteraction; no option is marked active by aria-activedescendant or data-active-source="keyboard" either',
      'REQUIREMENT-MISSING components/a.more.option-selected - no state draws an option in more.open selected - mark it with aria-selected="true", aria-checked="true", aria-pressed="true" or aria-current in a state',
    ]);

    const activeOf = (look: string, plain = true) => [
      frame('rest'),
      frame('open', {
        surfaces: shown([
          { selected: true, look: 'navy', forced: [] },
          ...(plain ? [{ selected: false, look: 'white', forced: [] }] : []),
          { selected: false, look, forced: [], named: true },
          { selected: false, look: 'x', forced: [{ interaction: 'hover', differs: true }] },
        ]),
      }),
    ];

    expect(gapsOf(select, activeOf('teal'))).toEqual([]);

    const keyboardOf = (look: string) => [
      frame('rest'),
      frame('open', {
        surfaces: shown([
          { selected: true, look: 'navy', forced: [] },
          { selected: false, look: 'white', forced: [] },
          { selected: false, look, forced: [], keyboard: true },
          { selected: false, look: 'x', forced: [{ interaction: 'hover', differs: true }] },
        ]),
      }),
    ];

    expect(gapsOf({ ...select, kind: 'menu' }, keyboardOf('teal'))).toEqual([]);
    expect(gapsOf(select, keyboardOf('white'))).toEqual([
      'REQUIREMENT-MISSING components/a.more.option-focus-visible - state open marks an option active by aria-activedescendant or data-active-source="keyboard", but it looks the same as a plain option - give the active option its own look',
    ]);
    expect(gapsOf(select, activeOf('white'))).toEqual([
      'REQUIREMENT-MISSING components/a.more.option-focus-visible - state open marks an option active by aria-activedescendant or data-active-source="keyboard", but it looks the same as a plain option - give the active option its own look',
    ]);
    expect(gapsOf(select, activeOf('teal', false))).toEqual([
      'REQUIREMENT-MISSING components/a.more.option-focus-visible - state open marks an option active by aria-activedescendant or data-active-source="keyboard", but draws no plain option (not selected, active or forced) to compare it with',
      'REQUIREMENT-MISSING components/a.more.option-selected - every state draws an option in more.open selected - draw it without selected too, to compare',
    ]);

    const closed = [frame('rest'), frame('open', { surfaces: [{ id: 'more.open', shown: false, options: [] }] })];

    expect(
      gapsOf({ kind: 'select', part: 'components/select', surfaces: { open: 'open' } }, closed, 'pages/a'),
    ).toEqual([
      'REQUIREMENT-MISSING pages/a.more.open - state open draws no visible, non-empty data-et-surface="more.open" next to data-et-control="more"',
    ]);
    expect(
      gapsOf(
        { kind: 'select', part: 'components/select', surfaces: { open: 'open' } },
        [frame('rest'), frame('open', { surfaces: shown([]) })],
        'pages/a',
      ),
    ).toEqual([]);
  });

  it('requires the visible tooltip of a tooltip control in its host', () => {
    const gapsOf = (frames: SeenFrame[]) =>
      completenessGapsOf({
        part: 'pages/a',
        controls: { more: { kind: 'tooltip', part: 'components/tip', surfaces: { tooltip: 'tip' } } },
        states: ['rest', 'tip'],
        frames,
        reviewed: true,
        referenced: { 'components/tip': [] },
      }).map(completenessGapLineOf);

    expect(gapsOf([frame('rest'), frame('tip', { surfaces: [{ id: 'more.tooltip', shown: true }] })])).toEqual([]);
    expect(gapsOf([frame('rest'), frame('tip')])).toEqual([
      'REQUIREMENT-MISSING pages/a.more.tooltip - state tip draws no visible, non-empty data-et-surface="more.tooltip" next to data-et-control="more"',
    ]);
  });
});

describe('completenessOf', () => {
  it('lists a merged interaction state as a non-blocking open point', async (context) => {
    const { target, config, product } = checkout();
    const result = await completenessOf({ target, config, product, part: 'elements/legacy' });

    if ('unavailable' in result) return context.skip(result.unavailable);
    if ('problem' in result) throw new Error(result.problem);

    expect(result.gaps).toEqual([]);
    expect(result.hints).toEqual([expect.stringMatching(/^CONTROL-STATE elements\/legacy - state hover /)]);
  }, 120_000);

  it('hints a state that changes a small share of the frame, without failing the part', async (context) => {
    const { target, config, product } = checkout();
    const card = await completenessOf({ target, config, product, part: 'elements/card' });

    if ('unavailable' in card) return context.skip(card.unavailable);
    if ('problem' in card) throw new Error(card.problem);

    expect(card.gaps).toEqual([]);
    expect(card.hints).toEqual([
      expect.stringMatching(
        /^HINT elements\/card badge - changes \d\.\d % of the frame against rest - extract the changed element as its own part$/,
      ),
    ]);
  }, 120_000);

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
      'REQUIREMENT-MISSING pages/merge.more.hover - no state draws it hover - draw a state that forces hover on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too',
      'REQUIREMENT-MISSING pages/merge.more.active - no state draws it active - draw a state that forces active on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too',
      'REQUIREMENT-MISSING pages/merge.more.focus-visible - no state draws it focus-visible - draw a state that forces focus-visible on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too',
      'REQUIREMENT-MISSING pages/merge.more.body - state open draws no visible, non-empty data-et-surface="more.body" next to data-et-control="more"',
      'INVENTORY-UNAPPROVED pages/merge - its control inventory is not approved - check and approve it in Studio',
    ]);

    expect(await completenessOf({ target, config, product, part: 'components/done' })).toEqual({ gaps: [] });

    const flat = await completenessOf({ target, config, product, part: 'components/flat' });

    expect('gaps' in flat && flat.gaps.map(completenessGapLineOf)).toEqual([
      'CONTROL-GRID-MISSING components/flat.more - the part has no grid - draw its states with interactionRows, which gives the grid a column per interaction (hover, active)',
      'REQUIREMENT-MISSING components/flat.more.hover - state hovered forces hover on it, but its box draws no different pixel than at rest - if a descendant draws hover, mark it with data-et-control-part',
      'REQUIREMENT-MISSING components/flat.more.active - no state draws it active - draw a state that forces active on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too',
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

    approve({ product, part: 'pages/uses', ids: ['more'] });
    expect(await completenessOf({ target, config, product, part: 'pages/uses' })).toEqual({ gaps: [] });

    const usesFlat = await completenessOf({ target, config, product, part: 'pages/uses-flat' });

    expect('gaps' in usesFlat && usesFlat.gaps.map(completenessGapLineOf)).toEqual([
      'CONTROL-PART-INCOMPLETE pages/uses-flat.more - components/flat is not design complete: 4 gap(s) - run design complete components/flat',
      'INVENTORY-UNAPPROVED pages/uses-flat - its control inventory is not approved - check and approve it in Studio',
    ]);

    expect(await completenessOf({ target, config, product, part: 'components/rows' })).toEqual({ gaps: [] });

    const rowsFlat = await completenessOf({ target, config, product, part: 'components/rows-flat' });

    expect('gaps' in rowsFlat && rowsFlat.gaps.map(completenessGapLineOf)).toEqual([
      'REQUIREMENT-MISSING components/rows-flat.row.selected - it looks the same selected as without - give the selected look its own colours',
      'REQUIREMENT-MISSING components/rows-flat.row.selected-hover - state selected-hovered forces hover on it selected, but its box draws no different pixel than at rest',
    ]);

    expect(await completenessOf({ target, config, product, part: 'components/picker' })).toEqual({ gaps: [] });

    expect(await completenessOf({ target, config, product, part: 'components/picker-named' })).toEqual({ gaps: [] });

    expect(await completenessOf({ target, config, product, part: 'components/picker-keyboard' })).toEqual({ gaps: [] });

    const namedPlain = await completenessOf({ target, config, product, part: 'components/picker-named-plain' });

    expect('gaps' in namedPlain && namedPlain.gaps.map(completenessGapLineOf)).toEqual([
      'REQUIREMENT-MISSING components/picker-named-plain.pick.option-focus-visible - state open marks an option active by aria-activedescendant or data-active-source="keyboard", but it looks the same as a plain option - give the active option its own look',
    ]);

    const closed = await completenessOf({ target, config, product, part: 'components/picker-closed' });

    expect('gaps' in closed && closed.gaps.map((gap) => `${gap.code} ${gap.target}`)).toEqual([
      'REQUIREMENT-MISSING components/picker-closed.pick.open',
      'REQUIREMENT-MISSING components/picker-closed.pick.option-hover',
      'REQUIREMENT-MISSING components/picker-closed.pick.option-focus-visible',
      'REQUIREMENT-MISSING components/picker-closed.pick.option-selected',
    ]);

    const bare = await completenessOf({ target, config, product, part: 'components/bare' });

    expect('gaps' in bare && bare.gaps.map((gap) => gap.code)).toEqual(['CONTROL-UNKNOWN']);
  }, 120_000);

  it('reads the review of a base part from the merged.json of its base', async (context) => {
    const { target } = checkout();
    const design = join(target, DESIGN_DIR);
    const products = {
      'app-a': { presets: { desktop: { width: 400, height: 300 } } },
      'app-b': { base: `${DESIGN_DIR}/app-a` },
    };

    mkdirSync(join(design, 'app-b'), { recursive: true });
    writeFileSync(join(design, 'config.json'), JSON.stringify({ products }));

    const config = readConfig(target) ?? {};
    const product = resolveProduct({ target, name: 'app-b', config: config.products?.['app-b'] ?? {} });
    const done = await completenessOf({ target, config, product, part: 'components/done' });

    if ('unavailable' in done) return context.skip(done.unavailable);

    expect(done).toEqual({ gaps: [] });
  }, 60_000);

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
    expect(await lines('components/focus-containers')).toEqual([
      'CONTROL-UNDECLARED components/focus-containers - button at div > div > button in rest - mark it with data-et-control and declare it in controls',
      'CONTROL-UNDECLARED components/focus-containers - li[role="option"] at div > ul > li in rest - mark it with data-et-control and declare it in controls',
    ]);
    expect(await lines('components/focusable-box')).toEqual([
      'CONTROL-UNDECLARED components/focusable-box - div[tabindex] at div > div in rest - mark it with data-et-control and declare it in controls',
    ]);
    expect(await lines('components/pointer')).toEqual([
      'CONTROL-UNCLASSIFIED components/pointer - div with cursor: pointer at div > div in rest - draw it as a native control or give it an interactive role and declare it, or drop the pointer cursor and :hover style',
      'CONTROL-UNCLASSIFIED components/pointer - div.aa-card with :hover rule at div > div.aa-card in rest - draw it as a native control or give it an interactive role and declare it, or drop the pointer cursor and :hover style',
    ]);
    expect(await lines('pages/inner')).toEqual([
      'CONTROL-UNDECLARED pages/inner - button at main > button in rest - mark it with data-et-control and declare it in controls',
      'INVENTORY-UNAPPROVED pages/inner - its control inventory is not approved - check and approve it in Studio',
    ]);
    approve({ product, part: 'pages/host', ids: [] });
    expect(await lines('pages/host')).toEqual([]);
  }, 120_000);

  it('gives a control inside an embedded part root to that part, and fails a page that restyles it', async (context) => {
    const { target, config, product } = checkout();
    const lines = async (part: string) => {
      const result = await completenessOf({ target, config, product, part });

      return 'gaps' in result ? result.gaps.map(completenessGapLineOf) : result;
    };
    approve({ product, part: 'pages/owns', ids: [] });

    const owns = await lines('pages/owns');

    if (!Array.isArray(owns)) return context.skip(JSON.stringify(owns));

    expect(owns).toEqual([]);
    expect(await lines('pages/slotted')).toEqual([
      'CONTROL-UNDECLARED pages/slotted - button at div.aa-slot > section > button.aa-own in rest - mark it with data-et-control and declare it in controls',
      'CONTROL-PART-INCOMPLETE pages/slotted - elements/slot draws 1 control(s) here and is not design complete: 1 gap(s) - run design complete elements/slot',
      'INVENTORY-UNAPPROVED pages/slotted - its control inventory is not approved - check and approve it in Studio',
    ]);
    expect(await lines('pages/recolours')).toEqual([
      'CONTROL-OVERRIDDEN pages/recolours - ".aa-page > div" sets padding on main.aa-page > div, drawn by components/done, in rest - change components/done instead, or mark the control with data-et-control and declare it in controls',
      'CONTROL-OVERRIDDEN pages/recolours - ":is(.aa-page) .aa-toggle:hover" sets color on main.aa-page > div > button.aa-toggle, drawn by components/done, in rest - change components/done instead, or mark the control with data-et-control and declare it in controls',
      'INVENTORY-UNAPPROVED pages/recolours - its control inventory is not approved - check and approve it in Studio',
    ]);
  }, 120_000);

  it('reopens the inventory approval of a page on an added or removed control id or a part change', async (context) => {
    const { target, config, product } = checkout();
    const lines = async () => {
      const result = await completenessOf({ target, config, product, part: 'pages/uses' });

      return 'gaps' in result ? result.gaps.map(completenessGapLineOf) : result;
    };

    approve({ product, part: 'pages/uses', ids: [] });

    const added = await lines();

    if (!Array.isArray(added)) return context.skip(JSON.stringify(added));

    expect(added).toEqual([
      'INVENTORY-UNAPPROVED pages/uses - its approved control inventory reopened: added more - check and approve it in Studio',
    ]);

    approve({ product, part: 'pages/uses', ids: ['gone', 'more'] });
    expect(await lines()).toEqual([
      'INVENTORY-UNAPPROVED pages/uses - its approved control inventory reopened: removed gone - check and approve it in Studio',
    ]);

    approve({ product, part: 'pages/uses', ids: ['more'], hash: 'before' });
    expect(await lines()).toEqual([
      'INVENTORY-UNAPPROVED pages/uses - its approved control inventory reopened: the part changed - check and approve it in Studio',
    ]);
  }, 120_000);

  it('forces the interactions of a control on its data-et-control-part descendants and reads their disabled marks', async (context) => {
    const { target, config, product } = checkout();
    const marked = await completenessOf({ target, config, product, part: 'components/field' });

    if ('unavailable' in marked) return context.skip(marked.unavailable);

    expect(marked).toEqual({ gaps: [] });

    const unmarked = await completenessOf({ target, config, product, part: 'components/field-unmarked' });

    expect('gaps' in unmarked && unmarked.gaps.map(completenessGapLineOf)).toEqual([
      'REQUIREMENT-MISSING components/field-unmarked.field.hover - state hovered forces hover on it, but its box draws no different pixel than at rest - if a descendant draws hover, mark it with data-et-control-part',
      'REQUIREMENT-MISSING components/field-unmarked.field.active - state pressed forces active on it, but its box draws no different pixel than at rest - if a descendant draws active, mark it with data-et-control-part',
      'REQUIREMENT-MISSING components/field-unmarked.field.disabled - no state draws it disabled - mark it with disabled or aria-disabled="true" on it or a data-et-control-part in it in a state',
    ]);
  }, 60_000);

  it('forces an option that is also a control in its open surface', async (context) => {
    const { target, config, product } = checkout();
    const checked = await completenessOf({ target, config, product, part: 'components/picker-control-option' });

    if ('unavailable' in checked) return context.skip(checked.unavailable);

    expect('gaps' in checked && checked.gaps.map(completenessGapLineOf)).toEqual([
      'CONTROL-UNKNOWN components/picker-control-option.row - data-et-control="row" is not in controls',
      'REQUIREMENT-MISSING components/picker-control-option.pick.option-focus-visible - no state draws an option in pick.open focus-visible - force focus-visible on it, e.g. with forceInteraction; no option is marked active by aria-activedescendant or data-active-source="keyboard" either',
      'REQUIREMENT-MISSING components/picker-control-option.pick.option-selected - no state draws an option in pick.open selected - mark it with aria-selected="true", aria-checked="true", aria-pressed="true" or aria-current in a state',
    ]);
  }, 60_000);

  it('passes a full-width toggle at the top-left corner of its frame, which the headless pointer must not hover', async (context) => {
    const { target, config, product } = checkout();
    const corner = await completenessOf({ target, config, product, part: 'components/corner' });

    if ('unavailable' in corner) return context.skip(corner.unavailable);

    expect(corner).toEqual({ gaps: [] });
  }, 60_000);

  it('fails on a pending exception, drops the gap of an approved one, and reopens it on a part change', async (context) => {
    const { target, config, product } = checkout();
    const logs: string[] = [];
    const flat = async () => {
      const result = await completenessOf({ target, config, product, part: 'components/flat' });

      return 'gaps' in result ? { gaps: result.gaps.map((gap) => gap.target), exceptions: result.exceptions } : result;
    };

    vi.spyOn(console, 'log').mockImplementation((line: string) => logs.push(line));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const request = ['--request', 'components/flat.more.active', '--reason', 'pressing only opens it', '--product'];

    expect(await designComplete({ target, argv: [...request, 'app-a'], invocation: 'et design' })).toBe(0);
    expect(
      await designComplete({ target, argv: ['--request', 'components/flat.more', '--reason', 'x'], invocation: 'et' }),
    ).toBe(1);

    const requested = await completenessOf({ target, config, product, part: 'components/flat' });

    if ('unavailable' in requested) return context.skip(requested.unavailable);

    expect(
      'gaps' in requested && requested.gaps.find((gap) => gap.target === 'components/flat.more.active')?.detail,
    ).toBe(
      'no state draws it active - draw a state that forces active on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too - its exception is pending - approve it in Studio ("pressing only opens it")',
    );
    expect(approveException({ product, key: 'components/flat.more.hover', by: 'Tom' })).toEqual({
      status: 404,
      error: 'no exception "components/flat.more.hover" was requested',
    });
    expect(approveException({ product, key: 'components/flat.more.active', by: ' ' })).toMatchObject({ status: 400 });

    approveException({ product, key: 'components/flat.more.active', by: 'Tom', at: '2026-10-30T00:00:00.000Z' });

    const approved = await flat();

    expect('gaps' in approved && approved.gaps).not.toContain('components/flat.more.active');
    expect('exceptions' in approved && approved.exceptions?.map(({ key, state }) => `${key} ${state}`)).toEqual([
      'components/flat.more.active approved',
    ]);

    writeFileSync(join(product.dir, 'components', 'flat', 'flat.css'), '.aa-flat { color: black; }');

    const reopened = await flat();

    expect('gaps' in reopened && reopened.gaps).toContain('components/flat.more.active');
    expect('exceptions' in reopened && reopened.exceptions?.map(({ state }) => state)).toEqual(['reopened']);
  }, 120_000);

  it('checks the open sketch variant of a part with --variant, as unmerged but not unreviewed', async (context) => {
    const { target, config, product } = checkout();
    const logs: string[] = [];
    const errors: string[] = [];

    vi.spyOn(console, 'log').mockImplementation((line: string) => logs.push(line));
    vi.spyOn(console, 'error').mockImplementation((line: string) => errors.push(line));
    createSketch({ product, sketch: { layer: 'components', name: 'flat' }, variants: ['a'] });

    const sketch = { target: 'components/flat', variant: 'a' };
    const file = createSystemModules({ target, config }).partOf({
      product: 'app-a',
      part: 'components/flat',
      sketch,
    })?.file;

    writeFileSync(file ?? '', readFileSync(join(product.dir, 'components', 'done', 'done.ts'), 'utf8'));

    const variant = await completenessOf({ target, config, product, part: 'components/flat', sketch });

    if ('unavailable' in variant) return context.skip(variant.unavailable);

    expect(variant).toEqual({ gaps: [] });
    expect(await designComplete({ target, argv: ['components/flat', '--variant', 'a'], invocation: 'et design' })).toBe(
      0,
    );
    expect(logs.at(-1)).toBe('variant a of components/flat in app-a is design complete');
    expect(await designComplete({ target, argv: ['components/flat', '--variant', 'z'], invocation: 'et design' })).toBe(
      1,
    );
    expect(errors.at(-1)).toBe(
      'variant "z" of the sketch on components/flat in product "app-a" has no part "components/flat"',
    );
    expect(await designComplete({ target, argv: ['components/flat'], invocation: 'et design' })).toBe(1);
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
    expect(errors.at(-1)).toBe('pages/merge in app-a is not design complete: 6 gap(s)');
    expect(
      await designComplete({ target, argv: ['components/done', '--product', 'app-a'], invocation: 'et design' }),
    ).toBe(0);
    expect(await designComplete({ target, argv: [], invocation: 'et design' })).toBe(2);
  }, 120_000);

  it('gives only a complete part the handoff status, and fails the handoff re-check when one regresses', async (context) => {
    const { target, product } = checkout();
    const logs: string[] = [];
    const errors: string[] = [];
    const complete = (...argv: string[]) => designComplete({ target, argv, invocation: 'et design' });

    vi.spyOn(console, 'log').mockImplementation((line: string) => logs.push(line));
    vi.spyOn(console, 'error').mockImplementation((line: string) => errors.push(line));

    const done = await complete('components/done', '--handoff');

    if (errors.some((line) => line.startsWith('design complete needs a browser'))) return context.skip(errors[0]);

    expect(done).toBe(0);
    expect(logs.at(-1)).toBe('components/done in app-a is design complete and has the handoff status');
    expect(await complete('pages/merge', '--handoff')).toBe(1);
    expect(Object.keys(readHandoff(product.dir))).toEqual(['components/done']);
    expect(await complete('--handoff')).toBe(0);
    expect(logs.slice(-2)).toEqual([
      'HANDOFF components/done complete',
      '1 handoff part(s) in app-a are design complete',
    ]);

    recordHandoff({ productDir: product.dir, part: 'pages/merge' });

    expect(await complete('--handoff')).toBe(1);
    expect(errors.slice(-2)).toEqual([
      'HANDOFF pages/merge regressed - 6 gap(s)',
      '1 of 2 handoff part(s) in app-a are no longer design complete',
    ]);
    expect(await complete('components/done', '--handoff', '--variant', 'a')).toBe(2);
  }, 120_000);
});
