import { describe, expect, it } from 'vitest';
import { frameSizesOf } from '../studio-view/remembered';
import { shotSizesOf, storedShotSizesWith } from './shot-sizes';

const CAMERA = 'sketch:components/title-card';

describe('shot sizes', () => {
  it('gives a reopened sketch the sizes its shots loaded at, under the ones that load again', () => {
    const remembered = storedShotSizesWith({
      stored: { 'other a default': { width: 900 } },
      cameraKey: CAMERA,
      kind: 'picture',
      live: { 'a default': { width: 151, height: 223 }, 'b default': { width: 219, height: 155 } },
    });
    const stored = frameSizesOf(remembered, CAMERA);

    expect(remembered['other a default']).toEqual({ width: 900 });
    expect(shotSizesOf({ stored, kind: 'picture', live: {} })).toEqual({
      'a default': { width: 151, height: 223 },
      'b default': { width: 219, height: 155 },
    });
    expect(shotSizesOf({ stored, kind: 'picture', live: { 'b default': { height: 160 } } })['b default']).toEqual({
      width: 219,
      height: 160,
    });
  });

  it('keeps frame and picture sizes of one shot apart', () => {
    const stored = { 'sketch-frame a default': { height: 300 }, 'sketch-picture a default': { width: 10, height: 20 } };

    expect(shotSizesOf({ stored, kind: 'frame', live: {} })).toEqual({ 'a default': { height: 300 } });
    expect(shotSizesOf({ stored, kind: 'picture', live: {} })).toEqual({ 'a default': { width: 10, height: 20 } });
  });
});
