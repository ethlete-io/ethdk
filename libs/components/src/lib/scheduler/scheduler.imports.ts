import {
  SchedulerAgendaDirective,
  SchedulerDirective,
  SchedulerEditSurfaceDirective,
  SchedulerMonthDirective,
  SchedulerTimeGridDirective,
} from './headless';
import { SchedulerActionAddAppointmentDirective } from './scheduler-action-add-appointment.directive';
import { SchedulerAgendaViewComponent } from './scheduler-agenda-view.component';
import { SchedulerAppointmentDragDirective } from './scheduler-appointment-drag.directive';
import { SchedulerBadgeChainCountDirective } from './scheduler-badge-chain-count.directive';
import { SchedulerBadgeColorDotDirective } from './scheduler-badge-color-dot.directive';
import { SchedulerBadgeLocationDirective } from './scheduler-badge-location.directive';
import { SchedulerBadgeTimeRangeDirective } from './scheduler-badge-time-range.directive';
import { SchedulerBadgeTitleDirective } from './scheduler-badge-title.directive';
import { MenuItemComponent } from '../menu';
import { OverlayBodyComponent } from '../overlay';
import { SchedulerEditAddSubAppointmentItemComponent } from './scheduler-edit-add-sub-appointment-item.component';
import { SchedulerEditColorComponent } from './scheduler-edit-color.component';
import { SchedulerEditDeleteItemComponent } from './scheduler-edit-delete-item.component';
import { SchedulerEditDescriptionComponent } from './scheduler-edit-description.component';
import { SchedulerEditLocationComponent } from './scheduler-edit-location.component';
import { SchedulerEditSurfaceActionsComponent } from './scheduler-edit-surface-actions.component';
import { SchedulerEditSurfaceBreadcrumbComponent } from './scheduler-edit-surface-breadcrumb.component';
import { SchedulerEditSurfaceChildrenComponent } from './scheduler-edit-surface-children.component';
import { SchedulerEditSurfaceFieldsComponent } from './scheduler-edit-surface-fields.component';
import { SchedulerEditSurfaceFooterComponent } from './scheduler-edit-surface-footer.component';
import { SchedulerEditSurfaceHeaderComponent } from './scheduler-edit-surface-header.component';
import { SchedulerEditSurfaceComponent } from './scheduler-edit-surface.component';
import { SchedulerEditTimeRangeComponent } from './scheduler-edit-time-range.component';
import { SchedulerEditTitleComponent } from './scheduler-edit-title.component';
import { SchedulerSwipeNavigationDirective } from './scheduler-swipe-navigation.directive';
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
  SchedulerActionAddAppointmentDirective,
  SchedulerSwipeNavigationDirective,
  SchedulerAppointmentDragDirective,
] as const;

/**
 * Everything an edit surface template uses: the default surface, its blocks, the built-in fields,
 * the ready-made menu items, `et-menu-item` for actions of your own and `et-overlay-body`.
 */
export const SCHEDULER_EDIT_SURFACE_IMPORTS = [
  SchedulerEditSurfaceDirective,
  SchedulerEditSurfaceComponent,
  SchedulerEditSurfaceHeaderComponent,
  SchedulerEditSurfaceActionsComponent,
  SchedulerEditAddSubAppointmentItemComponent,
  SchedulerEditDeleteItemComponent,
  SchedulerEditSurfaceBreadcrumbComponent,
  SchedulerEditSurfaceFieldsComponent,
  SchedulerEditSurfaceChildrenComponent,
  SchedulerEditSurfaceFooterComponent,
  SchedulerEditTitleComponent,
  SchedulerEditTimeRangeComponent,
  SchedulerEditLocationComponent,
  SchedulerEditDescriptionComponent,
  SchedulerEditColorComponent,
  MenuItemComponent,
  OverlayBodyComponent,
] as const;
