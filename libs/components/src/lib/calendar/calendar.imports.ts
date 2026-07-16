import { CalendarComponent } from './calendar.component';
import { CalendarCellDirective, CalendarDirective, CalendarGridDirective } from './headless';

export const CALENDAR_IMPORTS = [
  CalendarComponent,
  CalendarDirective,
  CalendarGridDirective,
  CalendarCellDirective,
] as const;
