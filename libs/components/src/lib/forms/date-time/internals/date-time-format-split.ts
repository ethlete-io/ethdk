import { Locale } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';

/** The two halves of a combined format, with every literal kept on the date side it sits on. */
export type DateTimeFormatSplit = {
  datePrefix: string;
  time: string;
  dateSuffix: string;
};

/** date-fns' own pre-pass: the `P`/`p` locale formats are expanded before the format is tokenized. */
const LONG_FORMAT_PATTERN = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;

/** date-fns' formatting tokenizer. */
const TOKEN_PATTERN = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g;

const TIME_TOKENS = /* @__PURE__ */ new Set([
  'a',
  'b',
  'B',
  'h',
  'H',
  'K',
  'k',
  'm',
  's',
  'S',
  'X',
  'x',
  'O',
  'z',
  'Z',
]);
const DATE_TOKENS = /* @__PURE__ */ new Set([
  'G',
  'y',
  'Y',
  'R',
  'u',
  'Q',
  'q',
  'M',
  'L',
  'w',
  'I',
  'd',
  'D',
  'E',
  'i',
  'e',
  'c',
]);

const LONG_FORMAT_WIDTHS = ['short', 'medium', 'long', 'full'] as const;

type TokenKind = 'date' | 'time' | 'literal' | 'unsplittable';

const widthOf = (run: number) => LONG_FORMAT_WIDTHS[Math.min(run, LONG_FORMAT_WIDTHS.length) - 1] ?? 'full';

const expandLongToken = (token: string, formatLong: Locale['formatLong']) => {
  const dateRun = token.match(/P+/)?.[0].length ?? 0;
  const timeRun = token.match(/p+/)?.[0].length ?? 0;

  if (dateRun === 0) {
    return formatLong.time({ width: widthOf(timeRun) });
  }

  const date = formatLong.date({ width: widthOf(dateRun) });

  if (timeRun === 0) {
    return date;
  }

  return formatLong
    .dateTime({ width: widthOf(dateRun) })
    .replace('{{date}}', date)
    .replace('{{time}}', formatLong.time({ width: widthOf(timeRun) }));
};

const expandLongFormats = (format: string, locale: Locale) =>
  (format.match(LONG_FORMAT_PATTERN) ?? [])
    .map((token) => (token[0] === 'P' || token[0] === 'p' ? expandLongToken(token, locale.formatLong) : token))
    .join('');

const kindOf = (token: string): TokenKind => {
  const first = token[0] ?? '';

  if (first === "'") {
    return 'literal';
  }

  if (TIME_TOKENS.has(first)) {
    return 'time';
  }

  if (DATE_TOKENS.has(first)) {
    return 'date';
  }

  // `t`/`T` are whole epoch timestamps, and an unknown letter is date-fns' problem, not ours
  return /[a-zA-Z]/.test(first) ? 'unsplittable' : 'literal';
};

/**
 * Splits a combined date & time format into the span carrying the time and the date format around
 * it, so one half can be rendered while the other is still missing. Locale formats (`P`, `Pp`, …)
 * are expanded first, exactly as date-fns expands them.
 *
 * `null` when the format has no time half, no date half, or interleaves the two (`h:mm 'on' d MMM
 * HH`) - there is no single span to blank out then.
 */
export const splitDateTimeFormat = (format: string, locale: Locale | null): DateTimeFormatSplit | null => {
  const tokens = expandLongFormats(format, locale ?? enUS).match(TOKEN_PATTERN);

  if (tokens === null) {
    return null;
  }

  const kinds = tokens.map(kindOf);

  if (kinds.includes('unsplittable') || !kinds.includes('date')) {
    return null;
  }

  const first = kinds.indexOf('time');
  const last = kinds.lastIndexOf('time');

  if (first === -1 || kinds.slice(first, last + 1).includes('date')) {
    return null;
  }

  return {
    datePrefix: tokens.slice(0, first).join(''),
    time: tokens.slice(first, last + 1).join(''),
    dateSuffix: tokens.slice(last + 1).join(''),
  };
};
