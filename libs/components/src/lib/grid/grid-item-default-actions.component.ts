import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { injectGridLabels } from './grid-labels';
import { IconButtonComponent } from '../button/icon-button.component';
import { ICON_IMPORTS, TIMES_ICON, provideIcons } from '../icon';
import { GridItemToolbarComponent } from './grid-item-toolbar.component';
import { GridItemComponent } from './grid-item.component';
import { GRID_TOKEN } from './headless/grid.tokens';

@Component({
  selector: 'et-grid-item-default-actions',
  template: `
    <et-grid-item-toolbar>
      <button
        [attr.aria-label]="removeAriaLabel()"
        (click)="remove()"
        class="et-grid-item-default-actions__remove"
        et-icon-button
        size="xs"
        type="button"
      >
        <i etIcon="et-times"></i>
      </button>
    </et-grid-item-toolbar>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [GridItemToolbarComponent, IconButtonComponent, ...ICON_IMPORTS],
  providers: [provideIcons(TIMES_ICON)],
  styles: `
    et-grid-item-default-actions .et-grid-item-default-actions__remove {
      color: rgb(var(--et-surface-color-muted));

      @media (hover: hover) {
        &:hover {
          color: rgb(var(--et-surface-color));
        }
      }
    }
  `,
})
export class GridItemDefaultActionsComponent {
  private grid = inject(GRID_TOKEN);
  private item = inject(GridItemComponent, { optional: true });
  private labels = injectGridLabels();

  public itemId = input.required<string>();
  public data = input<unknown>();

  protected removeAriaLabel = computed(() => this.labels().removeItem);

  protected remove() {
    if (this.item) {
      this.item.removeItem();
    } else {
      this.grid.removeItem(this.itemId());
    }
  }
}
