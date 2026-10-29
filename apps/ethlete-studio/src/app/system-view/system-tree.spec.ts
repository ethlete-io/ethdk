import { ListedCall, ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import { placeableFramesOf } from '../components/design-canvas/canvas-frame';
import {
  usingPagesOf,
  callFramesOf,
  canPick,
  holdersOf,
  isGroupOpen,
  isSectionOpen,
  framesOf,
  isSmallPart,
  pickedVariantOf,
  mergePreviewOf,
  PENDING_LABEL,
  sketchMatrixOf,
  openRoundsOf,
  sketchRoundsOf,
  stateRowKeyOf,
  treeOf,
} from './system-tree';
import { CompareRow, mergeOutlinesOf, unchangedLinesOf } from './merge-preview';

const part = (overrides: Partial<ListedPart> = {}): ListedPart => ({
  layer: 'components',
  name: 'button',
  origin: 'product',
  note: null,
  states: ['default', 'disabled'],
  problems: [],
  ...overrides,
});

const product = (parts: ListedPart[] = []): ListedProduct => ({
  name: 'acme',
  base: null,
  presets: { phone: { width: 390, height: 844 }, desktop: { width: 1280 } },
  parts,
  problems: [],
});

describe('treeOf', () => {
  it('groups parts by layer in design order and hides empty groups', () => {
    const tree = treeOf([
      part({ layer: 'pages', name: 'home' }),
      part({ name: 'button' }),
      part({ layer: 'foundations', name: 'palette' }),
      part({ name: 'card' }),
    ]);

    expect(tree.map((group) => [group.label, group.entries.map((entry) => entry.key)])).toEqual([
      ['Foundations', ['foundations/palette']],
      ['Components', ['components/button', 'components/card']],
      ['Pages', ['pages/home']],
    ]);
  });

  it('lists a page that uses a wireframe kit part under Wireframes, with its kit-part count', () => {
    const tree = treeOf([
      part({ layer: 'pages', name: 'home', kitUses: 0 }),
      part({ layer: 'pages', name: 'login', kitUses: 7 }),
      part({ layer: 'pages', name: 'cart' }),
    ]);

    expect(tree.map((group) => [group.label, group.entries.map(({ key, count }) => [key, count])])).toEqual([
      [
        'Pages',
        [
          ['pages/home', undefined],
          ['pages/cart', undefined],
        ],
      ],
      ['Wireframes', [['pages/login', 7]]],
    ]);
  });

  it('badges a part from the base, an overridden one, and one with any problem', () => {
    const [group] = treeOf([
      part({ name: 'a', origin: 'base' }),
      part({ name: 'b', origin: 'overridden', problems: [{ rule: 'LAYER', file: 'x', message: 'm' }] }),
      part({ name: 'c' }),
    ]);

    expect(group?.entries.map((entry) => entry.badges)).toEqual([['from base'], ['overridden', 'error'], []]);
  });

  it('badges a part changed outside a sketch', () => {
    const [group] = treeOf([part({ name: 'a', changedOutsideSketch: true }), part({ name: 'b' })]);

    expect(group?.entries.map((entry) => entry.badges)).toEqual([['changed'], []]);
  });
});

const call = (overrides: Partial<Extract<ListedCall, { headline: string }>> = {}): ListedCall => ({
  slug: 'acme/components/button',
  project: 'acme',
  eyebrow: 'Button',
  headline: 'Which button?',
  stage: 'component',
  legacy: true,
  transferred: false,
  closed: null,
  frameWidth: 960,
  variants: [
    { key: 'a', name: 'Solid' },
    { key: 'b', name: 'Ghost' },
  ],
  ...overrides,
});

describe('treeOf with calls', () => {
  it('lists calls of one project in a single Legacy group after the parts', () => {
    const tree = treeOf([part()], {
      calls: [
        call(),
        call({ slug: 'acme/pages/home', transferred: true }),
        { slug: 'acme/x', project: 'acme', error: 'boom' },
      ],
    });

    expect(tree.map((group) => group.label)).toEqual(['Components', 'Legacy']);
    expect(tree[1]?.entries).toEqual([{ key: 'legacy:acme/x', name: 'x', title: 'boom', badges: ['error'] }]);
    expect(tree[1]?.sections).toEqual([
      {
        key: 'legacy/components',
        label: 'components',
        entries: [{ key: 'legacy:acme/components/button', name: 'button', title: 'Which button?', badges: [] }],
      },
      {
        key: 'legacy/pages',
        label: 'pages',
        entries: [{ key: 'legacy:acme/pages/home', name: 'home', title: 'Which button?', badges: ['transferred'] }],
      },
    ]);
  });

  it('keys sections per project once calls span several', () => {
    const tree = treeOf([], { calls: [call(), call({ slug: 'other/pages/a', project: 'other' })] });

    expect(tree.map((group) => group.sections?.map((section) => section.key))).toEqual([
      ['legacy/acme/components'],
      ['legacy/other/pages'],
    ]);
  });

  it('splits Legacy per project once calls span several, and hides it without calls', () => {
    const tree = treeOf([], { calls: [call(), call({ slug: 'other/a', project: 'other' })] });

    expect(tree.map((group) => [group.key, group.label])).toEqual([
      ['legacy/acme', 'Legacy · acme'],
      ['legacy/other', 'Legacy · other'],
    ]);
    expect(treeOf([part()], { calls: [] })).toHaveLength(1);
  });
});

describe('isGroupOpen and isSectionOpen', () => {
  const [legacy] = treeOf([], { calls: [call(), call({ slug: 'acme/pages/home' })] });
  const [parts] = treeOf([part()]);
  const context = { remembered: {}, hasProducts: true };
  const components = legacy!.sections![0]!;

  it('opens part groups and folds Legacy and its sections by default', () => {
    expect(isGroupOpen(parts!, context)).toBe(true);
    expect(isGroupOpen(legacy!, context)).toBe(false);
    expect(isGroupOpen(legacy!, { ...context, hasProducts: false })).toBe(true);
    expect(isSectionOpen(components, context)).toBe(false);
  });

  it('follows a remembered choice', () => {
    expect(isGroupOpen(parts!, { ...context, remembered: { components: false } })).toBe(false);
    expect(isSectionOpen(components, { ...context, remembered: { [components.key]: true } })).toBe(true);
  });

  it('names the group and the section that hold an entry', () => {
    const tree = treeOf([part()], { calls: [call(), call({ slug: 'acme/pages/home' })] });

    expect(holdersOf(tree, components.entries[0]!.key)).toEqual([legacy!.key, components.key]);
    expect(holdersOf(tree, parts!.entries[0]!.key)).toEqual([parts!.key]);
    expect(holdersOf(tree, 'missing')).toEqual([]);
    expect(holdersOf(tree, null)).toEqual([]);
  });
});

describe('callFramesOf', () => {
  it('draws one frame per variant at the call width, pictured at that width', () => {
    const frames = callFramesOf({ port: 4402, call: call(), epoch: 2, revision: 3, surface: 'dark' });

    expect(frames.map((frame) => [frame.id, frame.label, frame.width, frame.height])).toEqual([
      ['a', 'Solid', 960, undefined],
      ['b', 'Ghost', 960, undefined],
    ]);
    expect(frames[0]?.src).toBe(
      'http://localhost:4402/frame.html?call=acme%2Fcomponents%2Fbutton&variant=a&surface=dark&epoch=2&revision=3',
    );
    expect(frames[0]?.screenshot).toBe(
      'http://localhost:4402/__design/shot?call=acme%2Fcomponents%2Fbutton&variant=a&surface=dark&epoch=2&revision=3&width=960',
    );
  });

  it('falls back to 1280 without a width and fails one frame for a call that does not load', () => {
    expect(callFramesOf({ port: 1, call: call({ frameWidth: 0 }) })[0]).toMatchObject({
      width: 1280,
      screenshot: 'http://localhost:1/__design/shot?call=acme%2Fcomponents%2Fbutton&variant=a&width=1280',
    });
    expect(
      callFramesOf({ port: 1, call: { slug: 'acme/x', project: 'acme', error: 'boom' } }).map((frame) => [
        frame.width,
        frame.error,
      ]),
    ).toEqual([[1280, 'boom']]);
  });
});

describe('framesOf', () => {
  it('draws a page in one row per state and one frame per preset', () => {
    const page = part({ layer: 'pages', name: 'home' });
    const frames = framesOf({ port: 4402, product: product(), part: page, epoch: 2, surface: 'dark', revision: 3 });

    expect(isSmallPart(page)).toBe(false);
    expect(frames.map((frame) => [frame.row, frame.label, frame.width, frame.height])).toEqual([
      ['default', 'default · phone', 390, 844],
      ['default', 'default · desktop', 1280, undefined],
      ['disabled', 'disabled · phone', 390, 844],
      ['disabled', 'disabled · desktop', 1280, undefined],
    ]);
    expect(frames[0]?.src).toBe(
      'http://localhost:4402/frame.html?product=acme&part=pages%2Fhome&state=default&surface=dark&epoch=2&revision=3',
    );
    expect(frames[0]?.screenshot).toBe(
      'http://localhost:4402/__design/shot?product=acme&part=pages%2Fhome&state=default&preset=phone&surface=dark&epoch=2&revision=3',
    );
    expect(frames.every((frame) => frame.error === undefined)).toBe(true);
  });

  it('draws a small part in one frame: a grid with a row per state and a column per interaction', () => {
    const button = part();
    const frames = framesOf({ port: 4402, product: product(), part: button, epoch: 2, revision: 3 });

    expect(isSmallPart(button)).toBe(true);
    expect(frames.map((frame) => [frame.id, frame.label, frame.row, frame.width, frame.place])).toEqual([
      ['components/button', 'components/button', undefined, undefined, undefined],
    ]);
    expect(frames[0]?.grid?.columns).toEqual(['rest']);
    expect(frames[0]?.grid?.rows).toEqual(['default', 'disabled']);
    expect(frames[0]?.grid?.cells[0]?.src).toBe(
      'http://localhost:4402/frame.html?product=acme&part=components%2Fbutton&state=default&fit&epoch=2&revision=3',
    );
    expect(frames[0]?.grid?.cells[0]?.screenshot).toBe(
      'http://localhost:4402/__design/shot?product=acme&part=components%2Fbutton&state=default&epoch=2&revision=3',
    );
  });

  it('forces each interaction on its grid cell, and each cell takes comments in its state and interaction', () => {
    const button = part({ states: ['solid', 'ghost'], interactions: ['hover', 'disabled'] });
    const [frame, ...rest] = framesOf({ port: 4402, product: product(), part: button });
    const cells = frame?.grid?.cells ?? [];

    expect(rest).toEqual([]);
    expect(frame?.grid?.columns).toEqual(['rest', 'hover', 'disabled']);
    expect(cells.map((cell) => [cell.id, cell.row, cell.column])).toEqual([
      ['solid', 'solid', 'rest'],
      ['solid hover', 'solid', 'hover'],
      ['solid disabled', 'solid', 'disabled'],
      ['ghost', 'ghost', 'rest'],
      ['ghost hover', 'ghost', 'hover'],
      ['ghost disabled', 'ghost', 'disabled'],
    ]);
    expect(placeableFramesOf(frame ? [frame] : []).map((placed) => [placed.id, placed.place])).toEqual([
      ['solid', { part: 'components/button', state: 'solid', size: 'fitted' }],
      ['solid hover', { part: 'components/button', state: 'solid', size: 'fitted', interaction: 'hover' }],
      ['solid disabled', { part: 'components/button', state: 'solid', size: 'fitted', interaction: 'disabled' }],
      ['ghost', { part: 'components/button', state: 'ghost', size: 'fitted' }],
      ['ghost hover', { part: 'components/button', state: 'ghost', size: 'fitted', interaction: 'hover' }],
      ['ghost disabled', { part: 'components/button', state: 'ghost', size: 'fitted', interaction: 'disabled' }],
    ]);
    expect(cells[1]?.src).toBe(
      'http://localhost:4402/frame.html?product=acme&part=components%2Fbutton&state=solid&interaction=hover&fit',
    );
    expect(cells[2]?.screenshot).toBe(
      'http://localhost:4402/__design/shot?product=acme&part=components%2Fbutton&state=solid&interaction=disabled',
    );
  });

  it('draws each interaction of a part with widths at every width in the row of its state', () => {
    const card = part({ layer: 'elements', name: 'card', states: ['default'], widths: [280], interactions: ['hover'] });
    const frames = framesOf({ port: 4402, product: product(), part: card });

    expect(frames.map((frame) => [frame.id, frame.row, frame.label, frame.place?.size])).toEqual([
      ['default 280', 'default', 'default · width', 280],
      ['default 280 hover', 'default', 'default · width · hover', 280],
    ]);
  });

  it('draws a part with widths in one row per state and one frame per width', () => {
    const card = part({ layer: 'elements', name: 'card', widths: [280, 480] });
    const frames = framesOf({ port: 4402, product: product(), part: card, revision: 3 });

    expect(isSmallPart(card)).toBe(false);
    expect(frames.map((frame) => [frame.row, frame.width, frame.height])).toEqual([
      ['default', 280, undefined],
      ['default', 480, undefined],
      ['disabled', 280, undefined],
      ['disabled', 480, undefined],
    ]);
    expect(frames[1]?.src).toBe(
      'http://localhost:4402/frame.html?product=acme&part=elements%2Fcard&state=default&revision=3',
    );
    expect(frames[1]?.screenshot).toBe(
      'http://localhost:4402/__design/shot?product=acme&part=elements%2Fcard&state=default&width=480&revision=3',
    );
  });

  it('marks frames failed only for a LOAD problem, not for a rule problem', () => {
    const ruled = framesOf({
      port: 1,
      product: product(),
      part: part({ problems: [{ rule: 'LAYER', file: 'x', message: 'uses a page' }] }),
    });

    expect(ruled.every((frame) => frame.error === undefined)).toBe(true);
  });

  it('gives a part that does not load one frame with the error', () => {
    const frames = framesOf({
      port: 1,
      product: product(),
      part: part({ states: [], problems: [{ rule: 'LOAD', file: 'x', message: 'boom' }] }),
    });

    expect(frames.map((frame) => [frame.row, frame.label, frame.error])).toEqual([
      [undefined, 'components/button', 'boom'],
    ]);
  });
});

describe('frames in the tree', () => {
  it('lists the frames of a part drawn in several, and leaves a part drawn in one grid frame without children', () => {
    const button = part({ interactions: ['hover'] });
    const home = part({ layer: 'pages', name: 'home', states: ['default'] });
    const [components, pages] = treeOf([button, home], { product: product([button, home]) });

    expect(components?.entries.map((entry) => [entry.key, entry.frames])).toEqual([['components/button', undefined]]);
    expect(pages?.entries[0]?.frames?.map((frame) => [frame.key, frame.name, frame.part, frame.frame])).toEqual([
      ['frame:pages/home default phone', 'default · phone', 'pages/home', 'default phone'],
      ['frame:pages/home default desktop', 'default · desktop', 'pages/home', 'default desktop'],
    ]);
  });
});

const sketch = (overrides: Partial<ListedSketch> = {}): ListedSketch => ({
  target: 'components/button',
  status: 'in progress',
  createdAt: '2026-10-27T10:00:00.000Z',
  product: 'acme',
  layer: 'components',
  name: 'button',
  dir: '.ethlete/design/acme/sketches/components-button',
  variants: ['a', 'b'],
  problems: [],
  ...overrides,
});

describe('sketches in the tree', () => {
  it('lists open sketches after the pages with their status, and badges the target part', () => {
    const tree = treeOf([part({ name: 'button' }), part({ name: 'card' })], {
      sketches: [
        sketch(),
        sketch({
          target: 'elements/header',
          layer: 'elements',
          name: 'header',
          status: 'ready',
          problems: [{ variant: 'a', problems: [{ rule: 'LAYER', file: 'x', message: 'm' }] }],
        }),
      ],
    });

    expect(tree.map((group) => group.key)).toEqual(['components', 'sketches']);
    expect(tree[0]?.entries.map((entry) => entry.badges)).toEqual([['sketch open'], []]);
    expect(tree[1]?.entries.map((entry) => [entry.key, entry.name, entry.title, entry.badges])).toEqual([
      ['sketch:components/button', 'button', 'components/button', ['in progress']],
      ['sketch:elements/header', 'header', 'elements/header', ['ready', 'error']],
    ]);
  });

  it('marks a sketch only with the comments made in it, not those of an earlier sketch on its target', () => {
    const onVariant = (createdAt: string) => ({
      part: 'components/button',
      state: 'default',
      size: 'phone',
      sketch: { target: 'components/button', variant: 'a', createdAt },
      threadState: 'agent' as const,
    });
    const badgesWith = (createdAt: string) =>
      treeOf([part({ name: 'button' })], { sketches: [sketch()], comments: [onVariant(createdAt)] })[1]?.entries[0]
        ?.badges;

    expect(badgesWith('2026-10-27T10:00:00.000Z')).toContain('comment open');
    expect(badgesWith('2026-10-26T10:00:00.000Z')).not.toContain('comment open');
  });
});

describe('pages that use a part', () => {
  const tree = part({
    layer: 'elements',
    name: 'tree',
    usedIn: [
      { product: 'acme', part: 'pages/system' },
      { product: 'other', part: 'pages/x' },
    ],
  });
  const system = part({ layer: 'pages', name: 'system', states: ['open', 'empty'] });
  const shop = product([tree, system]);

  it('adds a used in row to the part view with the first state of each page of its product at the first preset', () => {
    const used = framesOf({ port: 4400, product: shop, part: tree }).filter((frame) => frame.row === 'used in');

    expect(usingPagesOf(shop, tree)).toEqual([system]);
    expect(used).toMatchObject([
      {
        id: 'used in pages/system',
        width: 390,
        height: 844,
        place: { part: 'pages/system', state: 'open', size: 'phone' },
      },
    ]);
    expect(used[0]?.screenshot).toContain('part=pages%2Fsystem');
  });

  it('draws one label instead of frames when every page of the product uses the part', () => {
    const all = part({
      layer: 'elements',
      name: 'all',
      usedIn: [
        { product: 'acme', part: 'pages/system' },
        { product: 'acme', part: 'pages/start' },
      ],
    });
    const both = product([all, system, part({ layer: 'pages', name: 'start', states: ['open'] })]);
    const used = framesOf({ port: 4400, product: both, part: all }).filter((frame) => frame.row === 'used in');

    expect(used).toMatchObject([{ rowLabel: 'used in all 2 pages', empty: expect.any(String) }]);
  });

  it('adds an in context band to an element sketch: each page with each variant swapped in, commentable', () => {
    const matrix = sketchMatrixOf({
      port: 4400,
      product: shop,
      part: tree,
      sketch: sketch({ target: 'elements/tree', layer: 'elements', name: 'tree', status: 'ready' }),
    });
    const context = matrix.frames.filter((frame) => frame.row === 'in context pages/system');

    expect(matrix.sections).toEqual(['sketch', 'in context']);
    expect(context.map((frame) => [frame.column, frame.place])).toEqual([
      ['in context current', { part: 'pages/system', state: 'open', size: 'phone' }],
      [
        'in context a',
        { part: 'pages/system', state: 'open', size: 'phone', sketch: { target: 'elements/tree', variant: 'a' } },
      ],
      [
        'in context b',
        { part: 'pages/system', state: 'open', size: 'phone', sketch: { target: 'elements/tree', variant: 'b' } },
      ],
    ]);
    expect(context[1]?.screenshot).toMatch(/part=pages%2Fsystem.*sketch=elements%2Ftree&variant=a/);
    expect(matrix.columns.filter((column) => column.section === 'in context').map((column) => column.key)).toEqual([
      'in context current',
      'in context a',
      'in context b',
    ]);
    expect(matrix.columns.every((column) => column.section !== undefined)).toBe(true);
  });
});

describe('sketchMatrixOf', () => {
  const source = { port: 4400, product: product(), revision: 2 };

  it('switches every cell to the picked interaction, with an empty cell where a column lacks it', () => {
    const shown = { ...source, part: part({ states: ['solid'], interactions: ['hover'] }) };
    const withTargets = sketch({
      targets: [
        { variant: 'a', states: ['solid'], interactions: ['hover', 'active'] },
        { variant: 'b', states: ['solid'], interactions: [] },
      ],
    });
    const rest = sketchMatrixOf({ ...shown, sketch: withTargets, interaction: 'rest' });
    const hover = sketchMatrixOf({ ...shown, sketch: withTargets, interaction: 'hover' });

    expect(rest.interactions).toEqual(['rest', 'hover', 'active']);
    expect(rest.interaction).toBe('rest');
    expect(rest.frames.map((frame) => frame.id)).toEqual(['current solid', 'a solid', 'b solid']);
    expect(rest.frames.every((frame) => !frame.src.includes('interaction='))).toBe(true);
    expect(sketchMatrixOf({ ...shown, sketch: withTargets, interaction: 'focus-visible' }).interaction).toBe('all');
    expect(hover.frames.map((frame) => [frame.id, frame.place?.interaction, frame.empty])).toEqual([
      ['current solid hover', 'hover', undefined],
      ['a solid hover', 'hover', undefined],
      ['b solid hover', undefined, 'b has no hover interaction'],
    ]);
    expect(hover.frames[1]?.src).toContain('&interaction=hover');
    expect(hover.frames[1]?.screenshot).toContain('&interaction=hover');
    expect(sketchMatrixOf({ ...shown, part: part({ states: ['solid'] }), sketch: sketch() }).interactions).toEqual([
      'rest',
    ]);
  });

  it('shows every interaction by default, a row per state and interaction in Studio order', () => {
    const shown = { ...source, part: part({ states: ['solid', 'outline'], interactions: ['disabled', 'hover'] }) };
    const withTargets = sketch({
      variants: ['b'],
      targets: [{ variant: 'b', states: ['solid', 'outline'], interactions: ['disabled'] }],
    });
    const all = sketchMatrixOf({ ...shown, sketch: withTargets });

    expect(all.interaction).toBe('all');
    expect(all.interactions).toEqual(['rest', 'hover', 'disabled']);
    expect(
      all.frames
        .filter((frame) => frame.column === 'b')
        .map((frame) => [frame.row, frame.rowLabel, frame.rowGroup, frame.place?.interaction, frame.empty]),
    ).toEqual([
      ['solid · rest', undefined, 'solid', undefined, undefined],
      ['solid · hover', 'hover', 'solid', undefined, 'b has no hover interaction'],
      ['solid · disabled', 'disabled', 'solid', 'disabled', undefined],
      ['outline · rest', undefined, 'outline', undefined, undefined],
      ['outline · hover', 'hover', 'outline', undefined, 'b has no hover interaction'],
      ['outline · disabled', 'disabled', 'outline', 'disabled', undefined],
    ]);
    expect(all.frames.find((frame) => frame.id === 'current outline hover')?.src).toContain('&interaction=hover');
    expect(sketchMatrixOf({ ...shown, sketch: withTargets, size: '520' }).interaction).toBe('all');
  });

  it('has a column for the current part and each variant, and a row per state any of them has', () => {
    const matrix = sketchMatrixOf({
      ...source,
      part: part({ states: ['default'] }),
      sketch: sketch({
        targets: [
          { variant: 'a', states: ['default', 'loading'] },
          { variant: 'b', states: ['default'] },
        ],
      }),
    });

    expect(matrix.columns.map((column) => column.label)).toEqual(['current', 'a', 'b']);
    expect(matrix.sizes).toEqual([]);
    expect(matrix.frames.map((frame) => [frame.column, frame.row, frame.width])).toEqual([
      ['current', 'default', undefined],
      ['current', 'loading', undefined],
      ['a', 'default', undefined],
      ['a', 'loading', undefined],
      ['b', 'default', undefined],
      ['b', 'loading', undefined],
    ]);
    expect(matrix.frames[0]?.src).toContain('&fit');
    expect(matrix.frames[0]?.src).not.toContain('variant=');
    expect(matrix.frames[3]?.src).toContain('&sketch=components%2Fbutton&variant=a');
    expect(matrix.frames[3]?.screenshot).toContain('&sketch=components%2Fbutton&variant=a');
    expect(new Set(matrix.frames.map((frame) => frame.id)).size).toBe(matrix.frames.length);
  });

  it('draws an empty cell without a place where a column lacks the state of the row', () => {
    const matrix = sketchMatrixOf({
      ...source,
      part: part({ states: ['default'] }),
      sketch: sketch({
        targets: [
          { variant: 'a', states: ['default'] },
          { variant: 'b', states: ['default', 'disabled'] },
        ],
      }),
    });
    const empty = matrix.frames.filter((frame) => frame.empty !== undefined);

    expect(empty.map((frame) => [frame.column, frame.row, frame.empty, frame.place])).toEqual([
      ['current', 'disabled', 'new in this sketch', undefined],
      ['a', 'disabled', 'a has no disabled state', undefined],
    ]);
    expect(empty.every((frame) => frame.src === '' && frame.screenshot === undefined)).toBe(true);
  });

  it('gives every cell of a page the picked preset, or the first one', () => {
    const page = part({ layer: 'pages', name: 'home', states: ['default'] });
    const pageSketch = sketch({ target: 'pages/home', layer: 'pages', name: 'home', variants: ['a'] });

    const first = sketchMatrixOf({ ...source, part: page, sketch: pageSketch });
    const desktop = sketchMatrixOf({ ...source, part: page, sketch: pageSketch, size: 'desktop' });

    expect(first.sizes).toEqual(['phone', 'desktop']);
    expect(first.frames.map((frame) => [frame.width, frame.height, frame.label])).toEqual([
      [390, 844, 'phone'],
      [390, 844, 'phone'],
    ]);
    expect(desktop.frames[1]?.screenshot).toContain('&preset=desktop');
  });

  it('offers the widths of the part and every variant, sorted', () => {
    const matrix = sketchMatrixOf({
      ...source,
      part: part({ widths: [480, 240] }),
      sketch: sketch({ targets: [{ variant: 'a', states: ['default'], widths: [360, 240] }] }),
      size: '360',
    });

    expect(matrix.sizes).toEqual(['240', '360', '480']);
    expect(matrix.frames.every((frame) => frame.width === 360 && frame.label === '360 px')).toBe(true);
    expect(matrix.frames[0]?.screenshot).toContain('&width=360');
  });

  it('draws no frames for the variant the agent reports drawing while the sketch is in progress', () => {
    const report = { message: 'variant b, phone', updatedAt: '', variant: 'b' };
    const drawing = sketchMatrixOf({ ...source, part: part(), sketch: sketch({ report }) });
    const ready = sketchMatrixOf({ ...source, part: part(), sketch: sketch({ report, status: 'ready' }) });

    expect(drawing.columns.find((column) => column.key === 'b')).toEqual({
      key: 'b',
      label: 'b · drawing …',
      drawing: true,
    });
    expect(drawing.frames.some((frame) => frame.column === 'b')).toBe(false);
    expect(ready.frames.some((frame) => frame.column === 'b')).toBe(true);
  });

  it('keeps a fresh report drawing and draws the frames of a report 30 minutes old with a note in its head', () => {
    const report = { message: 'variant b, phone', updatedAt: '2026-10-27T12:00:00Z', variant: 'b' };
    const at = (time: string) =>
      sketchMatrixOf({ ...source, part: part(), sketch: sketch({ report }), now: Date.parse(time) });
    const fresh = at('2026-10-27T12:29:59Z');
    const silent = at('2026-10-27T12:30:00Z');

    expect(fresh.columns.find((column) => column.key === 'b')).toEqual({
      key: 'b',
      label: 'b · drawing …',
      drawing: true,
    });
    expect(fresh.frames.some((frame) => frame.column === 'b')).toBe(false);
    expect(silent.columns.find((column) => column.key === 'b')).toEqual({
      key: 'b',
      label: 'b',
      drawing: false,
      note: 'No report for 30 min',
    });
    expect(silent.frames.some((frame) => frame.column === 'b')).toBe(true);
  });

  it('names the first author of a variant in its head, counts the rest, and lists all in the title', () => {
    const matrix = sketchMatrixOf({
      ...source,
      part: part(),
      sketch: sketch({
        status: 'ready',
        variantInfo: { a: { authors: ['gemini-3-argon'] }, b: { authors: ['gpt-5.6-sol', 'claude-opus-5-5'] } },
      }),
    });
    const unauthored = sketchMatrixOf({ ...source, part: part(), sketch: sketch({ status: 'ready' }) });

    expect(matrix.columns.slice(1)).toEqual([
      { key: 'a', label: 'a · gemini-3-argon', title: 'a by gemini-3-argon', drawing: false },
      { key: 'b', label: 'b · gpt-5.6-sol +1', title: 'b by gpt-5.6-sol, claude-opus-5-5', drawing: false },
    ]);
    expect(unauthored.columns.slice(1)).toEqual([
      { key: 'a', label: 'a', drawing: false },
      { key: 'b', label: 'b', drawing: false },
    ]);
  });

  describe('unchanged states', () => {
    const shell = part({ states: ['system', 'hidden'] });
    const unchanging = sketch({
      variants: ['a', 'b'],
      targets: [
        { variant: 'a', states: ['system', 'hidden'], unchanged: ['system'] },
        { variant: 'b', states: ['system', 'hidden', 'inbox'], unchanged: ['system'] },
      ],
    });
    const rowsOf = (matrix: ReturnType<typeof sketchMatrixOf>) => [...new Set(matrix.frames.map((frame) => frame.row))];

    it('folds a state every variant draws as current does into a head without frames, below the changed rows', () => {
      const matrix = sketchMatrixOf({ ...source, part: shell, sketch: unchanging });

      expect(rowsOf(matrix)).toEqual(['hidden', 'inbox']);
      expect(matrix.rowHeads).toEqual([
        {
          key: stateRowKeyOf('system'),
          label: 'system · unchanged in a b',
          title: 'Open system: every shown variant draws it as current does',
          open: false,
          before: 'system',
        },
      ]);
    });

    it('draws an opened state below the changed rows, under its head', () => {
      const matrix = sketchMatrixOf({ ...source, part: shell, sketch: unchanging, openStates: { system: true } });

      expect(rowsOf(matrix)).toEqual(['hidden', 'inbox', 'system']);
      expect(matrix.rowHeads.map((head) => [head.open, head.before])).toEqual([[true, 'system']]);
    });

    it('keeps a state one variant changes, and folds nothing for a cli without unchanged states', () => {
      const changedInB = sketch({
        variants: ['a', 'b'],
        targets: [
          { variant: 'a', states: ['system', 'hidden'], unchanged: ['system'] },
          { variant: 'b', states: ['system', 'hidden'], unchanged: [] },
        ],
      });
      const older = sketch({ variants: ['a'], targets: [{ variant: 'a', states: ['system', 'hidden'] }] });

      expect(rowsOf(sketchMatrixOf({ ...source, part: shell, sketch: changedInB }))).toEqual(['system', 'hidden']);
      expect(sketchMatrixOf({ ...source, part: shell, sketch: changedInB }).rowHeads).toEqual([]);
      expect(sketchMatrixOf({ ...source, part: shell, sketch: older }).rowHeads).toEqual([]);
    });

    it('heads the first interaction row of a folded state when every interaction shows', () => {
      const matrix = sketchMatrixOf({
        ...source,
        part: { ...shell, interactions: ['hover'] },
        sketch: unchanging,
        openStates: { system: true },
      });

      expect(matrix.rowHeads[0]?.before).toBe('system · rest');
      expect(rowsOf(matrix).slice(-2)).toEqual(['system · rest', 'system · hover']);
    });
  });

  describe('rounds', () => {
    const rounded = sketch({
      status: 'ready',
      variants: ['a', 'b', 'c'],
      rounds: [
        { key: 'r1', title: 'Pill or square', note: 'Too round' },
        { key: 'r2', title: 'Combined', note: '' },
      ],
      variantInfo: { a: { round: 'r1' }, b: { round: 'r1', authors: ['gpt-5.6-sol'] }, c: { round: 'r2' } },
    });

    it('shows each round as its own band, newest on top, and folds an older round into a row head with its title, note and variants', () => {
      const matrix = sketchMatrixOf({ ...source, part: part(), sketch: rounded });

      expect(matrix.sections).toEqual(['round r2', 'round r1']);
      expect(matrix.columns).toEqual([
        { key: 'current', label: 'current', drawing: false, section: 'round r2' },
        {
          key: 'c',
          label: 'c',
          drawing: false,
          group: { key: 'round r2', label: 'r2 · Combined', title: 'Fold r2 · Combined' },
          section: 'round r2',
        },
      ]);
      expect(matrix.rowHeads).toEqual([
        {
          key: 'round r1',
          label: 'r1 · Pill or square · a b',
          title: 'Open r1 · Pill or square · a b\n\nToo round',
          note: 'Too round',
          open: false,
          section: 'round r1',
        },
      ]);
      expect([...new Set(matrix.frames.map((frame) => frame.column))]).toEqual(['current', 'c']);
    });

    it('gives every open band its own rows, labelled by state', () => {
      const matrix = sketchMatrixOf({ ...source, part: part(), sketch: rounded, openRounds: { r1: true, r2: true } });

      expect(matrix.columns.map((column) => [column.key, column.section])).toEqual([
        ['current', 'round r2'],
        ['c', 'round r2'],
        ['a', 'round r1'],
        ['b', 'round r1'],
      ]);
      expect(matrix.frames.map((frame) => [frame.column, frame.row, frame.rowLabel])).toEqual([
        ['current', 'round r2 default', 'default'],
        ['current', 'round r2 disabled', 'disabled'],
        ['c', 'round r2 default', 'default'],
        ['c', 'round r2 disabled', 'disabled'],
        ['a', 'round r1 default', 'default'],
        ['a', 'round r1 disabled', 'disabled'],
        ['b', 'round r1 default', 'default'],
        ['b', 'round r1 disabled', 'disabled'],
      ]);
    });

    it('puts the current column in a band of its own while every round is folded', () => {
      const matrix = sketchMatrixOf({ ...source, part: part(), sketch: rounded, openRounds: { r1: false, r2: false } });

      expect(matrix.sections).toEqual(['current', 'round r2', 'round r1']);
      expect(matrix.columns).toEqual([{ key: 'current', label: 'current', drawing: false, section: 'current' }]);
      expect(matrix.rowHeads.map((head) => head.key)).toEqual(['round r2', 'round r1']);
    });

    it('marks every frame of the newest round pending until the sketch is ready', () => {
      const drawing = sketchMatrixOf({
        ...source,
        part: part(),
        sketch: { ...rounded, status: 'in progress' },
        openRounds: { r1: true, r2: true },
      });
      const ready = sketchMatrixOf({ ...source, part: part(), sketch: rounded, openRounds: { r1: true, r2: true } });

      expect(drawing.frames.map((frame) => [frame.column, frame.pending])).toEqual([
        ['current', undefined],
        ['current', undefined],
        ['c', PENDING_LABEL],
        ['c', PENDING_LABEL],
        ['a', undefined],
        ['a', undefined],
        ['b', undefined],
        ['b', undefined],
      ]);
      expect(ready.frames.some((frame) => frame.pending !== undefined)).toBe(false);
    });

    it('offers only the interactions of the part and of open rounds', () => {
      const targets = [
        { variant: 'a', states: ['default'], interactions: ['disabled'] },
        { variant: 'c', states: ['default'] },
      ];

      expect(sketchMatrixOf({ ...source, part: null, sketch: { ...rounded, targets } }).interactions).toEqual(['rest']);
      expect(
        sketchMatrixOf({ ...source, part: null, sketch: { ...rounded, targets }, openRounds: { r1: true, r2: true } })
          .interactions,
      ).toEqual(['rest', 'disabled']);
    });

    it('opens and folds rounds as the user chose, and keeps a new round open', () => {
      const matrix = sketchMatrixOf({ ...source, part: part(), sketch: rounded, openRounds: { r1: true, r2: false } });

      expect(matrix.columns.map((column) => [column.key, column.group?.label, column.group?.note])).toEqual([
        ['current', undefined, undefined],
        ['a', 'r1 · Pill or square', 'Too round'],
        ['b', 'r1 · Pill or square', 'Too round'],
      ]);
      expect(matrix.rowHeads.map((head) => [head.key, head.open])).toEqual([['round r2', false]]);
      expect(matrix.sections).toEqual(['round r2', 'round r1']);
      expect(matrix.columns[2]?.label).toBe('b · gpt-5.6-sol');
      expect(sketchRoundsOf(rounded, { r1: false }).map((round) => round.open)).toEqual([false, true]);
    });

    it('folds the older rounds again when a newer round came after the choice', () => {
      const third = { ...rounded, rounds: [...(rounded.rounds ?? []), { key: 'r3', title: 'Smaller', note: '' }] };
      const chosen = openRoundsOf(sketchRoundsOf(rounded, { r1: true, r2: true }));

      expect(sketchRoundsOf(rounded, chosen).map((round) => round.open)).toEqual([true, true]);
      expect(sketchRoundsOf(third, chosen).map((round) => round.open)).toEqual([false, false, true]);
    });

    it('shows one untitled round, and data older than rounds, as plain variant columns', () => {
      const old = sketchMatrixOf({ ...source, part: part(), sketch: sketch({ status: 'ready' }) });
      const one = sketchMatrixOf({
        ...source,
        part: part(),
        sketch: sketch({
          status: 'ready',
          rounds: [{ key: 'r1', title: '', note: '' }],
          variantInfo: { a: { round: 'r1' }, b: { round: 'r1' } },
        }),
      });

      for (const matrix of [old, one]) {
        expect(matrix.columns).toEqual([
          { key: 'current', label: 'current', drawing: false },
          { key: 'a', label: 'a', drawing: false },
          { key: 'b', label: 'b', drawing: false },
        ]);
      }
    });
  });

  it('shows only variants for a new part, and fails a variant that does not load', () => {
    const matrix = sketchMatrixOf({
      ...source,
      part: null,
      sketch: sketch({
        targets: [
          { variant: 'a', states: ['empty'] },
          { variant: 'b', states: [], error: 'boom' },
        ],
      }),
    });

    expect(matrix.columns.map((column) => column.key)).toEqual(['a', 'b']);
    expect(matrix.frames.map((frame) => [frame.column, frame.row, frame.error])).toEqual([
      ['a', 'empty', undefined],
      ['b', 'empty', 'boom'],
    ]);
  });
});

describe('mergePreviewOf', () => {
  it('draws each affected part now and after the merge, at a size it offers', () => {
    const header = part({ layer: 'elements', name: 'header', states: ['default'] });
    const home = part({ layer: 'pages', name: 'home', states: [] });
    const preview = mergePreviewOf({
      port: 4400,
      product: product([part(), header, home]),
      sketch: sketch(),
      variant: 'b',
      affected: ['elements/header', 'pages/home', 'pages/gone'],
      size: 'desktop',
    });

    expect(preview.columns.map((column) => column.key)).toEqual(['now', 'merged']);
    expect(preview.frames.map((frame) => [frame.column, frame.row, frame.width])).toEqual([
      ['now', 'elements/header · default', undefined],
      ['merged', 'elements/header · default', undefined],
      ['now', 'pages/home', 1280],
      ['merged', 'pages/home', 1280],
    ]);
    expect(preview.frames[0]?.src).not.toContain('variant=');
    expect(preview.frames[1]?.src).toContain(
      '&part=elements%2Fheader&state=default&sketch=components%2Fbutton&variant=b',
    );
  });
});

describe('mergePreviewOf with compared rows', () => {
  const library = part({ layer: 'pages', name: 'library', states: ['one', 'empty', 'many'] });
  const row = (state: string, extra: Partial<CompareRow> = {}): CompareRow => ({
    part: 'pages/library',
    state,
    preset: 'desktop',
    outlines: { now: [], merged: [] },
    ...extra,
  });
  const previewOf = (rows: CompareRow[]) =>
    mergePreviewOf({
      port: 4400,
      product: product([part(), library]),
      sketch: sketch(),
      variant: 'b',
      affected: ['pages/library'],
      rows,
    });

  it('draws only the compared states, and a row error on both sides', () => {
    const preview = previewOf([row('empty'), row('many', { error: 'the variant threw' })]);

    expect(preview.frames.map((frame) => [frame.id, frame.error])).toEqual([
      ['now pages/library empty', undefined],
      ['merged pages/library empty', undefined],
      ['now pages/library many', 'the variant threw'],
      ['merged pages/library many', 'the variant threw'],
    ]);
  });

  it('puts each outline on the frame of its side', () => {
    const rect = { x: 10, y: 20, width: 30, height: 40 };
    const rows = [row('empty', { outlines: { now: [], merged: [rect] } })];
    const ids = new Set(previewOf(rows).frames.map((frame) => frame.id));
    const outlines = mergeOutlinesOf(rows);

    expect(outlines).toEqual([{ frameId: 'merged pages/library empty', ...rect }]);
    expect(outlines.every((outline) => ids.has(outline.frameId))).toBe(true);
  });
});

describe('unchangedLinesOf', () => {
  it('sums the unchanged states of each part into one line', () => {
    const at = (part: string, state: string): CompareRow => ({ part, state, outlines: { now: [], merged: [] } });

    expect(
      unchangedLinesOf([at('pages/library', 'one'), at('elements/header', ''), at('pages/library', 'many')]),
    ).toEqual([
      { part: 'pages/library', text: '2 states of pages/library without visible change' },
      { part: 'elements/header', text: '1 state of elements/header without visible change' },
    ]);
  });
});

describe('picking a variant', () => {
  it('allows a pick only on a ready sketch and a variant without problems', () => {
    const problems = [{ variant: 'b', problems: [{ rule: 'LAYER', file: 'x', message: 'm' }] }];

    expect(canPick(sketch(), 'a')).toBe(false);
    expect(canPick(sketch({ status: 'ready', problems }), 'a')).toBe(true);
    expect(canPick(sketch({ status: 'ready', problems }), 'b')).toBe(false);
  });

  it('reads the picked variant, ignoring a discard and a variant that is gone', () => {
    const decidedAt = '2026-10-27T11:00:00.000Z';

    expect(pickedVariantOf(sketch({ decision: { kind: 'pick', variant: 'b', decidedAt } }))).toBe('b');
    expect(pickedVariantOf(sketch({ decision: { kind: 'pick', variant: 'z', decidedAt } }))).toBeNull();
    expect(pickedVariantOf(sketch({ decision: { kind: 'discard', decidedAt } }))).toBeNull();
    expect(pickedVariantOf(sketch())).toBeNull();
  });
});
