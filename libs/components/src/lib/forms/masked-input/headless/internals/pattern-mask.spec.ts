import { compilePatternMask } from './pattern-mask';

describe('compilePatternMask', () => {
  describe('toRaw', () => {
    it('keeps characters matching the slot classes in sequence', () => {
      const date = compilePatternMask('00-00-0000');

      expect(date.toRaw('31122024')).toBe('31122024');
      expect(date.toRaw('31-12-2024')).toBe('31122024');
      expect(date.toRaw('31.12.2024')).toBe('31122024');
    });

    it('drops characters that do not fit the current slot', () => {
      const mask = compilePatternMask('00a');

      expect(mask.toRaw('1x2y')).toBe('12y');
      expect(mask.toRaw('abc12x')).toBe('12x');
    });

    it('stops once all slots are filled', () => {
      const mask = compilePatternMask('00');

      expect(mask.toRaw('123456')).toBe('12');
    });

    it('supports letter, alphanumeric and optional-digit slots', () => {
      expect(compilePatternMask('aa').toRaw('a1b2')).toBe('ab');
      expect(compilePatternMask('**').toRaw('-a-1-')).toBe('a1');
      expect(compilePatternMask('09').toRaw('12')).toBe('12');
    });

    it('is idempotent', () => {
      const mask = compilePatternMask('(000) 000');
      const raw = mask.toRaw('(123) 456');

      expect(mask.toRaw(raw)).toBe(raw);
    });
  });

  describe('toDisplay', () => {
    const date = compilePatternMask('00-00-0000');

    it('renders slots and literals in pattern order', () => {
      expect(date.toDisplay('31122024')).toBe('31-12-2024');
      expect(date.toDisplay('3112')).toBe('31-12-');
    });

    it('renders literals eagerly so the caret glides onto the next slot', () => {
      expect(date.toDisplay('31')).toBe('31-');
    });

    it('returns an empty display for an empty raw value', () => {
      expect(date.toDisplay('')).toBe('');
      expect(compilePatternMask('(000').toDisplay('')).toBe('');
    });

    it('renders leading literals once content exists', () => {
      expect(compilePatternMask('(000) 000').toDisplay('1')).toBe('(1');
      expect(compilePatternMask('(000) 000').toDisplay('1234')).toBe('(123) 4');
    });

    it('renders trailing literals after the last filled slot', () => {
      expect(compilePatternMask('00 kg').toDisplay('12')).toBe('12 kg');
    });

    it('round-trips through toRaw', () => {
      const iban = compilePatternMask('aa00 0000 0000');

      expect(iban.toRaw(iban.toDisplay('DE12345678'))).toBe('DE12345678');
    });
  });

  describe('escapes and edge cases', () => {
    it('escapes grammar characters into literals', () => {
      const mask = compilePatternMask('\\000');

      expect(mask.toDisplay('12')).toBe('012');
      expect(mask.toRaw('012')).toBe('12');
    });

    it('treats a pattern without slots as a passthrough', () => {
      const mask = compilePatternMask('---');

      expect(mask.toRaw('abc')).toBe('abc');
      expect(mask.toDisplay('abc')).toBe('abc');
    });
  });

  describe('guide display', () => {
    const date = compilePatternMask('00-00', { placeholderChar: '_' });

    it('renders unfilled slots as the placeholder character', () => {
      expect(date.toGuideDisplay!('')).toBe('__-__');
      expect(date.toGuideDisplay!('1')).toBe('1_-__');
      expect(date.toGuideDisplay!('123')).toBe('12-3_');
    });

    it('extracts raw values from guide displays (placeholders are dropped)', () => {
      expect(date.toRaw('12-3_')).toBe('123');
    });

    it('is only provided when a placeholder character is configured', () => {
      expect(compilePatternMask('00-00').toGuideDisplay).toBeUndefined();
    });
  });
});
