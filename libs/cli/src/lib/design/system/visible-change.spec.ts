import { describe, expect, it } from 'vitest';
import { encodePng, Pixels } from './part-compare';
import { deviationOf, PartDiff, sketchedPartsOf, stateDiffOf, visibleChangeVerdictOf } from './visible-change';

const RED = 0xff0000ff;
const BLUE = 0x0000ffff;

const pngOf = (width: number, height: number, colour: (x: number, y: number) => number) => {
  const pixels: Pixels = { width, height, data: Buffer.alloc(width * height * 4) };

  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) pixels.data.writeUInt32BE(colour(x, y), (y * width + x) * 4);

  return encodePng(pixels);
};

const design = pngOf(4, 1, () => BLUE);
const twoOff = pngOf(4, 1, (x) => (x < 2 ? RED : BLUE));
const oneOff = pngOf(4, 1, (x) => (x < 1 ? RED : BLUE));

const diffOf = (states: PartDiff['states']): PartDiff => ({ part: 'components/chip', states });

describe('deviationOf', () => {
  it('counts the differing pixels, and on a size mismatch the pixels outside the shared area too', () => {
    expect(deviationOf({ design, app: design })).toBe(0);
    expect(deviationOf({ design, app: twoOff })).toBe(2);
    expect(deviationOf({ design, app: pngOf(4, 2, () => BLUE) })).toBe(4);
  });
});

describe('stateDiffOf', () => {
  it('is the same when base and HEAD draw the app alike', () => {
    expect(
      stateDiffOf({ base: { state: 's', design, app: oneOff }, head: { state: 's', design, app: oneOff } }),
    ).toEqual({ state: 's', kind: 'same' });
  });

  it("measures both app pictures against HEAD's design when they differ", () => {
    expect(
      stateDiffOf({ base: { state: 's', design, app: twoOff }, head: { state: 's', design, app: oneOff } }),
    ).toMatchObject({ state: 's', kind: 'differs', base: 2, head: 1 });
  });

  it('is new without a base picture, broken when only HEAD fails to draw, and unjudged when both fail', () => {
    expect(stateDiffOf({ base: null, head: { state: 's', design, app: oneOff } })).toEqual({ state: 's', kind: 'new' });
    expect(stateDiffOf({ base: { state: 's', design, app: oneOff }, head: { state: 's', problem: 'boom' } })).toEqual({
      state: 's',
      kind: 'broken',
      problem: 'boom',
    });
    expect(stateDiffOf({ base: { state: 's', problem: 'old' }, head: { state: 's', problem: 'boom' } })).toEqual({
      state: 's',
      kind: 'unjudged',
      problem: 'boom',
    });
    expect(stateDiffOf({ base: { state: 's', problem: 'old' }, head: { state: 's', design, app: oneOff } })).toEqual({
      state: 's',
      kind: 'new',
    });
  });
});

describe('sketchedPartsOf', () => {
  const sketch = (value: object) => JSON.stringify(value);

  it('takes every target of a picked sketch', () => {
    expect(
      sketchedPartsOf([
        {
          text: sketch({
            target: 'pages/system',
            targets: ['pages/system', 'pages/sketches'],
            decision: { kind: 'pick' },
          }),
          merged: false,
        },
      ]),
    ).toEqual(new Set(['pages/system', 'pages/sketches']));
  });

  it('takes the target of a sketch deleted by a merge, and skips open, discarded and unreadable ones', () => {
    expect(
      sketchedPartsOf([
        { text: sketch({ target: 'components/chip' }), merged: true },
        { text: sketch({ target: 'components/card' }), merged: false },
        { text: sketch({ target: 'components/badge', decision: { kind: 'discard' } }), merged: false },
        { text: '{', merged: true },
      ]),
    ).toEqual(new Set(['components/chip']));
  });
});

describe('visibleChangeVerdictOf', () => {
  it('passes a part whose app renders alike at base and HEAD', () => {
    expect(
      visibleChangeVerdictOf({ diff: diffOf([{ state: 'idle', kind: 'same' }]), sketched: new Set() }),
    ).toMatchObject({ pass: true, why: 'invisible', changed: [] });
  });

  it('fails a visible change without a sketch, and passes it with a picked or merged sketch of the part', () => {
    const diff = diffOf([
      { state: 'idle', kind: 'same' },
      { state: 'hover', kind: 'differs', base: 3, head: 5, diff: design },
    ]);

    expect(visibleChangeVerdictOf({ diff, sketched: new Set(['components/card']) })).toMatchObject({
      pass: false,
      why: 'visible',
      changed: ['hover'],
    });
    expect(visibleChangeVerdictOf({ diff, sketched: new Set(['components/chip']) })).toMatchObject({
      pass: true,
      why: 'sketched',
    });
  });

  it('passes a change that moves every changed state closer to the design, and fails when one moves away or stays', () => {
    const closer = diffOf([
      { state: 'idle', kind: 'differs', base: 10, head: 0, diff: design },
      { state: 'hover', kind: 'differs', base: 4, head: 3, diff: design },
    ]);

    expect(visibleChangeVerdictOf({ diff: closer, sketched: new Set() })).toMatchObject({ pass: true, why: 'closer' });
    expect(
      visibleChangeVerdictOf({
        diff: diffOf([...closer.states, { state: 'focus', kind: 'differs', base: 4, head: 4, diff: design }]),
        sketched: new Set(),
      }),
    ).toMatchObject({ pass: false, why: 'visible', changed: ['idle', 'hover', 'focus'] });
  });

  it('needs a sketch for a state the base app could not draw', () => {
    expect(
      visibleChangeVerdictOf({ diff: diffOf([{ state: 'idle', kind: 'new' }]), sketched: new Set() }),
    ).toMatchObject({ pass: false, why: 'visible' });
    expect(
      visibleChangeVerdictOf({
        diff: diffOf([{ state: 'idle', kind: 'new' }]),
        sketched: new Set(['components/chip']),
      }),
    ).toMatchObject({ pass: true, why: 'sketched' });
  });

  it('fails a state HEAD can no longer draw even with a sketch, and lets a state neither side draws pass', () => {
    expect(
      visibleChangeVerdictOf({
        diff: diffOf([{ state: 'idle', kind: 'broken', problem: 'boom' }]),
        sketched: new Set(['components/chip']),
      }),
    ).toMatchObject({ pass: false, why: 'broken', changed: ['idle'] });
    expect(
      visibleChangeVerdictOf({
        diff: diffOf([{ state: 'idle', kind: 'unjudged', problem: 'slots' }]),
        sketched: new Set(),
      }),
    ).toMatchObject({ pass: true, why: 'invisible', unjudged: ['idle'] });
  });
});
