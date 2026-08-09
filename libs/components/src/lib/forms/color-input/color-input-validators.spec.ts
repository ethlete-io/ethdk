import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import '../../../test-helpers';
import { HexColorOptions, RgbColorOptions, hexColor, rgbColor } from './color-input-validators';

const errorsFor = (
  value: string | null,
  apply: (path: Parameters<typeof hexColor>[0]) => void,
): { kind: string; message?: string }[] => {
  const injector = TestBed.inject(Injector);
  const model = signal({ color: value });
  const colorForm = form(model, (s) => apply(s.color), { injector });

  return colorForm
    .color()
    .errors()
    .map((error) => ({ kind: error.kind, message: error.message }));
};

const hexErrors = (value: string | null, options?: HexColorOptions) =>
  errorsFor(value, (path) => hexColor(path, options));
const rgbErrors = (value: string | null, options?: RgbColorOptions) =>
  errorsFor(value, (path) => rgbColor(path, options));

describe('hexColor', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it.each(['#ff0000', '#FF0000', '#000000', '#a1b2c3'])('accepts the strict six-digit form %s', (value) => {
    expect(hexErrors(value)).toEqual([]);
  });

  it.each([null, '', '   '])('accepts a blank value (%s) - requiredness is a separate validator', (value) => {
    expect(hexErrors(value)).toEqual([]);
  });

  it.each(['#f00', '#ff0000cc', 'ff0000', '#ff00', 'red', '#gggggg', '#ff00000'])('rejects %s by default', (value) => {
    expect(hexErrors(value)).toEqual([{ kind: 'hexColor', message: 'Enter a color as #rrggbb' }]);
  });

  it('accepts the shorthand form only when opted in', () => {
    expect(hexErrors('#f00', { allowShorthand: true })).toEqual([]);
    expect(hexErrors('#ff0000', { allowShorthand: true })).toEqual([]);
    expect(hexErrors('#ff0000cc', { allowShorthand: true })[0]?.message).toBe('Enter a color as #rrggbb or #rgb');
  });

  it('accepts an alpha pair only when opted in', () => {
    expect(hexErrors('#ff0000cc', { allowAlpha: true })).toEqual([]);
    expect(hexErrors('#f00c', { allowAlpha: true })[0]?.message).toBe('Enter a color as #rrggbb or #rrggbbaa');
    expect(hexErrors('#f00c', { allowAlpha: true, allowShorthand: true })).toEqual([]);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(hexErrors('  #ff0000  ')).toEqual([]);
  });

  it('uses a custom message when given one', () => {
    expect(hexErrors('nope', { message: 'Brand colors are hex only' })).toEqual([
      { kind: 'hexColor', message: 'Brand colors are hex only' },
    ]);
  });
});

describe('rgbColor', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it.each(['rgb(255 0 0)', 'rgb(255, 0, 0)', 'rgb(0,0,0)', 'RGB( 12 34 56 )'])('accepts %s', (value) => {
    expect(rgbErrors(value)).toEqual([]);
  });

  it.each([null, '', '   '])('accepts a blank value (%s)', (value) => {
    expect(rgbErrors(value)).toEqual([]);
  });

  it.each(['#ff0000', 'rgb(255 0)', 'rgb(1 2 3 4)', 'rgb(256 0 0)', 'rgb(300, 0, 0)', 'hsl(0 100% 50%)'])(
    'rejects %s',
    (value) => {
      expect(rgbErrors(value)).toEqual([{ kind: 'rgbColor', message: 'Enter a color as rgb(r g b)' }]);
    },
  );

  it('rejects an alpha component unless opted in', () => {
    expect(rgbErrors('rgba(255 0 0 / 0.5)')).toEqual([{ kind: 'rgbColor', message: 'Enter a color as rgb(r g b)' }]);
    expect(rgbErrors('rgba(255 0 0 / 0.5)', { allowAlpha: true })).toEqual([]);
    expect(rgbErrors('rgba(255, 0, 0, 50%)', { allowAlpha: true })).toEqual([]);
  });

  it('uses a custom message when given one', () => {
    expect(rgbErrors('nope', { message: 'Use rgb() here' })).toEqual([{ kind: 'rgbColor', message: 'Use rgb() here' }]);
  });
});
