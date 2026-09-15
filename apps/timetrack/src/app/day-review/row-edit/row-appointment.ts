import { Appointment } from '@ethlete/components';
import {
  BehindStretch,
  Confidence,
  ReviewedRow,
  formatDurationMs,
  isManualRow,
  isStandInRow,
  syncsInState,
} from '@ethlete/timetrack';

/** What a band with no issue is called, on the timeline and in the label of a boundary beside it. */
export const UNNAMED_LABEL = 'Not yet named';

/**
 * What a band with no issue is called when nobody was at the machine for it. It is a different answer
 * from {@link UNNAMED_LABEL}: the day is not waiting to be told what this work was, it is saying that
 * an agent did it alone and that its hours are not the user's to book.
 */
export const UNATTENDED_LABEL = 'Nobody was here';

/**
 * What a band a call rule excluded is called. It is neither waiting for a name nor a problem: the
 * rules already answered what this room is, and the band is there for the day they are wrong about it.
 */
export const EXCLUDED_LABEL = 'Not counted';

/**
 * What a band with no issue is called, on the timeline and in the label of a boundary beside it.
 *
 * A stand-in reads as its own name: the work has an answer, and the one thing still missing is the
 * ticket. `standInName` is absent when the rule points at a stand-in the user deleted, and the band
 * then reads as unnamed again, exactly as the ladder now reads it.
 */
export const unnamedLabelOf = (options: { row: ReviewedRow; standInName?: string }) => {
  const { row } = options;

  if (row.excluded) return EXCLUDED_LABEL;
  if (row.standInId && options.standInName) return options.standInName;

  return row.unattended ? UNATTENDED_LABEL : UNNAMED_LABEL;
};

/**
 * The theme each confidence tier paints in. Registered theme names, not colours — the scheduler reads
 * `colorToken` as `[etProvideColor]`.
 */
export const CONFIDENCE_THEME: Record<Confidence, string> = {
  certain: 'success',
  likely: 'brand',
  weak: 'warning',
};

/** The theme a band a rule excluded paints in. A registered theme name, like {@link CONFIDENCE_THEME}. */
export const EXCLUDED_THEME = 'neutral';

/**
 * The theme a band waiting on a ticket paints in, so a stand-in is one glance rather than a read.
 *
 * It is a colour of its own rather than a confidence tier: the work has a name and the day is not
 * asking about it, so painting it as a weak guess would put a question on a band nobody has to answer.
 */
export const STAND_IN_THEME = 'pending';

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
  /** What the row's stand-in is called, so the band reads it without a second lookup per redraw. */
  standInName?: string;
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

// A band a rule excluded is not a weak guess the reviewer has to settle, so it does not take the
// warning theme. Naming it is the user overruling the rule, and from then on it reads as any row.
const colorTokenOf = (row: ReviewedRow) => {
  if (row.excluded && !row.issueKey) return EXCLUDED_THEME;
  if (isStandInRow(row)) return STAND_IN_THEME;

  return CONFIDENCE_THEME[row.confidence];
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
  standInName?: string;
}): Appointment<TimelineEntry> => ({
  id: options.row.id,
  parentId: options.parentId ?? null,
  title: options.row.issueKey ?? '',
  description: options.row.description,
  start: options.from ?? options.row.from,
  end: options.to ?? options.row.to,
  colorToken: colorTokenOf(options.row),
  extra: {
    kind: 'row',
    row: options.row,
    durationMs: options.row.durationMs,
    willSync: syncsInState(options.row.state),
    standInName: options.standInName,
  },
});

/**
 * What a stretch another band took the minutes of reads: the key it would have booked, that it ran as
 * a background project for them, and how many of them there are.
 */
export const behindLabel = (stretch: BehindStretch) =>
  `${stretch.issueKey} · in the background · ${formatDurationMs(stretch.to.getTime() - stretch.from.getTime())}`;

/** What a band reads: the issue it is logged against, and how much time it logs. */
export const appointmentLabel = (appointment: Appointment) => {
  const entry = rowEntryOf(appointment);

  if (!entry) return appointment.title;

  const named = entry.row.issueKey ?? unnamedLabelOf({ row: entry.row, standInName: entry.standInName });
  const alone = entry.row.issueKey && entry.row.unattended ? ' · nobody was here' : '';

  return `${named} · ${formatDurationMs(entry.durationMs)}${alone}${isManualRow(entry.row) ? ' · by hand' : ''}`;
};

/** Whether a band is waiting on a ticket, so the timeline can mark it as provisional. */
export const isStandInAppointment = (appointment: Appointment) => {
  const row = rowEntryOf(appointment)?.row;

  return !!row && isStandInRow(row);
};
