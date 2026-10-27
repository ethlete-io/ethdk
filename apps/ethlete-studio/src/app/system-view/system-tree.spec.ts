import { ListedCall, ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import {
  arrangementOf,
  callFramesOf,
  canPick,
  holdersOf,
  isGroupOpen,
  isSectionOpen,
  framesOf,
  pickedVariantOf,
  mergePreviewOf,
  sketchMatrixOf,
  treeOf,
} from './system-tree';

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

  it('badges a part from the base, an overridden one, and one with any problem', () => {
    const [group] = treeOf([
      part({ name: 'a', origin: 'base' }),
      part({ name: 'b', origin: 'overridden', problems: [{ rule: 'LAYER', file: 'x', message: 'm' }] }),
      part({ name: 'c' }),
    ]);

    expect(group?.entries.map((entry) => entry.badges)).toEqual([['from base'], ['overridden', 'error'], []]);
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

    expect(arrangementOf(page)).toBe('sheet');
    expect(frames.map((frame) => [frame.row, frame.label, frame.width, frame.height])).toEqual([
      ['default', 'phone', 390, 844],
      ['default', 'desktop', 1280, undefined],
      ['disabled', 'phone', 390, 844],
      ['disabled', 'desktop', 1280, undefined],
    ]);
    expect(frames[0]?.src).toBe(
      'http://localhost:4402/frame.html?product=acme&part=pages%2Fhome&state=default&surface=dark&epoch=2&revision=3',
    );
    expect(frames[0]?.screenshot).toBe(
      'http://localhost:4402/__design/shot?product=acme&part=pages%2Fhome&state=default&preset=phone&surface=dark&epoch=2&revision=3',
    );
    expect(frames.every((frame) => frame.error === undefined)).toBe(true);
  });

  it('draws a small part as one tile per state, fitted to its content and named by the state', () => {
    const button = part();
    const frames = framesOf({ port: 4402, product: product(), part: button, epoch: 2, revision: 3 });

    expect(arrangementOf(button)).toBe('grid');
    expect(frames.map((frame) => [frame.id, frame.row, frame.label, frame.width, frame.height])).toEqual([
      ['default', undefined, 'default', undefined, undefined],
      ['disabled', undefined, 'disabled', undefined, undefined],
    ]);
    expect(frames[0]?.src).toBe(
      'http://localhost:4402/frame.html?product=acme&part=components%2Fbutton&state=default&fit&epoch=2&revision=3',
    );
    expect(frames[0]?.screenshot).toBe(
      'http://localhost:4402/__design/shot?product=acme&part=components%2Fbutton&state=default&epoch=2&revision=3',
    );
  });

  it('draws a part with widths in one row per state and one frame per width', () => {
    const card = part({ layer: 'elements', name: 'card', widths: [280, 480] });
    const frames = framesOf({ port: 4402, product: product(), part: card, revision: 3 });

    expect(arrangementOf(card)).toBe('sheet');
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
          status: 'ready',
          problems: [{ variant: 'a', problems: [{ rule: 'LAYER', file: 'x', message: 'm' }] }],
        }),
      ],
    });

    expect(tree.map((group) => group.key)).toEqual(['components', 'sketches']);
    expect(tree[0]?.entries.map((entry) => entry.badges)).toEqual([['sketch open'], []]);
    expect(tree[1]?.entries.map((entry) => [entry.key, entry.badges])).toEqual([
      ['sketch:components/button', ['in progress']],
      ['sketch:elements/header', ['ready', 'error']],
    ]);
  });
});

describe('sketchMatrixOf', () => {
  const source = { port: 4400, product: product(), revision: 2 };

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
