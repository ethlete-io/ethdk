import { Locale } from 'date-fns';
import { formatDateValue } from '../../../forms/date-time/internals/date-value';

export type TimeFormatSpec = {
  hourCycle: 12 | 24;
  showSeconds: boolean;
};

export type DeriveTimeFormatSpecOptions = {
  format: string;
  locale?: Locale | null;
};

// hour 13 renders as "13" only in a 24-hour format, second 57 only when seconds
// are shown; the other parts avoid those digit pairs
const PROBE_DATE = /* @__PURE__ */ new Date(2000, 0, 1, 13, 35, 57);

export const deriveTimeFormatSpec = (options: DeriveTimeFormatSpecOptions): TimeFormatSpec => {
  const rendered = formatDateValue(PROBE_DATE, options) ?? '';

  return {
    hourCycle: rendered.includes('13') ? 24 : 12,
    showSeconds: rendered.includes('57'),
  };
};
