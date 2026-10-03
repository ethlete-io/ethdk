import { detectColorNotation, parseColorToRgb } from './color-convert';

describe('parseColorToRgb with invalid input', () => {
  it.each([
    '#',
    '#ab',
    '#abcde',
    '#abcdefg',
    '#ggg',
    '#12345',
    '#1234567',
    '##fff',
    '# fff',
    'fff',
    '#fff;',
    'rgb(256, 0, 0)',
    'rgb(0, 0)',
    'rgb(., ., .)',
    'rgb(0, 0, 0, abc)',
    'hsl(., 50%, 50%)',
    'hsl(10, 101%, 50%)',
    'hsl(10, .%, 50%)',
    'rgba(0, 0, 0, 1.2.3)',
  ])('rejects %j', (value) => {
    expect(parseColorToRgb(value)).toBeNull();
    expect(detectColorNotation(value)).toBeNull();
  });

  it('rejects shorthand and alpha hex when those are turned off', () => {
    expect(parseColorToRgb('#fff', { hexShorthand: false })).toBeNull();
    expect(parseColorToRgb('#ffff', { hexShorthand: true, alpha: false })).toBeNull();
    expect(parseColorToRgb('#ffffff80', { alpha: false })).toBeNull();
  });

  it('reads valid hex regardless of case and surrounding whitespace', () => {
    expect(parseColorToRgb('  #FfA  ')).toEqual({ red: 255, green: 255, blue: 170, alpha: 1 });
    expect(parseColorToRgb('#0000ff80')?.alpha).toBeCloseTo(128 / 255);
    expect(parseColorToRgb('#f008')?.alpha).toBeCloseTo(136 / 255);
  });
});
