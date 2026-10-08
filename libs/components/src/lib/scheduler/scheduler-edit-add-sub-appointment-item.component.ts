import { Component, computed, ViewEncapsulation } from '@angular/core';
import { IconDirective, PLUS_ICON, provideIcons } from '../icon';
import { MenuItemComponent } from '../menu';
import { injectSchedulerEditSurface } from './headless';
import { injectSchedulerLabels } from './scheduler-labels';

/**
 * The "Add sub-appointment" item for `<et-scheduler-edit-surface-actions>`: navigates the surface to
 * a blank child of the shown appointment. Renders nothing while that appointment is not saved yet.
 */
@Component({
  selector: 'et-scheduler-edit-add-sub-appointment-item',
  template: `
    @if (surface.isSaved()) {
      <button (click)="surface.startAddSubAppointment()" et-menu-item type="button">
        <i etIcon="et-plus" aria-hidden="true"></i>
        {{ label() }}
      </button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective, MenuItemComponent],
  providers: [provideIcons(PLUS_ICON)],
  host: {
    class: 'et-scheduler-edit-surface-action',
  },
})
export class SchedulerEditAddSubAppointmentItemComponent {
  private labels = injectSchedulerLabels();

  protected surface = injectSchedulerEditSurface();

  protected label = computed(() => this.labels().addSubAppointment);
}
