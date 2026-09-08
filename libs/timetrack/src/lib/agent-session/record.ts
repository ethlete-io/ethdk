/**
 * Reads one JSONL line as an object, or `null` for anything else.
 *
 * A log read while the agent writes to it ends in a half-written line, and a log the agent replaced
 * can hold a line of another shape, so a parser counts what this rejects rather than failing.
 */
export const asJsonObject = (line: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(line);

    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/** The field as a non-empty string, or `undefined`. An empty string is treated as absent. */
export const stringAt = (record: Record<string, unknown>, key: string) => {
  const value = record[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

/** The field as a plain object, or `null`. An array is not one. */
export const objectAt = (record: Record<string, unknown> | null, key: string): Record<string, unknown> | null => {
  const value = record?.[key];

  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

/** The field as a finite number, or `0`. A token count a log omits is a count of nothing. */
export const countAt = (record: Record<string, unknown> | null, key: string) => {
  const value = record?.[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};
