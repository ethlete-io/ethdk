import {
  SchedulerAgendaDirective,
  SchedulerDirective,
  SchedulerMonthDirective,
  SchedulerTimeGridDirective,
} from './headless';
import { SchedulerAgendaViewComponent } from './scheduler-agenda-view.component';
import { SchedulerComponent } from './scheduler.component';
import { SchedulerMonthViewComponent } from './scheduler-month-view.component';
import { SchedulerTimeGridViewComponent } from './scheduler-time-grid-view.component';

export const SCHEDULER_IMPORTS = [
  SchedulerDirective,
  SchedulerAgendaDirective,
  SchedulerMonthDirective,
  SchedulerTimeGridDirective,
  SchedulerComponent,
  SchedulerAgendaViewComponent,
  SchedulerMonthViewComponent,
  SchedulerTimeGridViewComponent,
] as const;
