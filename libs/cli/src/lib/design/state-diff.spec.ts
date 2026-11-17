import { describe, expect, it, vi } from 'vitest';
import { PictureOf } from './merge-compare';
import { stateDiffOf } from './state-diff';
import { BoxOf } from './variant-diff';

const pngOf = (text: string, width: number) => {
  const header = Buffer.alloc(24);

  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(40, 20);

  return Buffer.concat([header, Buffer.from(text)]);
};

const pictureOf = vi.fn<PictureOf>(async ({ state, interaction }) => ({
  png: pngOf(`${state}:${interaction ?? 'rest'}`, state === 'open' ? 200 : 120),
  marks: [],
}));

const boxOf = vi.fn<BoxOf>(async (before, after) =>
  before.equals(after)
    ? []
    : [
        { x: 10, y: 4, width: 20, height: 8 },
        { x: 100, y: 20, width: 40, height: 10 },
      ],
);

const diffOf = (state: string, interaction: string | null) =>
  stateDiffOf({
    product: 'studio',
    part: 'components/hold-trigger',
    state,
    interaction,
    base: 'closed',
    preset: null,
    width: null,
    params: new URLSearchParams('fill=surface'),
    pictureOf,
    boxOf,
  });

describe('stateDiffOf', () => {
  it('marks nothing on the base state at rest and draws it once', async () => {
    pictureOf.mockClear();

    expect(await diffOf('closed', null)).toEqual({ box: null, frame: { width: 120, height: 40 } });
    expect(pictureOf).toHaveBeenCalledTimes(1);
  });

  it('answers the box around every changed pixel of an interaction against the base at rest', async () => {
    pictureOf.mockClear();

    expect(await diffOf('closed', 'hover')).toEqual({
      box: { x: 10, y: 4, width: 130, height: 26 },
      frame: { width: 120, height: 40 },
    });
    expect(pictureOf.mock.calls.map(([asked]) => [asked.state, asked.interaction])).toEqual([
      ['closed', null],
      ['closed', 'hover'],
    ]);
  });

  it('answers the frame of the state it draws when that state is larger than the base', async () => {
    expect(await diffOf('open', null)).toMatchObject({ frame: { width: 200, height: 40 } });
  });

  it('passes the theme params to both pictures', async () => {
    pictureOf.mockClear();
    await diffOf('open', 'focus-visible');

    expect(pictureOf.mock.calls.every(([asked]) => asked.params.get('fill') === 'surface')).toBe(true);
  });
});
