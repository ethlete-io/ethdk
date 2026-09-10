/** One worklog already in Tempo, from an earlier week. Fetched by the provider, never by the core. */
export type HistoricalWorklog = {
  issueKey: string;
  from: Date;
  durationMs: number;
};

/** A ticket the user's own history puts on the same weekday at the same time, week after week. */
export type RecurringPattern = {
  issueKey: string;
  /** Sunday-based, matching `Date#getDay`. */
  weekday: number;
  /** Minutes from local midnight, tolerance already applied. */
  fromMinute: number;
  toMinute: number;
  /** Distinct weeks the pair was seen in. */
  occurrences: number;
};

export type RecurrenceOptions = {
  /** Weeks a weekday/issue pair must appear in before it counts as a pattern at all. */
  minOccurrences: number;
  /** Widens the matched window either side of the observed starts, for a meeting that drifts. */
  toleranceMinutes: number;
  /**
   * How far the observed starts may spread before the pair stops being a time-of-day pattern. A
   * ticket logged at 09:00 one Monday and 17:00 the next is a weekly habit, not a slot, and a
   * window that wide would swallow the whole day.
   */
  maxSpreadMinutes: number;
};

export const DEFAULT_RECURRENCE_OPTIONS: RecurrenceOptions = {
  minOccurrences: 3,
  toleranceMinutes: 30,
  maxSpreadMinutes: 120,
};

const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

/** Two worklogs on the same weekday necessarily fall on different dates, so this counts weeks. */
const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * Reads standing commitments out of what the user already logged — the Monday planning, the
 * Thursday review. It is the weakest rung of the attribution ladder and deliberately narrow: a pair
 * has to recur in enough weeks *and* hold a consistent time of day before it attributes anything.
 */
export const detectRecurringPatterns = (options: {
  worklogs: HistoricalWorklog[];
  options?: Partial<RecurrenceOptions>;
}): RecurringPattern[] => {
  const { minOccurrences, toleranceMinutes, maxSpreadMinutes } = { ...DEFAULT_RECURRENCE_OPTIONS, ...options.options };
  const buckets = new Map<string, { issueKey: string; weekday: number; minutes: number[]; dates: Set<string> }>();

  for (const worklog of options.worklogs) {
    const weekday = worklog.from.getDay();
    const id = `${weekday}|${worklog.issueKey}`;
    const bucket = buckets.get(id) ?? { issueKey: worklog.issueKey, weekday, minutes: [], dates: new Set<string>() };

    bucket.minutes.push(minuteOfDay(worklog.from));
    bucket.dates.add(dateKey(worklog.from));
    buckets.set(id, bucket);
  }

  const patterns: RecurringPattern[] = [];

  for (const bucket of buckets.values()) {
    const occurrences = bucket.dates.size;

    if (occurrences < minOccurrences) continue;

    const earliest = Math.min(...bucket.minutes);
    const latest = Math.max(...bucket.minutes);

    if (latest - earliest > maxSpreadMinutes) continue;

    patterns.push({
      issueKey: bucket.issueKey,
      weekday: bucket.weekday,
      fromMinute: Math.max(0, earliest - toleranceMinutes),
      toMinute: latest + toleranceMinutes,
      occurrences,
    });
  }

  return patterns.sort((a, b) => b.occurrences - a.occurrences || a.issueKey.localeCompare(b.issueKey));
};

/** The strongest pattern covering a moment, or nothing — ties break on the longer history. */
export const patternAt = (options: { patterns: RecurringPattern[]; at: Date }) =>
  options.patterns
    .filter(
      (pattern) =>
        pattern.weekday === options.at.getDay() &&
        minuteOfDay(options.at) >= pattern.fromMinute &&
        minuteOfDay(options.at) <= pattern.toMinute,
    )
    .sort((a, b) => b.occurrences - a.occurrences)[0];
