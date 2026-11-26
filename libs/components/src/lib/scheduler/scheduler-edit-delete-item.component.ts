import { Component, computed, ViewEncapsulation } from '@angular/core';
import { IconDirective, provideIcons, TRASH_ICON } from '../icon';
import { MenuItemComponent } from '../menu';
import { injectSchedulerEditSurface } from './headless';
import { injectSchedulerLabels } from './scheduler-labels';

/**
 * The destructive "Delete (with descendants)" item for `<et-scheduler-edit-surface-actions>`: closes
 * the surface with the shown appointment's id and every descendant's. Renders nothing while that
 * appointment is not saved yet.
 */
@Component({
  selector: 'et-scheduler-edit-delete-item',
  template: `
    @if (surface.isSaved()) {
      <button (click)="surface.requestDelete()" et-menu-item type="button" variant="destructive">
        <i etIcon="et-trash" aria-hidden="true"></i>
        {{ label() }}
      </button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective, MenuItemComponent],
  providers: [provideIcons(TRASH_ICON)],
  host: {
    class: 'et-scheduler-edit-surface-action',
  },
})
export class SchedulerEditDeleteItemComponent {
  private labels = injectSchedulerLabels();

  protected surface = injectSchedulerEditSurface();

  protected label = computed(() => this.labels().deleteWithDescendants);
}
