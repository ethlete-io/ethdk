export type DurationUnit = 'h' | 'm' | 's' | 'ms';

export type DurationSegment = {
  unit: DurationUnit;
  /** The number of characters the segment occupies in the display (e.g. 2 for `mm`). */
  width: number;
};

export type DurationFormatSpec = {
  segments: DurationSegment[];
  /** The literal text between consecutive segments - `separators.length === segments.length - 1`. */
  separators: string[];
};

/** Milliseconds in one unit. */
export const UNIT_MS: Record<DurationUnit, number> = {
  h: 3_600_000,
  m: 60_000,
  s: 1_000,
  ms: 1,
};

const TOKEN_UNIT: Record<string, DurationUnit> = { h: 'h', m: 'm', s: 's', S: 'ms' };

/**
 * Compiles a duration format string into a segment spec. Recognized tokens are runs of
 * `h` (hours), `m` (minutes), `s` (seconds) and `S` (milliseconds); any other characters
 * are separators. E.g. `'hh:mm:ss.SSS'`, `'mm:ss'`, `'h m'`.
 */
export const deriveDurationFormatSpec = (format: string): DurationFormatSpec => {
  const segments: DurationSegment[] = [];
  const separators: string[] = [];
  let currentSeparator = '';
  let index = 0;

  while (index < format.length) {
    const char = format.charAt(index);
    const unit = TOKEN_UNIT[char];

    if (unit) {
      let width = 0;

      while (index < format.length && format[index] === char) {
        width += 1;
        index += 1;
      }

      if (segments.length) {
        separators.push(currentSeparator);
      }

      currentSeparator = '';
      segments.push({ unit, width });
    } else {
      currentSeparator += char;
      index += 1;
    }
  }

  return { segments, separators };
};

/**
 * Splits `ms` into the per-unit integer values the spec's segments display. Processing
 * largest→smallest and subtracting each time gives the first (largest) unit the full,
 * unbounded quotient and every smaller unit its natural remainder (e.g. seconds 0–59).
 */
const splitUnits = (ms: number, spec: DurationFormatSpec): Record<DurationUnit, number> => {
  const result: Record<DurationUnit, number> = { h: 0, m: 0, s: 0, ms: 0 };
  let remaining = Math.max(0, Math.round(ms));

  for (const segment of spec.segments) {
    const scale = UNIT_MS[segment.unit];

    result[segment.unit] = Math.floor(remaining / scale);
    remaining -= result[segment.unit] * scale;
  }

  return result;
};

/** Formats a millisecond duration into the spec's display string. `null` renders as empty. */
export const formatDuration = (ms: number | null, spec: DurationFormatSpec) => {
  if (ms === null || Number.isNaN(ms)) {
    return '';
  }

  const values = splitUnits(ms, spec);

  return spec.segments
    .map((segment, position) => {
      const text = String(values[segment.unit]).padStart(segment.width, '0');
      const separator = position < spec.separators.length ? spec.separators[position] : '';

      return text + separator;
    })
    .join('');
};

/**
 * Parses typed duration text against the spec. Accepts the segment separators (`1:30`) and,
 * for separator-less digit runs, consumes digits from the right so a short entry fills the
 * smallest units first (`130` → `1:30` under `mm:ss`). Returns total milliseconds, or `null`.
 */
export const parseDuration = (value: string, spec: DurationFormatSpec): number | null => {
  const text = value.trim();

  if (!text || !spec.segments.length) {
    return null;
  }

  const groups = text.split(/\D+/).filter((group) => group.length > 0);

  if (!groups.length || !/^[\d\s:.,hHmMsS]+$/.test(text)) {
    return null;
  }

  let unitValues: number[];

  if (groups.length > 1) {
    // explicit separators: map digit groups left-to-right onto the trailing segments
    if (groups.length > spec.segments.length) {
      return null;
    }

    const offset = spec.segments.length - groups.length;

    unitValues = spec.segments.map((_, position) => (position < offset ? 0 : Number(groups[position - offset])));
  } else {
    // one digit run: consume from the right, smallest unit first
    let digits = groups[0] ?? '';

    unitValues = spec.segments
      .map((segment) => segment.width)
      .reverse()
      .map((width) => {
        const take = Math.min(width, digits.length);
        const slice = digits.slice(digits.length - take);

        digits = digits.slice(0, digits.length - take);

        return slice.length ? Number(slice) : 0;
      })
      .reverse();

    // leftover digits pile onto the largest unit (e.g. `123456` under mm:ss → 1234 min)
    if (digits.length) {
      unitValues[0] = Number(digits + String(unitValues[0]).padStart(spec.segments[0]?.width ?? 0, '0'));
    }
  }

  let total = 0;

  spec.segments.forEach((segment, position) => {
    total += (unitValues[position] ?? 0) * UNIT_MS[segment.unit];
  });

  return total;
};
