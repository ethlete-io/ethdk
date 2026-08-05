import {
  SchedulerAgendaDirective,
  SchedulerDirective,
  SchedulerMonthDirective,
  SchedulerTimeGridDirective,
} from './headless';
import { SchedulerAgendaViewComponent } from './scheduler-agenda-view.component';
import { SchedulerBadgeChainCountDirective } from './scheduler-badge-chain-count.directive';
import { SchedulerBadgeColorDotDirective } from './scheduler-badge-color-dot.directive';
import { SchedulerBadgeLocationDirective } from './scheduler-badge-location.directive';
import { SchedulerBadgeTimeRangeDirective } from './scheduler-badge-time-range.directive';
import { SchedulerBadgeTitleDirective } from './scheduler-badge-title.directive';
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
  SchedulerBadgeColorDotDirective,
  SchedulerBadgeTitleDirective,
  SchedulerBadgeTimeRangeDirective,
  SchedulerBadgeLocationDirective,
  SchedulerBadgeChainCountDirective,
] as const;
