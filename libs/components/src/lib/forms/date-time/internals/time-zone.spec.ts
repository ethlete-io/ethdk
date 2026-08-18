import {
  formatInZone,
  instantFromZonedFields,
  isValidTimeZone,
  localReading,
  parseInZone,
  reinterpretInZone,
  timeZoneDisplayName,
  zonedFields,
  zonedProxy,
} from './time-zone';

const ISO_FORMAT = "yyyy-MM-dd'T'HH:mm:ssxxx";
const TOKYO = 'Asia/Tokyo';

/** 2026-08-18T14:00 in Tokyo. */
const INSTANT = new Date('2026-08-18T05:00:00.000Z');

describe('timeZoneDisplayName', () => {
  it('takes the last segment of an IANA name', () => {
    expect(timeZoneDisplayName(TOKYO)).toBe('Tokyo');
  });

  it('turns underscores into spaces', () => {
    expect(timeZoneDisplayName('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  });
});

describe('isValidTimeZone', () => {
  it('accepts an IANA name', () => {
    expect(isValidTimeZone(TOKYO)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidTimeZone('Middle/Earth')).toBe(false);
  });
});

describe('zonedFields', () => {
  it('reads the wall clock the zone shows at that instant', () => {
    expect(zonedFields(INSTANT, TOKYO)).toEqual({
      year: 2026,
      month: 7,
      day: 18,
      hours: 14,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    });
  });
});

describe('instantFromZonedFields', () => {
  it('is the inverse of zonedFields', () => {
    expect(instantFromZonedFields(zonedFields(INSTANT, TOKYO), TOKYO).getTime()).toBe(INSTANT.getTime());
  });

  it('resolves a wall clock a daylight-saving jump skipped forward', () => {
    const skipped = { year: 2026, month: 2, day: 8, hours: 2, minutes: 30, seconds: 0, milliseconds: 0 };
    const existing = { ...skipped, hours: 3 };

    expect(instantFromZonedFields(skipped, 'America/New_York').getTime()).toBe(
      instantFromZonedFields(existing, 'America/New_York').getTime(),
    );
  });
});

describe('formatInZone', () => {
  it('writes the zone wall clock and the zone offset', () => {
    expect(formatInZone(INSTANT, { format: ISO_FORMAT, timeZone: TOKYO })).toBe('2026-08-18T14:00:00+09:00');
  });

  it('falls back to the runtime zone when no zone is set', () => {
    expect(formatInZone(INSTANT, { format: ISO_FORMAT, timeZone: null })).toBe(
      formatInZone(INSTANT, { format: ISO_FORMAT, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    );
  });
});

describe('parseInZone', () => {
  it('reads a wall clock in the given zone', () => {
    expect(parseInZone('2026-08-18 14:00', { format: 'yyyy-MM-dd HH:mm', timeZone: TOKYO })?.toISOString()).toBe(
      '2026-08-18T05:00:00.000Z',
    );
  });

  it('returns null for text that does not parse', () => {
    expect(parseInZone('nonsense', { format: 'yyyy-MM-dd HH:mm', timeZone: TOKYO })).toBeNull();
  });

  it('round trips through formatInZone', () => {
    const wire = formatInZone(INSTANT, { format: ISO_FORMAT, timeZone: TOKYO }) as string;

    expect(parseInZone(wire, { format: ISO_FORMAT, timeZone: null })?.getTime()).toBe(INSTANT.getTime());
  });
});

describe('reinterpretInZone', () => {
  it('keeps the wall-clock parts and moves the instant', () => {
    const local = new Date(2026, 7, 18, 14, 0, 0, 0);

    expect(reinterpretInZone(local, TOKYO).getTime()).toBe(INSTANT.getTime());
  });

  it('returns the date untouched when no zone is set', () => {
    const local = new Date(2026, 7, 18, 14, 0, 0, 0);

    expect(reinterpretInZone(local, null)).toBe(local);
  });
});

describe('zonedProxy', () => {
  it('carries the zone wall clock on a runtime-local date', () => {
    const proxy = zonedProxy(INSTANT, TOKYO);

    expect([proxy.getFullYear(), proxy.getMonth(), proxy.getDate(), proxy.getHours()]).toEqual([2026, 7, 18, 14]);
  });
});

describe('localReading', () => {
  const options = { format: 'HH:mm', timeZone: TOKYO };

  it('gives the runtime-zone wall clock when the two readings differ', () => {
    const reading = localReading(INSTANT, options);

    expect(reading).not.toBeNull();
    expect(reading).not.toBe('14:00');
  });

  it('gives null when the field zone is the runtime zone', () => {
    expect(
      localReading(INSTANT, { ...options, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    ).toBeNull();
  });

  it('gives null without a value or a zone', () => {
    expect(localReading(null, options)).toBeNull();
    expect(localReading(INSTANT, { ...options, timeZone: null })).toBeNull();
  });
});

describe('localReading day handling', () => {
  const RUNTIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const options = { format: 'MM/dd/yyyy, HH:mm', timeZone: RUNTIME_ZONE === 'Asia/Tokyo' ? 'Europe/Berlin' : TOKYO };

  it('drops the date while both zones land on the same day', () => {
    const reading = localReading(INSTANT, options) as string;

    expect(reading).not.toBeNull();
    expect(reading).not.toContain('/');
  });

  it('keeps the date once the reader is on another day', () => {
    // whichever zone the runtime is in, some hour of the day puts it on a different date than the
    // field's zone - that is the hour the date has to survive on
    const base = new Date('2026-08-18T00:00:00.000Z').getTime();
    const crossing = Array.from({ length: 24 }, (_, hour) => new Date(base + hour * 3_600_000)).find(
      (candidate) => zonedFields(candidate, options.timeZone).day !== candidate.getDate(),
    );

    expect(crossing).toBeDefined();
    expect(localReading(crossing as Date, options)).toContain('/');
  });
});
