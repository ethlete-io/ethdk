import { SchedulerDirective, SchedulerMonthDirective, SchedulerTimeGridDirective } from './headless';
import { SchedulerComponent } from './scheduler.component';
import { SchedulerMonthViewComponent } from './scheduler-month-view.component';
import { SchedulerTimeGridViewComponent } from './scheduler-time-grid-view.component';

export const SCHEDULER_IMPORTS = [
  SchedulerDirective,
  SchedulerMonthDirective,
  SchedulerTimeGridDirective,
  SchedulerComponent,
  SchedulerMonthViewComponent,
  SchedulerTimeGridViewComponent,
] as const;
