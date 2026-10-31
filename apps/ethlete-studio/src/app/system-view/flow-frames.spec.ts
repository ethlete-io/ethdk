import { ListedFlow } from '../../host/design-flows';
import { ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import { flowFramesOf, flowKeyOf, withFlowGroup } from './flow-frames';

const part = (layer: string, name: string, states: string[]): ListedPart => ({
  layer,
  name,
  origin: 'product',
  note: null,
  states,
  problems: [],
});

const product: ListedProduct = {
  name: 'shop',
  base: null,
  presets: { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } },
  parts: [part('pages', 'cart', ['filled', 'checkout']), part('elements', 'toast', ['saved'])],
  problems: [],
};

const flow: ListedFlow = {
  name: 'checkout',
  file: '.ethlete/design/shop/flows/checkout.json',
  frames: [
    { part: 'pages/cart', state: 'filled' },
    { part: 'pages/cart', state: 'checkout', position: { x: 900, y: 0 } },
    { part: 'elements/toast', state: 'saved' },
    { part: 'pages/cart', state: 'gone' },
  ],
  lines: [
    { from: { part: 'pages/cart', state: 'filled' }, to: { part: 'pages/cart', state: 'checkout' }, label: 'pay' },
  ],
  notes: [],
  problems: [],
};

describe('flowFramesOf', () => {
  it('draws each state of the flow at the picked preset, with the lines between them', () => {
    const { frames, lines } = flowFramesOf({ port: 4500, product, flow, preset: 'desktop' });

    expect(frames.map(({ id, width, height, at, error }) => ({ id, width, height, at, error }))).toEqual([
      { id: 'pages/cart filled', width: 1280, height: 800, at: undefined, error: undefined },
      { id: 'pages/cart checkout', width: 1280, height: 800, at: { x: 900, y: 0 }, error: undefined },
      { id: 'elements/toast saved', width: 1280, height: undefined, at: undefined, error: undefined },
      { id: 'pages/cart gone', width: 1280, height: 800, at: undefined, error: 'pages/cart has no state "gone"' },
    ]);
    expect(frames[0]?.screenshot).toContain('preset=desktop');
    expect(lines).toEqual([{ from: 'pages/cart filled', to: 'pages/cart checkout', label: 'pay' }]);
    expect(frames[2]?.place).toEqual({ part: 'elements/toast', state: 'saved', size: 'desktop' });
    expect(frames.every((frame) => frame.schemes?.join() === 'light,dark')).toBe(true);
    expect(flowFramesOf({ port: 4500, product, flow, preset: 'phone' }).frames[0]).toMatchObject({
      width: 390,
      height: 844,
    });
  });
});

describe('flowFramesOf with a sketch-only page', () => {
  const sketch = (variants: string[]): ListedSketch => ({
    target: 'pages/pay',
    status: 'in progress',
    createdAt: '2026-10-27T00:00:00.000Z',
    product: 'shop',
    layer: 'pages',
    name: 'pay',
    dir: '.ethlete/design/shop/sketches/pages-pay',
    variants,
    problems: [],
    targets: variants.map((variant) => ({ variant, states: variant === 'a' ? ['open'] : ['other'] })),
  });
  const paying: ListedFlow = {
    ...flow,
    frames: [
      { part: 'pages/pay', state: 'open' },
      { part: 'pages/pay', state: 'closed' },
    ],
    lines: [],
  };

  it('draws the first variant of the open sketch at the page size', () => {
    const { frames } = flowFramesOf({
      port: 4500,
      product,
      flow: paying,
      preset: 'desktop',
      sketches: [sketch(['a', 'b'])],
    });

    expect(frames.map(({ id, width, height, error }) => ({ id, width, height, error }))).toEqual([
      { id: 'pages/pay open', width: 1280, height: 800, error: undefined },
      { id: 'pages/pay closed', width: 1280, height: 800, error: 'pages/pay has no state "closed"' },
    ]);
    expect(frames[0]?.src).toContain('&sketch=pages%2Fpay&variant=a');
    expect(frames[0]?.screenshot).toContain('&sketch=pages%2Fpay&variant=a');
  });

  it('still fails a part with neither a part nor a sketch', () => {
    const { frames } = flowFramesOf({ port: 4500, product, flow: paying, preset: 'desktop', sketches: [] });

    expect(frames[0]?.error).toBe('no part pages/pay');
  });
});

describe('withFlowGroup', () => {
  it('puts a Flows group before the sketches, with an error badge on a flow with problems', () => {
    const tree = withFlowGroup(
      [
        { key: 'pages', label: 'Pages', entries: [] },
        { key: 'sketches', label: 'Sketches', entries: [] },
      ],
      [flow, { ...flow, name: 'broken', problems: [{ rule: 'FLOW', file: flow.file, message: 'x' }] }],
    );

    expect(tree.map((group) => group.key)).toEqual(['pages', 'flows', 'sketches']);
    expect(tree[1]?.entries.map(({ key, badges }) => ({ key, badges }))).toEqual([
      { key: flowKeyOf('checkout'), badges: [] },
      { key: flowKeyOf('broken'), badges: ['error'] },
    ]);
  });
});
