import {
  formatHsvToHex,
  formatRgbToHex,
  hsvToRgb,
  hueToCssColor,
  parseColorToHsv,
  parseColorToRgb,
  rgbToHsv,
} from './color-convert';

describe('parseColorToRgb', () => {
  it('reads the six digit hex form', () => {
    expect(parseColorToRgb('#ff8000')).toEqual({ red: 255, green: 128, blue: 0, alpha: 1 });
  });

  it('reads the three digit hex form by doubling each digit', () => {
    expect(parseColorToRgb('#f80')).toEqual({ red: 255, green: 136, blue: 0, alpha: 1 });
  });

  it('reads the eight digit hex form as a 0-1 alpha', () => {
    expect(parseColorToRgb('#ff000080')).toEqual({ red: 255, green: 0, blue: 0, alpha: 128 / 255 });
  });

  it('reads the four digit hex form', () => {
    expect(parseColorToRgb('#f00c')).toEqual({ red: 255, green: 0, blue: 0, alpha: 204 / 255 });
  });

  it('is case insensitive and tolerates surrounding space', () => {
    expect(parseColorToRgb('  #FF8000  ')).toEqual({ red: 255, green: 128, blue: 0, alpha: 1 });
  });

  it('reads the comma form of rgb()', () => {
    expect(parseColorToRgb('rgb(255, 128, 0)')).toEqual({ red: 255, green: 128, blue: 0, alpha: 1 });
  });

  it('reads the space form with a slash alpha', () => {
    expect(parseColorToRgb('rgb(255 128 0 / 0.5)')).toEqual({ red: 255, green: 128, blue: 0, alpha: 0.5 });
  });

  it('reads a percentage alpha', () => {
    expect(parseColorToRgb('rgba(0, 0, 0, 40%)')).toEqual({ red: 0, green: 0, blue: 0, alpha: 0.4 });
  });

  it('clamps an out of range alpha', () => {
    expect(parseColorToRgb('rgba(0, 0, 0, 4)')?.alpha).toBe(1);
  });

  it.each([null, undefined, '', '   ', '#ff', '#fffff', 'red', 'rgb(256, 0, 0)', 'hsl(0 100% 50%)'])(
    'returns null for %p',
    (value) => {
      expect(parseColorToRgb(value)).toBeNull();
    },
  );
});

describe('rgbToHsv', () => {
  it.each([
    ['red', { red: 255, green: 0, blue: 0 }, 0],
    ['yellow', { red: 255, green: 255, blue: 0 }, 60],
    ['green', { red: 0, green: 255, blue: 0 }, 120],
    ['cyan', { red: 0, green: 255, blue: 255 }, 180],
    ['blue', { red: 0, green: 0, blue: 255 }, 240],
    ['magenta', { red: 255, green: 0, blue: 255 }, 300],
  ])('puts %s at hue %p', (_name, channels, hue) => {
    expect(rgbToHsv({ ...channels, alpha: 1 }).hue).toBeCloseTo(hue, 5);
  });

  it('reports white as unsaturated and fully bright', () => {
    expect(rgbToHsv({ red: 255, green: 255, blue: 255, alpha: 1 })).toEqual({
      hue: 0,
      saturation: 0,
      value: 1,
      alpha: 1,
    });
  });

  it('reports black as unsaturated and dark', () => {
    expect(rgbToHsv({ red: 0, green: 0, blue: 0, alpha: 1 })).toEqual({ hue: 0, saturation: 0, value: 0, alpha: 1 });
  });

  it('carries alpha through untouched', () => {
    expect(rgbToHsv({ red: 10, green: 20, blue: 30, alpha: 0.25 }).alpha).toBe(0.25);
  });
});

describe('hsvToRgb', () => {
  it('normalizes a hue past the end of the wheel', () => {
    expect(hsvToRgb({ hue: 360, saturation: 1, value: 1, alpha: 1 })).toEqual({
      red: 255,
      green: 0,
      blue: 0,
      alpha: 1,
    });
  });

  it('normalizes a negative hue', () => {
    expect(hsvToRgb({ hue: -60, saturation: 1, value: 1, alpha: 1 })).toEqual({
      red: 255,
      green: 0,
      blue: 255,
      alpha: 1,
    });
  });

  it('clamps saturation, value and alpha', () => {
    expect(hsvToRgb({ hue: 0, saturation: 2, value: 2, alpha: 2 })).toEqual({
      red: 255,
      green: 0,
      blue: 0,
      alpha: 1,
    });
  });

  it('keeps the hue out of the result when value is zero', () => {
    expect(hsvToRgb({ hue: 200, saturation: 1, value: 0, alpha: 1 })).toEqual({
      red: 0,
      green: 0,
      blue: 0,
      alpha: 1,
    });
  });
});

describe('rgb to hsv and back', () => {
  it('round-trips every channel combination on a coarse grid without drift', () => {
    const steps = [0, 1, 17, 64, 128, 129, 200, 254, 255];

    for (const red of steps) {
      for (const green of steps) {
        for (const blue of steps) {
          const rgb = { red, green, blue, alpha: 1 };

          expect(hsvToRgb(rgbToHsv(rgb))).toEqual(rgb);
        }
      }
    }
  });
});

describe('formatRgbToHex', () => {
  it('formats lowercase and pads single digits', () => {
    expect(formatRgbToHex({ red: 0, green: 10, blue: 255, alpha: 1 })).toBe('#000aff');
  });

  it('omits alpha unless asked', () => {
    expect(formatRgbToHex({ red: 255, green: 0, blue: 0, alpha: 0.5 })).toBe('#ff0000');
  });

  it('appends alpha when asked', () => {
    expect(formatRgbToHex({ red: 255, green: 0, blue: 0, alpha: 0.8 }, { alpha: true })).toBe('#ff0000cc');
  });

  it('writes a fully opaque alpha as ff', () => {
    expect(formatRgbToHex({ red: 0, green: 0, blue: 0, alpha: 1 }, { alpha: true })).toBe('#000000ff');
  });
});

describe('parseColorToHsv', () => {
  it('returns null for an unparseable value', () => {
    expect(parseColorToHsv('nope')).toBeNull();
  });

  it('reads a functional notation into hsv', () => {
    const hsv = parseColorToHsv('rgb(0 128 255)');

    expect(hsv?.hue).toBeCloseTo(210, 0);
    expect(hsv?.value).toBeCloseTo(1, 5);
  });
});

describe('formatHsvToHex', () => {
  it('formats through rgb', () => {
    expect(formatHsvToHex({ hue: 120, saturation: 1, value: 1, alpha: 1 })).toBe('#00ff00');
  });
});

describe('hueToCssColor', () => {
  it('names the fully saturated color at the hue', () => {
    expect(hueToCssColor(210)).toBe('hsl(210 100% 50%)');
  });

  it('wraps a hue outside the wheel', () => {
    expect(hueToCssColor(-30)).toBe('hsl(330 100% 50%)');
  });
});
