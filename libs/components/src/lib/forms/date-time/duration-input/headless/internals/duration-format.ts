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

const TOKEN_UNIT: Record<string, DurationUnit> = { h: 'h', H: 'h', m: 'm', s: 's', S: 'ms' };

/**
 * Compiles a duration format string into a segment spec. Recognized tokens are runs of
 * `h` or `H` (hours), `m` (minutes), `s` (seconds) and `S` (milliseconds); any other characters
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
 * Why a format would not render the way it reads, or `null` when it does: a letter that is no
 * token, or text before the first segment - both are dropped or taken as a separator.
 */
export const durationFormatProblem = (format: string): string | null => {
  const unknownLetters = [...new Set(format.match(/[a-z]/gi) ?? [])].filter((letter) => !TOKEN_UNIT[letter]);

  if (unknownLetters.length) {
    return `the letters ${unknownLetters.map((letter) => `"${letter}"`).join(', ')} are no duration tokens`;
  }

  const firstToken = [...format].findIndex((char) => !!TOKEN_UNIT[char]);

  if (firstToken > 0) {
    return `the text "${format.slice(0, firstToken)}" before the first segment is dropped`;
  }

  return null;
};

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

const SUFFIXED_PATTERN = /^(?:\s*\d+\s*[hms])+\s*$/i;
const SUFFIXED_GROUP_PATTERN = /(\d+)\s*([hms])/gi;

const parseSuffixedDuration = (text: string, spec: DurationFormatSpec): number | null => {
  if (!SUFFIXED_PATTERN.test(text)) {
    return null;
  }

  const smallestScale = Math.min(...spec.segments.map((segment) => UNIT_MS[segment.unit]));
  const seen = new Set<string>();
  let total = 0;

  for (const [, digits, letter] of text.matchAll(SUFFIXED_GROUP_PATTERN)) {
    const unit = (letter ?? '').toLowerCase() as DurationUnit;
    const scale = UNIT_MS[unit];

    if (seen.has(unit) || scale < smallestScale) {
      return null;
    }

    seen.add(unit);
    total += Number(digits) * scale;
  }

  return total;
};

/**
 * Parses typed duration text against the spec. Accepts the segment separators (`1:30`),
 * unit-suffixed groups (`1h30m`) and, for separator-less digit runs, consumes digits from the
 * right so a short entry fills the smallest units first (`130` → `1:30` under `mm:ss`). Returns
 * total milliseconds, or `null`.
 */
export const parseDuration = (value: string, spec: DurationFormatSpec): number | null => {
  const text = value.trim();

  if (!text || !spec.segments.length) {
    return null;
  }

  if (/[hms]/i.test(text)) {
    return parseSuffixedDuration(text, spec);
  }

  const groups = text.split(/\D+/).filter((group) => group.length > 0);

  if (!groups.length || !/^[\d\s:.,]+$/.test(text)) {
    return null;
  }

  let unitValues: number[];

  if (groups.length > 1) {
    if (groups.length > spec.segments.length) {
      return null;
    }

    const offset = spec.segments.length - groups.length;

    unitValues = spec.segments.map((_, position) => (position < offset ? 0 : Number(groups[position - offset])));
  } else {
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
