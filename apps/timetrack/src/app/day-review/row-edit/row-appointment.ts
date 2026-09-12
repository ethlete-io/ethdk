import { Appointment } from '@ethlete/components';
import { Confidence, ReviewedRow, formatDurationMs, isManualRow, syncsInState } from '@ethlete/timetrack';

/** What a band with no issue is called, on the timeline and in the label of a boundary beside it. */
export const UNNAMED_LABEL = 'Not yet named';

/**
 * What a band with no issue is called when nobody was at the machine for it. It is a different answer
 * from {@link UNNAMED_LABEL}: the day is not waiting to be told what this work was, it is saying that
 * an agent did it alone and that its hours are not the user's to book.
 */
export const UNATTENDED_LABEL = 'Nobody was here';

/**
 * The theme each confidence tier paints in. Registered theme names, not colours — the scheduler reads
 * `colorToken` as `[etProvideColor]`.
 */
export const CONFIDENCE_THEME: Record<Confidence, string> = {
  certain: 'success',
  likely: 'brand',
  weak: 'warning',
};

/**
 * A row as the scheduler carries it.
 *
 * `durationMs` and `willSync` are the two things an appointment has no field for and a worklog cannot
 * do without: the logged duration is rounded, so it is not the clock span, and a row nobody has
 * answered yet still syncs.
 */
export type RowEntry = {
  kind: 'row';
  row: ReviewedRow;
  durationMs: number;
  willSync: boolean;
};

/** A story or epic several of the day's rows roll up to. Drawn in the all-day strip, never billed. */
export type StoryEntry = { kind: 'story'; issueKey: string };

export type TimelineEntry = RowEntry | StoryEntry;

/**
 * The row an appointment holds, or nothing when it holds a story instead.
 *
 * The edit surface types its draft as `Appointment<unknown>`, because every field on it shares one
 * draft and the surface cannot know what another field put there. This is the one place that reads
 * the type back out.
 */
export const rowEntryOf = (appointment: Appointment): RowEntry | null => {
  const entry = appointment.extra as TimelineEntry | undefined;

  return entry?.kind === 'row' ? entry : null;
};

/**
 * The row as an appointment. `title` is the issue key, so the edit surface's header reads it and the
 * issue field has somewhere to write. What a band shows is {@link appointmentLabel} instead: a
 * duration inside the title would be a duration the issue field offers to overwrite.
 */
export const appointmentOf = (options: {
  row: ReviewedRow;
  parentId?: string | null;
  from?: Date;
  to?: Date;
}): Appointment<TimelineEntry> => ({
  id: options.row.id,
  parentId: options.parentId ?? null,
  title: options.row.issueKey ?? '',
  description: options.row.description,
  start: options.from ?? options.row.from,
  end: options.to ?? options.row.to,
  colorToken: CONFIDENCE_THEME[options.row.confidence],
  extra: {
    kind: 'row',
    row: options.row,
    durationMs: options.row.durationMs,
    willSync: syncsInState(options.row.state),
  },
});

/** What a band reads: the issue it is logged against, and how much time it logs. */
export const appointmentLabel = (appointment: Appointment) => {
  const entry = rowEntryOf(appointment);

  if (!entry) return appointment.title;

  const named = entry.row.issueKey ?? (entry.row.unattended ? UNATTENDED_LABEL : UNNAMED_LABEL);
  const alone = entry.row.issueKey && entry.row.unattended ? ' · nobody was here' : '';

  return `${named} · ${formatDurationMs(entry.durationMs)}${alone}${isManualRow(entry.row) ? ' · by hand' : ''}`;
};
