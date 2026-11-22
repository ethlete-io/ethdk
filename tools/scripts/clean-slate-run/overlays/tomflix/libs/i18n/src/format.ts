export type FormatLocale = 'de' | 'en';

export const formatDate = (locale: FormatLocale, iso: string | undefined) => {
  if (!iso) return '';
  const date = new Date(iso.slice(0, 10));

  return Number.isNaN(date.getTime()) ? iso : new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).format(date);
};

export const formatPrice = (locale: FormatLocale, cents: number | null | undefined) => {
  if (cents === null || cents === undefined) return '';

  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
};

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

export const formatRelativeTime = (locale: FormatLocale, iso: string) => {
  const elapsed = new Date(iso).getTime() - Date.now();
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const [unit, size] = RELATIVE_UNITS.find(([, size]) => Math.abs(elapsed) >= size) ?? ['minute', 60_000];

  return format.format(Math.round(elapsed / size), unit);
};
