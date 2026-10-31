import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { lookedAtVariantOf } from './view-context';

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
