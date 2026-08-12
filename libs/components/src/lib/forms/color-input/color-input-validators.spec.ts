import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import '../../../test-helpers';
import { FIELD_WARNINGS } from '../form-field/headless';
import {
  ColorContrastOptions,
  HexColorOptions,
  RgbColorOptions,
  colorContrast,
  getColorContrastRatio,
  hexColor,
  rgbColor,
} from './color-input-validators';

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

const contrastForm = (color: string | null, background: string | null, options: Partial<ColorContrastOptions> = {}) => {
  const injector = TestBed.inject(Injector);
  const model = signal({ color, background });

  return form(
    model,
    (s) => {
      const { against, ...rest } = options;

      colorContrast(s.color, { against: against ?? s.background, ...rest });
    },
    { injector },
  );
};

const contrastErrors = (color: string | null, background: string | null, options?: Partial<ColorContrastOptions>) =>
  contrastForm(color, background, options)
    .color()
    .errors()
    .map((error) => ({ kind: error.kind, message: error.message }));

const contrastWarnings = (color: string | null, background: string | null, options?: Partial<ColorContrastOptions>) =>
  contrastForm(color, background, { ...options, severity: 'warning' })
    .color()
    .metadata(FIELD_WARNINGS)?.();

describe('getColorContrastRatio', () => {
  it('returns 21 for black against white, in either order', () => {
    expect(getColorContrastRatio('#000000', '#ffffff')).toBe(21);
    expect(getColorContrastRatio('#ffffff', '#000000')).toBe(21);
  });

  it('returns 1 for a color against itself', () => {
    expect(getColorContrastRatio('#3366cc', '#3366cc')).toBe(1);
  });

  it('matches the WCAG reference ratio for a mid grey on white', () => {
    expect(getColorContrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it.each([
    ['#f00', '#ff0000'],
    ['rgb(255 0 0)', '#ff0000'],
    ['rgb(255, 0, 0)', '#ff0000'],
    ['  #FF0000  ', '#ff0000'],
  ])('reads %s the same as %s', (notation, canonical) => {
    expect(getColorContrastRatio(notation, '#ffffff')).toBe(getColorContrastRatio(canonical, '#ffffff'));
  });

  it('ignores alpha rather than compositing it', () => {
    expect(getColorContrastRatio('#ff000033', '#ffffff')).toBe(getColorContrastRatio('#ff0000', '#ffffff'));
    expect(getColorContrastRatio('#f00c', '#ffffff')).toBe(getColorContrastRatio('#ff0000', '#ffffff'));
    expect(getColorContrastRatio('rgba(255 0 0 / 0.2)', '#ffffff')).toBe(getColorContrastRatio('#ff0000', '#ffffff'));
  });

  it.each([null, '', '   ', 'red', '#gggggg', '#ff00000', 'hsl(0 100% 50%)', 'rgb(256 0 0)'])(
    'returns null for %s',
    (value) => {
      expect(getColorContrastRatio(value, '#ffffff')).toBeNull();
      expect(getColorContrastRatio('#ffffff', value)).toBeNull();
    },
  );
});

describe('colorContrast', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('reports a pair below the default 4.5:1, naming the measured ratio', () => {
    expect(contrastErrors('#999999', '#ffffff')).toEqual([
      { kind: 'colorContrast', message: 'Contrast is 2.84:1, needs at least 4.5:1' },
    ]);
  });

  it('accepts a pair that reaches the default ratio', () => {
    expect(contrastErrors('#767676', '#ffffff')).toEqual([]);
    expect(contrastErrors('#000000', '#ffffff')).toEqual([]);
  });

  it('honors a custom min', () => {
    expect(contrastErrors('#767676', '#ffffff', { min: 3 })).toEqual([]);
    expect(contrastErrors('#767676', '#ffffff', { min: 7 })).toEqual([
      { kind: 'colorContrast', message: 'Contrast is 4.54:1, needs at least 7:1' },
    ]);
  });

  it('floors the measured ratio so it never reads as meeting the minimum it failed', () => {
    expect(contrastErrors('#0b8855', '#ffffff')).toEqual([
      { kind: 'colorContrast', message: 'Contrast is 4.49:1, needs at least 4.5:1' },
    ]);
  });

  it('takes a min that follows another field', () => {
    const injector = TestBed.inject(Injector);
    const model = signal({ color: '#767676', background: '#ffffff', largeText: false });
    const colorForm = form(
      model,
      (s) =>
        colorContrast(s.color, {
          against: s.background,
          min: ({ valueOf }) => (valueOf(s.largeText) ? 7 : 3),
        }),
      { injector },
    );

    expect(colorForm.color().errors()).toEqual([]);

    colorForm.largeText().value.set(true);

    expect(
      colorForm
        .color()
        .errors()
        .map((error) => ({ kind: error.kind, message: error.message })),
    ).toEqual([{ kind: 'colorContrast', message: 'Contrast is 4.54:1, needs at least 7:1' }]);
  });

  it('measures against a fixed color when given one instead of a path', () => {
    expect(contrastErrors('#999999', null, { against: '#ffffff' })).toEqual([
      { kind: 'colorContrast', message: 'Contrast is 2.84:1, needs at least 4.5:1' },
    ]);
    expect(contrastErrors('#000000', null, { against: '#ffffff' })).toEqual([]);
  });

  it('re-measures when the other field changes', () => {
    const injector = TestBed.inject(Injector);
    const model = signal({ color: '#767676', background: '#ffffff' });
    const colorForm = form(model, (s) => colorContrast(s.color, { against: s.background }), { injector });

    expect(colorForm.color().errors()).toEqual([]);

    colorForm.background().value.set('#8a8a8a');

    expect(
      colorForm
        .color()
        .errors()
        .map((error) => error.kind),
    ).toEqual(['colorContrast']);
  });

  it.each([null, '', '   '])('passes while the field itself is blank (%s)', (value) => {
    expect(contrastErrors(value, '#ffffff')).toEqual([]);
  });

  it.each([null, '', '   '])('passes while the other field is blank (%s)', (value) => {
    expect(contrastErrors('#ffffff', value)).toEqual([]);
  });

  it('passes while either color is unparseable, leaving the format to hexColor', () => {
    expect(contrastErrors('not a color', '#ffffff')).toEqual([]);
    expect(contrastErrors('#ffffff', 'not a color')).toEqual([]);
  });

  it('uses a custom message when given one', () => {
    expect(contrastErrors('#999999', '#ffffff', { message: 'Too pale to read' })).toEqual([
      { kind: 'colorContrast', message: 'Too pale to read' },
    ]);
  });

  it('reports through warn() without touching validity when severity is warning', () => {
    const colorForm = contrastForm('#999999', '#ffffff', { severity: 'warning' });

    expect(colorForm.color().metadata(FIELD_WARNINGS)?.()).toEqual([
      { kind: 'colorContrast', message: 'Contrast is 2.84:1, needs at least 4.5:1' },
    ]);
    expect(colorForm.color().errors()).toEqual([]);
    expect(colorForm.color().valid()).toBe(true);
  });

  it('warns about nothing while the pair is fine', () => {
    expect(contrastWarnings('#000000', '#ffffff')).toEqual([]);
  });
});
