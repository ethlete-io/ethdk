import { deriveDurationFormatSpec, formatDuration, parseDuration } from './duration-format';

describe('duration-format', () => {
  describe('deriveDurationFormatSpec', () => {
    it('parses a mm:ss layout', () => {
      const spec = deriveDurationFormatSpec('mm:ss');

      expect(spec.segments).toEqual([
        { unit: 'm', width: 2 },
        { unit: 's', width: 2 },
      ]);
      expect(spec.separators).toEqual([':']);
    });

    it('parses hh:mm:ss.SSS with millis', () => {
      const spec = deriveDurationFormatSpec('hh:mm:ss.SSS');

      expect(spec.segments).toEqual([
        { unit: 'h', width: 2 },
        { unit: 'm', width: 2 },
        { unit: 's', width: 2 },
        { unit: 'ms', width: 3 },
      ]);
      expect(spec.separators).toEqual([':', ':', '.']);
    });

    it('parses word separators (h m)', () => {
      const spec = deriveDurationFormatSpec('h m');

      expect(spec.segments).toEqual([
        { unit: 'h', width: 1 },
        { unit: 'm', width: 1 },
      ]);
      expect(spec.separators).toEqual([' ']);
    });
  });

  describe('formatDuration', () => {
    const mmss = deriveDurationFormatSpec('mm:ss');
    const hhmmss = deriveDurationFormatSpec('hh:mm:ss');
    const withMillis = deriveDurationFormatSpec('mm:ss.SSS');

    it('formats null as empty', () => {
      expect(formatDuration(null, mmss)).toBe('');
    });

    it('splits and zero-pads each segment', () => {
      expect(formatDuration(90_000, mmss)).toBe('01:30');
      expect(formatDuration(0, mmss)).toBe('00:00');
      expect(formatDuration(3_661_000, hhmmss)).toBe('01:01:01');
    });

    it('leaves the largest unit unbounded', () => {
      expect(formatDuration(6_000_000, mmss)).toBe('100:00');
    });

    it('formats milliseconds zero-padded to width', () => {
      expect(formatDuration(90_500, withMillis)).toBe('01:30.500');
      expect(formatDuration(90_005, withMillis)).toBe('01:30.005');
    });
  });

  describe('parseDuration', () => {
    const mmss = deriveDurationFormatSpec('mm:ss');
    const hhmmss = deriveDurationFormatSpec('hh:mm:ss');
    const withMillis = deriveDurationFormatSpec('ss.SSS');

    it('parses separator entry left-to-right', () => {
      expect(parseDuration('1:30', mmss)).toBe(90_000);
      expect(parseDuration('01:30', mmss)).toBe(90_000);
      expect(parseDuration('1:02:03', hhmmss)).toBe(3_723_000);
    });

    it('maps a short separated entry onto the trailing segments', () => {
      expect(parseDuration('2:03', hhmmss)).toBe(123_000); // m:ss → 2min 3s
    });

    it('consumes a bare digit run from the right (smallest unit first)', () => {
      expect(parseDuration('130', mmss)).toBe(90_000); // 1:30
      expect(parseDuration('90', mmss)).toBe(90_000); // 0:90 → 90s
      expect(parseDuration('12345', hhmmss)).toBe(5_025_000); // 1:23:45
    });

    it('piles leftover digits onto the largest unit', () => {
      expect(parseDuration('12345', mmss)).toBe(7_425_000); // 123:45
    });

    it('parses milliseconds literally', () => {
      expect(parseDuration('30.500', withMillis)).toBe(30_500);
      expect(parseDuration('30.5', withMillis)).toBe(30_005);
    });

    it('returns null for empty or non-numeric input', () => {
      expect(parseDuration('', mmss)).toBeNull();
      expect(parseDuration('   ', mmss)).toBeNull();
      expect(parseDuration('abc', mmss)).toBeNull();
    });

    it('round-trips through formatDuration', () => {
      for (const ms of [0, 90_000, 3_723_000, 6_000_000]) {
        expect(parseDuration(formatDuration(ms, hhmmss), hhmmss)).toBe(ms);
      }
    });
  });
});
