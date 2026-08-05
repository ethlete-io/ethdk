import { SchedulerDirective, SchedulerMonthDirective } from './headless';
import { SchedulerComponent } from './scheduler.component';
import { SchedulerMonthViewComponent } from './scheduler-month-view.component';

export const SCHEDULER_IMPORTS = [
  SchedulerDirective,
  SchedulerMonthDirective,
  SchedulerComponent,
  SchedulerMonthViewComponent,
] as const;
