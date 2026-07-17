import { setHours, setMinutes, setSeconds, startOfDay } from 'date-fns';
import { ParseDateValueOptions, parseDateValue } from '../../../internals/date-value';

type LenientTimeParts = {
  hour: number;
  minute: number;
  second: number;
};

const MERIDIEM_PATTERN = /\s*([ap])\.?\s*(?:m\.?)?$/i;
const SEPARATED_PATTERN = /^(\d{1,2})(?:[:.\s](\d{1,2})(?:[:.\s](\d{1,2}))?)?$/;
const COMPACT_PATTERN = /^\d{3,6}$/;

const extractLenientParts = (text: string): LenientTimeParts | null => {
  const separated = SEPARATED_PATTERN.exec(text);

  if (separated) {
    return { hour: Number(separated[1]), minute: Number(separated[2] ?? 0), second: Number(separated[3] ?? 0) };
  }

  if (!COMPACT_PATTERN.test(text)) {
    return null;
  }

  // digit runs split as H MM / HH MM / H MM SS / HH MM SS
  const hourDigits = text.length % 2 === 0 ? 2 : 1;

  return {
    hour: Number(text.slice(0, hourDigits)),
    minute: Number(text.slice(hourDigits, hourDigits + 2)),
    second: text.length > 4 ? Number(text.slice(hourDigits + 2)) : 0,
  };
};

const parseLenient = (raw: string, referenceDate: Date): Date | null => {
  let text = raw.trim().toLowerCase();

  if (!text) {
    return null;
  }

  let period: 'am' | 'pm' | null = null;
  const meridiem = MERIDIEM_PATTERN.exec(text);

  if (meridiem) {
    period = meridiem[1] === 'a' ? 'am' : 'pm';
    text = text.slice(0, meridiem.index).trim();
  }

  const parts = extractLenientParts(text);

  if (parts === null) {
    return null;
  }

  let { hour } = parts;

  if (period !== null) {
    if (hour < 1 || hour > 12) {
      return null;
    }

    hour = (hour % 12) + (period === 'pm' ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }

  if (parts.minute > 59 || parts.second > 59) {
    return null;
  }

  return setSeconds(setMinutes(setHours(startOfDay(referenceDate), hour), parts.minute), parts.second);
};

/**
 * Parses typed time text: strictly against the display format first, then
 * leniently — bare digit runs (`930` → 09:30, `0930`, `93015`), loose
 * separators (`9:5`, `9.30`, `9 30`) and meridiem suffixes (`930pm`, `9 a.m.`),
 * always validating part ranges. Returns the time of day on `referenceDate`
 * (its start of day), or `null` when nothing parses.
 */
export const parseTimeText = (value: string, options: ParseDateValueOptions): Date | null => {
  const strict = parseDateValue(value, options);

  if (strict !== null) {
    return strict;
  }

  return parseLenient(value, options.referenceDate ?? new Date());
};
