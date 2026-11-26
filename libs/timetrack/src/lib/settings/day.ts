import { DayBoundary } from '../review/day';
import { TimetrackSettings } from './model';

/** The boundary every day-keyed thing in the app reads a day with. */
export const dayBoundaryOf = (settings: Pick<TimetrackSettings, 'dayStartHour'>): DayBoundary => ({
  startHour: settings.dayStartHour,
});
