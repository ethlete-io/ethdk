import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import '../../../test-helpers';
import { getColorContrastRatio, hexColor, rgbColor } from './color-input-validators';
import { parseColorToRgb } from './headless/internals/color-convert';

const MODES = [
  'picker',
  'hexStrict',
  'hexShorthand',
  'hexAlpha',
  'hexShorthandAlpha',
  'rgb',
  'rgbAlpha',
  'contrast',
] as const;

type Mode = (typeof MODES)[number];

const validatorAccepts = (value: string | null, apply: (path: Parameters<typeof hexColor>[0]) => void) => {
  const injector = TestBed.inject(Injector);
  const model = signal({ color: value });

  return (
    form(model, (s) => apply(s.color), { injector })
      .color()
      .errors().length === 0
  );
};

const acceptedModes = (value: string | null): Mode[] => {
  const accepted: Record<Mode, boolean> = {
    picker: parseColorToRgb(value) !== null,
    hexStrict: validatorAccepts(value, (path) => hexColor(path)),
    hexShorthand: validatorAccepts(value, (path) => hexColor(path, { allowShorthand: true })),
    hexAlpha: validatorAccepts(value, (path) => hexColor(path, { allowAlpha: true })),
    hexShorthandAlpha: validatorAccepts(value, (path) => hexColor(path, { allowShorthand: true, allowAlpha: true })),
    rgb: validatorAccepts(value, (path) => rgbColor(path)),
    rgbAlpha: validatorAccepts(value, (path) => rgbColor(path, { allowAlpha: true })),
    contrast: getColorContrastRatio(value, '#ffffff') !== null,
  };

  return MODES.filter((mode) => accepted[mode]);
};

const HEX_ALL: Mode[] = ['picker', 'hexStrict', 'hexShorthand', 'hexAlpha', 'hexShorthandAlpha', 'contrast'];
const BLANK: Mode[] = ['hexStrict', 'hexShorthand', 'hexAlpha', 'hexShorthandAlpha', 'rgb', 'rgbAlpha'];

const CORPUS: readonly (readonly [value: string | null, accepted: readonly Mode[]])[] = [
  ['#ff0000', HEX_ALL],
  ['#FF0000', HEX_ALL],
  ['  #ff0000  ', HEX_ALL],
  ['#a1b2c3', HEX_ALL],
  ['#f00', ['picker', 'hexShorthand', 'hexShorthandAlpha', 'contrast']],
  ['#F00C', ['picker', 'hexShorthandAlpha', 'contrast']],
  ['#ff00', ['picker', 'hexShorthandAlpha', 'contrast']],
  ['#ff0000cc', ['picker', 'hexAlpha', 'hexShorthandAlpha', 'contrast']],
  ['#ff0000CC', ['picker', 'hexAlpha', 'hexShorthandAlpha', 'contrast']],
  ['ff0000', []],
  ['#ff00000', []],
  ['#gggggg', []],
  ['#', []],
  ['red', []],
  ['transparent', []],
  ['nope', []],
  ['rgb(255 0 0)', ['picker', 'rgb', 'rgbAlpha', 'contrast']],
  ['rgb(255, 0, 0)', ['picker', 'rgb', 'rgbAlpha', 'contrast']],
  ['RGB( 12 34 56 )', ['picker', 'rgb', 'rgbAlpha', 'contrast']],
  ['rgba(1, 2, 3)', ['picker', 'rgb', 'rgbAlpha', 'contrast']],
  ['rgba(255 0 0 / 0.5)', ['picker', 'rgbAlpha', 'contrast']],
  ['rgba(255, 0, 0, 50%)', ['picker', 'rgbAlpha', 'contrast']],
  ['rgb(255 0 0 / 50%)', ['picker', 'rgbAlpha', 'contrast']],
  ['rgba(255 0 0 / 1.5)', ['picker', 'rgbAlpha', 'contrast']],
  ['rgb(1 2 3 / .)', []],
  ['rgb(256 0 0)', []],
  ['rgb(300, 0, 0)', []],
  ['rgb(255 0)', []],
  ['rgb(1 2 3 4)', []],
  ['rgb(100% 0% 0%)', []],
  ['hsl(0 100% 50%)', ['picker']],
  ['hsl(120deg, 100%, 25%)', ['picker']],
  ['hsla(0, 100%, 50%, 50%)', ['picker']],
  ['HSL(0 100% 50%)', ['picker']],
  ['hsl(-30 100% 50%)', ['picker']],
  ['hsl(0, 100, 50)', []],
  ['hsl(0 150% 50%)', []],
  [null, BLANK],
  ['', BLANK],
  ['   ', BLANK],
];

describe('color parsing corpus', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it.each(CORPUS)('%j is accepted by %j', (value, accepted) => {
    expect(acceptedModes(value)).toEqual([...accepted]);
  });
});
