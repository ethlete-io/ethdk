import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { injectLocale } from '@ethlete/core';
import { IconButtonComponent } from '../button/icon-button.component';
import { ICON_IMPORTS, TIMES_ICON, provideIcons } from '../icon';
import { GridItemToolbarComponent } from './grid-item-toolbar.component';
import { injectGridConfig } from './headless/grid-config';
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

      &:hover {
        color: rgb(var(--et-surface-color));
      }
    }
  `,
})
export class GridItemDefaultActionsComponent {
  private grid = inject(GRID_TOKEN);
  private gridConfig = injectGridConfig();
  private locale = injectLocale();

  public itemId = input.required<string>();
  public data = input<unknown>();

  protected removeAriaLabel = computed(() =>
    this.gridConfig.transformer(this.gridConfig.removeActionAriaLabel, this.locale.currentLocale()),
  );

  protected remove() {
    this.grid.removeItem(this.itemId());
  }
}
