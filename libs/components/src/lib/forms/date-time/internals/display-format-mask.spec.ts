import { maskPatternFromDisplayFormat } from './display-format-mask';

describe('maskPatternFromDisplayFormat', () => {
  it('derives digit patterns from fixed-width numeric formats', () => {
    expect(maskPatternFromDisplayFormat('dd.MM.yyyy')).toBe('00.00.0000');
    expect(maskPatternFromDisplayFormat('MM/dd/yyyy')).toBe('00/00/0000');
    expect(maskPatternFromDisplayFormat('yyyy-MM-dd')).toBe('0000-00-00');
    expect(maskPatternFromDisplayFormat('HH:mm')).toBe('00:00');
    expect(maskPatternFromDisplayFormat('HH:mm:ss')).toBe('00:00:00');
    expect(maskPatternFromDisplayFormat('hh:mm')).toBe('00:00');
    expect(maskPatternFromDisplayFormat('dd.MM.yy')).toBe('00.00.00');
    expect(maskPatternFromDisplayFormat('dd.MM.yyyy HH:mm')).toBe('00.00.0000 00:00');
    expect(maskPatternFromDisplayFormat('mm:ss.SSS')).toBe('00:00.000');
  });

  it('renders quoted sections as literals', () => {
    expect(maskPatternFromDisplayFormat("yyyy-MM-dd'T'HH:mm")).toBe('0000-00-00T00:00');
    // quoted characters that mean something in the pattern language get escaped
    expect(maskPatternFromDisplayFormat("HH'a'mm")).toBe('00\\a00');
    // '' is date-fns for one literal apostrophe
    expect(maskPatternFromDisplayFormat("HH''mm")).toBe("00'00");
  });

  it('refuses locale formats', () => {
    expect(maskPatternFromDisplayFormat('P')).toBeNull();
    expect(maskPatternFromDisplayFormat('p')).toBeNull();
    expect(maskPatternFromDisplayFormat('Pp')).toBeNull();
    expect(maskPatternFromDisplayFormat('PPpp')).toBeNull();
  });

  it('refuses variable-width and text tokens', () => {
    expect(maskPatternFromDisplayFormat('d.M.yyyy')).toBeNull();
    expect(maskPatternFromDisplayFormat('H:mm')).toBeNull();
    expect(maskPatternFromDisplayFormat('dd MMM yyyy')).toBeNull();
    expect(maskPatternFromDisplayFormat('EEEE, dd.MM.yyyy')).toBeNull();
    expect(maskPatternFromDisplayFormat('hh:mm a')).toBeNull();
    expect(maskPatternFromDisplayFormat('yyy')).toBeNull();
  });

  it('refuses formats without any digit slots and malformed quoting', () => {
    expect(maskPatternFromDisplayFormat('')).toBeNull();
    expect(maskPatternFromDisplayFormat("'literal only'")).toBeNull();
    expect(maskPatternFromDisplayFormat("HH:mm 'unterminated")).toBeNull();
  });
});
