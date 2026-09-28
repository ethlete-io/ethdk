// codes 5120-5139
export const LINE_CHART_ERROR_CODES = {
  /** A line chart's `data` mixes `Date` and `string` x values. */
  MIXED_X_TYPES: 5120,
  /** A line chart's `timeZone` is not an IANA time zone. */
  INVALID_TIME_ZONE: 5121,
} as const;
