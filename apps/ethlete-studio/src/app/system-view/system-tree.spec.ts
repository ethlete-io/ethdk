import { ListedPart, ListedProduct } from '../../host/design';
import { framesOf, treeOf } from './system-tree';

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
