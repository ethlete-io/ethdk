import { Component, computed, ViewEncapsulation } from '@angular/core';
import { injectSchedulerEditSurface } from './headless';
import { injectSchedulerLabels } from './scheduler-labels';

/**
 * The shown appointment's ancestor chain, root first. A click navigates the surface to that
 * ancestor. Hidden for a top-level appointment.
 */
@Component({
  selector: 'et-scheduler-edit-surface-breadcrumb',
  template: `
    @for (ancestor of surface.ancestors(); track ancestor.id) {
      <button (click)="surface.navigateTo(ancestor.id)" class="et-scheduler-edit-surface-breadcrumb-item" type="button">
        {{ ancestor.title || untitledLabel() }}
      </button>
      <span class="et-scheduler-edit-surface-breadcrumb-separator" aria-hidden="true">/</span>
    }
    <span class="et-scheduler-edit-surface-breadcrumb-current" aria-current="page">{{ currentLabel() }}</span>
  `,
  styleUrl: './scheduler-edit-surface-breadcrumb.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-scheduler-edit-surface-breadcrumb',
    role: 'navigation',
    '[attr.aria-label]': 'ancestorsLabel()',
    '[hidden]': 'surface.ancestors().length === 0',
  },
})
export class SchedulerEditSurfaceBreadcrumbComponent {
  private labels = injectSchedulerLabels();

  protected surface = injectSchedulerEditSurface();

  protected ancestorsLabel = computed(() => this.labels().ancestors);
  protected untitledLabel = computed(() => this.labels().untitledAppointment);
  protected currentLabel = computed(() => this.surface.currentAppointment().title || this.untitledLabel());
}
