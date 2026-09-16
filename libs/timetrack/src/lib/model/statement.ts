import { TimeWindow } from './time-window';

/**
 * What the user says a stretch of the day was, whatever the collectors measured in it.
 *
 * A break carries no id: it is derived from the gaps between two stretches of presence, and the next
 * event moves it. An edit keyed by a break therefore does not survive the next run of `streamDay`. So
 * the user states the stretch instead, and the day's breaks follow — `present` clips a break out of
 * the window, `away` draws one over it. A statement outranks every derived rule, the call guard of
 * ADR 0030 included.
 */
export type PresenceStatement = TimeWindow & {
  id: string;
  kind: 'present' | 'away';
};

/** The windows of one kind of statement, in the order they were written. */
export const statementWindows = (
  statements: readonly PresenceStatement[],
  kind: PresenceStatement['kind'],
): TimeWindow[] => statements.filter((statement) => statement.kind === kind).map(({ from, to }) => ({ from, to }));
