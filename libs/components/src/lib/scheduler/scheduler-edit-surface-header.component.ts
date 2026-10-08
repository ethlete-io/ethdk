import { Component, computed, ViewEncapsulation } from '@angular/core';
import { OverlayHeaderDirective, OverlayTitleDirective } from '../overlay';
import { injectSchedulerEditSurface } from './headless';
import { injectSchedulerLabels } from './scheduler-labels';

/**
 * The edit surface's header: the title, and an `<et-scheduler-edit-surface-actions>` menu when one
 * is projected. Projected text replaces the title, which defaults to the shown appointment's own.
 */
@Component({
  selector: 'et-scheduler-edit-surface-header',
  template: `
    <h2 class="et-scheduler-edit-surface-title" etOverlayTitle>
      <ng-content>{{ title() }}</ng-content>
    </h2>
    <ng-content select="et-scheduler-edit-surface-actions" />
  `,
  styleUrl: './scheduler-edit-surface-header.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayTitleDirective],
  hostDirectives: [OverlayHeaderDirective],
  host: {
    class: 'et-scheduler-edit-surface-header',
  },
})
export class SchedulerEditSurfaceHeaderComponent {
  private labels = injectSchedulerLabels();
  private surface = injectSchedulerEditSurface();

  protected title = computed(() => this.surface.currentAppointment().title || this.labels().untitledAppointment);
}
