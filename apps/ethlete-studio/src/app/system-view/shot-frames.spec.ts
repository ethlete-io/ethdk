import { describe, expect, it } from 'vitest';
import { ShotFrame } from '../../host/design';
import { rowWidthOf, shotSizesOf } from './shot-frames';
import { CURRENT, SketchRowOf } from './system-tree';

const shotOf = (state: string, size?: string, inherited?: true) => ({
  state: size ? `${state} · ${size}` : state,
  changed: null,
  src: '',
  picture: '',
  place: { state, ...(size ? { size } : {}) },
  ...(inherited ? { inherited } : {}),
});

const frameOf = (variant: string | null, state: string, width: number, extra: Partial<ShotFrame> = {}): ShotFrame => ({
  part: 'components/title-card',
  variant,
  state,
  preset: null,
  width: null,
  frame: { width, height: 200 },
  ...extra,
});

describe('shotSizesOf', () => {
  it('sizes each shot from its listed frame before a live frame reports, an inherited one from the product', () => {
    const rows: SketchRowOf[] = [
      { key: CURRENT, width: null, shots: [shotOf('default')] },
      { key: 'a', width: null, shots: [shotOf('default'), shotOf('old', undefined, true), shotOf('new')] },
    ];
    const frames = [
      frameOf(null, 'default', 120),
      frameOf(null, 'old', 110),
      frameOf('a', 'default', 151),
      frameOf('a', 'new', 140),
    ];

    expect(shotSizesOf({ rows, part: 'components/title-card', frames, live: {} })).toEqual({
      'current default': { width: 120, height: 200 },
      'a default': { width: 151, height: 200 },
      'a old': { width: 110, height: 200 },
      'a new': { width: 140, height: 200 },
    });
  });

  it('takes each side a live frame reports over the listed one, and a frame per declared width or preset', () => {
    const rows: SketchRowOf[] = [
      { key: 'a', width: null, shots: [shotOf('default', '320'), shotOf('default', '768')] },
    ];
    const frames = [
      frameOf('a', 'default', 320, { width: 320 }),
      frameOf('a', 'default', 768, { width: 768 }),
      frameOf('a', 'default', 999, { part: 'components/other' }),
    ];

    expect(
      shotSizesOf({ rows, part: 'components/title-card', frames, live: { 'a default · 768': { height: 90 } } }),
    ).toEqual({ 'a default · 320': { width: 320, height: 200 }, 'a default · 768': { width: 768, height: 90 } });
  });

  it('sizes a listed shot of the zoom-chip row the listing misses a shot of, and holds that row at the part width until every shot has one', () => {
    const current: SketchRowOf = { key: CURRENT, width: null, shots: [shotOf('reset'), shotOf('reset-focus-visible')] };
    const a: SketchRowOf = { key: 'a', width: null, shots: [shotOf('reset'), shotOf('reset-focus-visible')] };
    const rows = [current, a];
    const frames = [frameOf(null, 'reset', 202), frameOf('a', 'reset', 202), frameOf('a', 'reset-focus-visible', 230)];
    const listed = shotSizesOf({ rows, part: 'components/title-card', frames, live: {} });
    const reported = shotSizesOf({
      rows,
      part: 'components/title-card',
      frames,
      live: { 'current reset': { width: 202, height: 62 }, 'current reset-focus-visible': { width: 228, height: 117 } },
    });

    expect(listed['current reset']).toEqual({ width: 202, height: 200 });
    expect(rowWidthOf({ row: current, sizes: listed, fallback: 230 })).toBe(230);
    expect(rowWidthOf({ row: a, sizes: listed, fallback: 230 })).toBe(230);
    expect(reported['current reset']?.width).toBe(listed['current reset']?.width);
    expect(rowWidthOf({ row: current, sizes: reported, fallback: 230 })).toBe(228);
  });
});
