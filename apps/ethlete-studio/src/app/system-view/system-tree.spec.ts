import { ListedCall, ListedPart, ListedProduct } from '../../host/design';
import { callFramesOf, isGroupOpen, isSectionOpen, framesOf, treeOf } from './system-tree';

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
    const tree = treeOf(
      [part()],
      [
        call(),
        call({ slug: 'acme/pages/home', transferred: true }),
        { slug: 'acme/x', project: 'acme', error: 'boom' },
      ],
    );

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
    const tree = treeOf([], [call(), call({ slug: 'other/pages/a', project: 'other' })]);

    expect(tree.map((group) => group.sections?.map((section) => section.key))).toEqual([
      ['legacy/acme/components'],
      ['legacy/other/pages'],
    ]);
  });

  it('splits Legacy per project once calls span several, and hides it without calls', () => {
    const tree = treeOf([], [call(), call({ slug: 'other/a', project: 'other' })]);

    expect(tree.map((group) => [group.key, group.label])).toEqual([
      ['legacy/acme', 'Legacy · acme'],
      ['legacy/other', 'Legacy · other'],
    ]);
    expect(treeOf([part()], [])).toHaveLength(1);
  });
});

describe('isGroupOpen and isSectionOpen', () => {
  const [legacy] = treeOf([], [call(), call({ slug: 'acme/pages/home' })]);
  const [parts] = treeOf([part()]);
  const context = { remembered: {}, hasProducts: true, selectedKey: null };
  const components = legacy!.sections![0]!;

  it('opens part groups and folds Legacy and its sections by default', () => {
    expect(isGroupOpen(parts!, context)).toBe(true);
    expect(isGroupOpen(legacy!, context)).toBe(false);
    expect(isGroupOpen(legacy!, { ...context, hasProducts: false })).toBe(true);
    expect(isSectionOpen(components, context)).toBe(false);
  });

  it('follows a remembered choice but never folds the selection', () => {
    expect(isGroupOpen(parts!, { ...context, remembered: { components: false } })).toBe(false);
    expect(isSectionOpen(components, { ...context, remembered: { [components.key]: true } })).toBe(true);

    const selectedKey = components.entries[0]!.key;
    const held = { ...context, remembered: { legacy: false, [components.key]: false }, selectedKey };

    expect(isSectionOpen(components, held)).toBe(true);
    expect(isGroupOpen(legacy!, held)).toBe(true);
    expect(isSectionOpen(legacy!.sections![1]!, held)).toBe(false);
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
      'http://localhost:4402/frame.html?call=acme%2Fcomponents%2Fbutton&variant=a&surface=dark&epoch=2',
    );
    expect(frames[0]?.screenshot).toBe(
      'http://localhost:4402/__design/shot?call=acme%2Fcomponents%2Fbutton&variant=a&surface=dark&epoch=2&width=960&revision=3',
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
  it('draws one row per state and one frame per preset', () => {
    const frames = framesOf({ port: 4402, product: product(), part: part(), epoch: 2, surface: 'dark', revision: 3 });

    expect(frames.map((frame) => [frame.row, frame.label, frame.width, frame.height])).toEqual([
      ['default', 'phone', 390, 844],
      ['default', 'desktop', 1280, undefined],
      ['disabled', 'phone', 390, 844],
      ['disabled', 'desktop', 1280, undefined],
    ]);
    expect(frames[0]?.src).toBe(
      'http://localhost:4402/frame.html?product=acme&part=components%2Fbutton&state=default&surface=dark&epoch=2',
    );
    expect(frames[0]?.screenshot).toBe(
      'http://localhost:4402/__design/shot?product=acme&part=components%2Fbutton&state=default&preset=phone&surface=dark&epoch=2&revision=3',
    );
    expect(frames.every((frame) => frame.error === undefined)).toBe(true);
  });

  it('marks frames failed only for a LOAD problem, not for a rule problem', () => {
    const ruled = framesOf({
      port: 1,
      product: product(),
      part: part({ problems: [{ rule: 'LAYER', file: 'x', message: 'uses a page' }] }),
    });

    expect(ruled.every((frame) => frame.error === undefined)).toBe(true);
  });

  it('gives a part that does not load one unlabelled row with the error', () => {
    const frames = framesOf({
      port: 1,
      product: product(),
      part: part({ states: [], problems: [{ rule: 'LOAD', file: 'x', message: 'boom' }] }),
    });

    expect(frames.map((frame) => [frame.row, frame.label, frame.error])).toEqual([
      [undefined, 'phone', 'boom'],
      [undefined, 'desktop', 'boom'],
    ]);
  });
});
