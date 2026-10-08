import { Component, computed, inject, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '../button';
import { ELLIPSIS_VERTICAL_ICON, IconDirective, provideIcons } from '../icon';
import { MenuComponent, MenuDirective, MenuSurfaceDirective, MenuTriggerDirective } from '../menu';
import { injectSchedulerLabels } from './scheduler-labels';

/**
 * The edit surface's action menu. Its content is the menu: `et-menu-item` buttons, or the ready-made
 * `<et-scheduler-edit-add-sub-appointment-item>` and `<et-scheduler-edit-delete-item>`. Hidden while
 * no item is rendered. Place it inside `<et-scheduler-edit-surface-header>`.
 */
@Component({
  selector: 'et-scheduler-edit-surface-actions',
  template: `
    <button [attr.aria-label]="moreActionsLabel()" et-icon-button etMenuTrigger size="sm" type="button">
      <i etIcon="et-ellipsis-vertical"></i>
    </button>

    <ng-template etMenuSurface>
      <et-menu>
        <ng-content />
      </et-menu>
    </ng-template>
  `,
  styleUrl: './scheduler-edit-surface-actions.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS, IconDirective, MenuComponent, MenuSurfaceDirective, MenuTriggerDirective],
  providers: [provideIcons(ELLIPSIS_VERTICAL_ICON)],
  hostDirectives: [MenuDirective],
  host: {
    class: 'et-scheduler-edit-surface-actions',
    '[hidden]': '!hasItems()',
  },
})
export class SchedulerEditSurfaceActionsComponent {
  private labels = injectSchedulerLabels();
  private menu = inject(MenuDirective);

  protected moreActionsLabel = computed(() => this.labels().moreActions);

  protected hasItems = computed(() => this.menu.sortedItems().length > 0);
}
