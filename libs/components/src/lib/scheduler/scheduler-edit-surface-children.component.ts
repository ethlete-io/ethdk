import { Component, computed, inject, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { format } from 'date-fns';
import { injectSchedulerEditSurface, SchedulerDirective } from './headless';
import { SchedulerAppointmentStylesComponent } from './scheduler-appointment-styles.component';
import { SchedulerBadgeChainCountComponent } from './scheduler-badge-chain-count.component';
import { injectSchedulerLabels } from './scheduler-labels';

/** The shown appointment's direct children. A click navigates the surface to that child. Hidden without children. */
@Component({
  selector: 'et-scheduler-edit-surface-children',
  template: `
    <h3 class="et-scheduler-edit-surface-children-heading">{{ subAppointmentsLabel() }}</h3>

    <ul class="et-scheduler-edit-surface-children-list">
      @for (child of entries(); track child.node.appointment.id) {
        <li>
          <button
            (click)="surface.navigateTo(child.node.appointment.id)"
            class="et-scheduler-edit-surface-children-item"
            type="button"
          >
            @if (child.startTime) {
              <span class="et-scheduler-edit-surface-children-item-time">{{ child.startTime }}</span>
            }

            <span class="et-scheduler-edit-surface-children-item-title">
              {{ child.node.appointment.title || untitledLabel() }}
            </span>

            <et-scheduler-badge-chain-count [node]="child.node" />
          </button>
        </li>
      }
    </ul>
  `,
  styleUrl: './scheduler-edit-surface-children.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [SchedulerBadgeChainCountComponent],
  host: {
    class: 'et-scheduler-edit-surface-children',
    '[hidden]': 'entries().length === 0',
  },
})
export class SchedulerEditSurfaceChildrenComponent {
  private labels = injectSchedulerLabels();
  private scheduler = inject(SchedulerDirective, { optional: true });

  protected surface = injectSchedulerEditSurface();

  protected subAppointmentsLabel = computed(() => this.labels().subAppointments);
  protected untitledLabel = computed(() => this.labels().untitledAppointment);

  protected entries = computed(() => {
    const locale = this.scheduler?.effectiveLocale();
    const options = locale ? { locale } : undefined;

    return this.surface.children().map((node) => ({
      node,
      startTime: node.appointment.allDay ? null : format(node.appointment.start, 'p', options),
    }));
  });

  constructor() {
    // a surface can be opened without any scheduler view having mounted the chain-count chip's sheet
    injectStyleManager().mount(SchedulerAppointmentStylesComponent);
  }
}
