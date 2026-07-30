import { CalendarComponent } from './calendar.component';
import { CalendarHeaderDirective } from './calendar-header.directive';
import { CalendarCellDirective, CalendarDirective, CalendarGridDirective } from './headless';

export const CALENDAR_IMPORTS = [
  CalendarComponent,
  CalendarDirective,
  CalendarGridDirective,
  CalendarCellDirective,
  CalendarHeaderDirective,
] as const;
