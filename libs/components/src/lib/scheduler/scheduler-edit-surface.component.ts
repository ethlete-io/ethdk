import { Component, ViewEncapsulation } from '@angular/core';
import { OverlayBodyComponent, OverlayMainDirective } from '../overlay';
import { injectSchedulerEditSurface, SchedulerEditSurfaceDirective } from './headless';
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
import { SchedulerEditTimeRangeComponent } from './scheduler-edit-time-range.component';
import { SchedulerEditTitleComponent } from './scheduler-edit-title.component';

/**
 * The default edit surface, what `provideSchedulerEditSurface()` registers: every built-in field,
 * the ancestor breadcrumb, the children list and the action menu. Copy its template to start a
 * surface of your own.
 */
@Component({
  selector: 'et-scheduler-edit-surface',
  templateUrl: './scheduler-edit-surface.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    OverlayBodyComponent,
    SchedulerEditSurfaceHeaderComponent,
    SchedulerEditSurfaceActionsComponent,
    SchedulerEditAddSubAppointmentItemComponent,
    SchedulerEditDeleteItemComponent,
    SchedulerEditSurfaceBreadcrumbComponent,
    SchedulerEditSurfaceFieldsComponent,
    SchedulerEditTitleComponent,
    SchedulerEditTimeRangeComponent,
    SchedulerEditLocationComponent,
    SchedulerEditDescriptionComponent,
    SchedulerEditColorComponent,
    SchedulerEditSurfaceChildrenComponent,
    SchedulerEditSurfaceFooterComponent,
  ],
  hostDirectives: [
    OverlayMainDirective,
    { directive: SchedulerEditSurfaceDirective, inputs: ['appointment', 'appointments'] },
  ],
  host: {
    class: 'et-scheduler-edit-surface',
  },
})
export class SchedulerEditSurfaceComponent {
  /** The headless directive behind this surface - draft state and navigation. */
  public surface = injectSchedulerEditSurface();
}
