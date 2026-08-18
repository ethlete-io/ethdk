import {
  detectColorNotation,
  formatHsl,
  formatHsvToHex,
  formatHsvToNotation,
  formatRgb,
  formatRgbToHex,
  hslToRgb,
  hsvToRgb,
  hueToCssColor,
  parseColorToHsv,
  parseColorToRgb,
  rgbToHsl,
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

  it.each([null, undefined, '', '   ', '#ff', '#fffff', 'red', 'rgb(256, 0, 0)', 'hsl(0 100 50)'])(
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

describe('hsl', () => {
  it('reads the space form', () => {
    expect(parseColorToRgb('hsl(210 100% 50%)')).toEqual({ red: 0, green: 128, blue: 255, alpha: 1 });
  });

  it('reads the comma form with a deg unit', () => {
    expect(parseColorToRgb('hsl(120deg, 100%, 25%)')).toEqual({ red: 0, green: 128, blue: 0, alpha: 1 });
  });

  it('reads the alpha slash form', () => {
    expect(parseColorToRgb('hsl(0 100% 50% / 0.5)')).toEqual({ red: 255, green: 0, blue: 0, alpha: 0.5 });
  });

  it('reads hsla with a comma alpha', () => {
    expect(parseColorToRgb('hsla(0, 100%, 50%, 50%)')).toEqual({ red: 255, green: 0, blue: 0, alpha: 0.5 });
  });

  it('refuses a saturation above 100%', () => {
    expect(parseColorToRgb('hsl(210 140% 50%)')).toBeNull();
  });

  it('wraps a hue outside the wheel', () => {
    expect(hslToRgb({ hue: -30, saturation: 1, lightness: 0.5, alpha: 1 })).toEqual(
      hslToRgb({ hue: 330, saturation: 1, lightness: 0.5, alpha: 1 }),
    );
  });

  it('round trips a color through rgb', () => {
    const hsl = rgbToHsl({ red: 51, green: 102, blue: 255, alpha: 1 });

    expect(hslToRgb(hsl)).toEqual({ red: 51, green: 102, blue: 255, alpha: 1 });
  });

  it('reports no hue and no saturation for a grey', () => {
    const hsl = rgbToHsl({ red: 128, green: 128, blue: 128, alpha: 1 });

    expect(hsl.hue).toBe(0);
    expect(hsl.saturation).toBe(0);
  });
});

describe('detectColorNotation', () => {
  it.each([
    ['#f00', 'hex'],
    ['#ff0000', 'hex'],
    ['rgb(255 0 0)', 'rgb'],
    ['rgba(255, 0, 0, 0.5)', 'rgb'],
    ['hsl(0 100% 50%)', 'hsl'],
    ['HSLA(0, 100%, 50%, 0.5)', 'hsl'],
  ])('reads %s as %s', (value, notation) => {
    expect(detectColorNotation(value)).toBe(notation);
  });

  it('returns null for a value nothing can read', () => {
    expect(detectColorNotation('rebeccapurple')).toBeNull();
  });

  it('returns null for an empty value', () => {
    expect(detectColorNotation('')).toBeNull();
  });
});

describe('formatRgb', () => {
  it('formats the space form', () => {
    expect(formatRgb({ red: 51, green: 102, blue: 255, alpha: 1 })).toBe('rgb(51 102 255)');
  });

  it('adds alpha when it is on', () => {
    expect(formatRgb({ red: 51, green: 102, blue: 255, alpha: 0.8 }, { alpha: true })).toBe('rgb(51 102 255 / 0.8)');
  });
});

describe('formatHsl', () => {
  it('formats the space form', () => {
    expect(formatHsl({ red: 0, green: 128, blue: 255, alpha: 1 })).toBe('hsl(210 100% 50%)');
  });

  it('adds alpha when it is on', () => {
    expect(formatHsl({ red: 255, green: 0, blue: 0, alpha: 0.5 }, { alpha: true })).toBe('hsl(0 100% 50% / 0.5)');
  });
});

describe('formatHsvToNotation', () => {
  const red = { hue: 0, saturation: 1, value: 1, alpha: 1 };

  it.each([
    ['hex', '#ff0000'],
    ['rgb', 'rgb(255 0 0)'],
    ['hsl', 'hsl(0 100% 50%)'],
  ] as const)('formats %s', (notation, expected) => {
    expect(formatHsvToNotation(red, { notation })).toBe(expected);
  });

  // hsl() rounds its three channels to integers, so a round trip lands within a channel step
  it('reads back what it wrote in every notation', () => {
    const color = { hue: 220, saturation: 0.8, value: 0.9, alpha: 1 };
    const expected = hsvToRgb(color);

    for (const notation of ['hex', 'rgb', 'hsl'] as const) {
      const read = parseColorToRgb(formatHsvToNotation(color, { notation }));

      expect(read?.red).toBeCloseTo(expected.red, -0.5);
      expect(read?.green).toBeCloseTo(expected.green, -0.5);
      expect(read?.blue).toBeCloseTo(expected.blue, -0.5);
    }
  });
});
