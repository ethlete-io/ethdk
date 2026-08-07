import {
  SchedulerAgendaDirective,
  SchedulerDirective,
  SchedulerEditSurfaceDirective,
  SchedulerMonthDirective,
  SchedulerTimeGridDirective,
} from './headless';
import { SchedulerActionAddAppointmentDirective } from './scheduler-action-add-appointment.directive';
import { SchedulerActionAddSubAppointmentDirective } from './scheduler-action-add-sub-appointment.directive';
import { SchedulerActionDeleteDirective } from './scheduler-action-delete.directive';
import { SchedulerAgendaViewComponent } from './scheduler-agenda-view.component';
import { SchedulerBadgeChainCountDirective } from './scheduler-badge-chain-count.directive';
import { SchedulerBadgeColorDotDirective } from './scheduler-badge-color-dot.directive';
import { SchedulerBadgeLocationDirective } from './scheduler-badge-location.directive';
import { SchedulerBadgeTimeRangeDirective } from './scheduler-badge-time-range.directive';
import { SchedulerBadgeTitleDirective } from './scheduler-badge-title.directive';
import { SchedulerEditColorDirective } from './scheduler-edit-color.directive';
import { SchedulerEditDescriptionDirective } from './scheduler-edit-description.directive';
import { SchedulerEditLocationDirective } from './scheduler-edit-location.directive';
import { SchedulerEditSurfaceComponent } from './scheduler-edit-surface.component';
import { SchedulerEditTimeRangeDirective } from './scheduler-edit-time-range.directive';
import { SchedulerEditTitleDirective } from './scheduler-edit-title.directive';
import { SchedulerSwipeNavigationDirective } from './scheduler-swipe-navigation.directive';
import { SchedulerComponent } from './scheduler.component';
import { SchedulerMonthViewComponent } from './scheduler-month-view.component';
import { SchedulerTimeGridViewComponent } from './scheduler-time-grid-view.component';

export const SCHEDULER_IMPORTS = [
  SchedulerDirective,
  SchedulerAgendaDirective,
  SchedulerMonthDirective,
  SchedulerTimeGridDirective,
  SchedulerEditSurfaceDirective,
  SchedulerComponent,
  SchedulerAgendaViewComponent,
  SchedulerMonthViewComponent,
  SchedulerTimeGridViewComponent,
  SchedulerBadgeColorDotDirective,
  SchedulerBadgeTitleDirective,
  SchedulerBadgeTimeRangeDirective,
  SchedulerBadgeLocationDirective,
  SchedulerBadgeChainCountDirective,
  SchedulerEditSurfaceComponent,
  SchedulerEditTitleDirective,
  SchedulerEditTimeRangeDirective,
  SchedulerEditLocationDirective,
  SchedulerEditDescriptionDirective,
  SchedulerEditColorDirective,
  SchedulerActionAddSubAppointmentDirective,
  SchedulerActionDeleteDirective,
  SchedulerActionAddAppointmentDirective,
  SchedulerSwipeNavigationDirective,
] as const;
