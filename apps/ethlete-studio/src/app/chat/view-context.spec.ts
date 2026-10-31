import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { chipOf, lookedAtVariantOf, preambleOf, selectionOf, stateOf } from './view-context';

const frame = (id: string, variant: string | null): CanvasFrame => ({
  id,
  src: '',
  label: id,
  ...(variant === null
    ? { column: 'current' }
    : {
        column: variant,
        place: {
          part: 'components/button',
          state: 'default',
          size: 'fitted',
          sketch: { target: 'components/button', variant },
        },
      }),
});

const FRAMES = [frame('now', null), frame('a1', 'a'), frame('a2', 'a'), frame('b1', 'b')];
const VARIANTS = ['a', 'b'];

describe('lookedAtVariantOf', () => {
  it("takes the selected frame's variant over the one most in view", () => {
    expect(
      lookedAtVariantOf({
        frames: FRAMES,
        selectedId: 'b1',
        areasInView: new Map([['a1', 900]]),
        variants: VARIANTS,
      }),
    ).toBe('b');
  });

  it('takes the variant whose frames fill most of the viewport, summed over its frames', () => {
    expect(
      lookedAtVariantOf({
        frames: FRAMES,
        selectedId: null,
        areasInView: new Map([
          ['now', 5000],
          ['a1', 300],
          ['a2', 300],
          ['b1', 500],
        ]),
        variants: VARIANTS,
      }),
    ).toBe('a');
  });

  it('reads the variant of an in-context frame from its column', () => {
    const inContext = { ...frame('ctx', null), column: 'b' };

    expect(
      lookedAtVariantOf({
        frames: [...FRAMES, inContext],
        selectedId: null,
        areasInView: new Map([['ctx', 100]]),
        variants: VARIANTS,
      }),
    ).toBe('b');
  });

  it('takes the only variant when no variant frame is in view, and none with several', () => {
    const options = { frames: FRAMES, selectedId: null, areasInView: new Map([['now', 100]]) };

    expect(lookedAtVariantOf({ ...options, variants: ['a'] })).toBe('a');
    expect(lookedAtVariantOf({ ...options, variants: VARIANTS })).toBeNull();
  });
});

describe('selectionOf', () => {
  const sketchFrame = (overrides: Partial<CanvasFrame>): CanvasFrame => ({
    id: 'f',
    src: '',
    label: 'desktop',
    column: 'a',
    rowLabel: 'rest',
    place: { part: 'pages/system', state: 'rest', size: 'desktop', sketch: { target: 'pages/system', variant: 'a' } },
    ...overrides,
  });

  it('names a page that shows the sketched part as part, size and context, without repeating them', () => {
    const frame = sketchFrame({
      id: 'ctx',
      column: 'in context a',
      rowLabel: 'in pages/system',
      label: 'pages/system · rest · desktop',
    });

    expect(selectionOf([frame], 'ctx')).toBe('pages/system · desktop (context)');
  });

  it('names a matrix frame as part, size and its state with the interaction', () => {
    const frame = sketchFrame({
      place: { part: 'components/button', state: 'filled', size: 390, interaction: 'hover' },
    });

    expect(selectionOf([frame], 'f')).toBe('components/button · 390 px (filled · hover)');
  });

  it('leaves a repeated name out of a frame without a place', () => {
    const frame: CanvasFrame = { id: 'p', src: '', label: 'rest · desktop', row: 'rest' };

    expect(selectionOf([frame], 'p')).toBe('rest · desktop');
  });
});

describe('stateOf', () => {
  const grid: CanvasFrame = {
    id: 'grid',
    src: '',
    label: 'grid',
    grid: {
      columns: ['rest', 'hover'],
      rows: ['filled'],
      cells: [
        {
          id: 'c1',
          row: 'filled',
          column: 'rest',
          label: 'filled · rest',
          src: '',
          place: { part: 'p', state: 'filled', size: 'fitted' },
        },
        {
          id: 'c2',
          row: 'filled',
          column: 'hover',
          label: 'filled · hover',
          src: '',
          place: { part: 'p', state: 'filled', size: 'fitted', interaction: 'hover' },
        },
      ],
    },
  };

  it('names the state of the clicked cell, with its interaction unless it is rest', () => {
    expect(stateOf([grid], { id: 'grid', cellId: 'c1' })).toBe('filled');
    expect(stateOf([grid], { id: 'grid', cellId: 'c2' })).toBe('filled · hover');
  });

  it('is null without a cell or for a cell the frame does not hold', () => {
    expect(stateOf([grid], { id: 'grid', cellId: null })).toBeNull();
    expect(stateOf([grid], { id: 'grid', cellId: 'nope' })).toBeNull();
    expect(stateOf([grid], { id: null, cellId: 'c1' })).toBeNull();
  });
});

describe('the context line', () => {
  const full = {
    product: 'Kit',
    part: 'components/button',
    partFile: null,
    sketch: null,
    sketchDir: null,
    variant: null,
    picked: null,
    selection: null,
    state: 'filled · hover',
  };

  it('names the state on the chip and the prompt', () => {
    expect(chipOf(full)).toBe('Kit › components/button · state filled · hover');
    expect(preambleOf(full)).toBe('Studio view: product Kit, part components/button, selected state filled · hover.');
  });
});
