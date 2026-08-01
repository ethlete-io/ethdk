import { Component, inject, input, ViewEncapsulation } from '@angular/core';
import { IconButtonComponent } from '../button/icon-button.component';
import { ARROW_UP_ICON } from '../icon/headless/arrow-up-icon';
import { EYE_SLASH_ICON } from '../icon/headless/eye-icons';
import { ARROWS_LEFT_RIGHT_ICON } from '../icon/headless/arrows-left-right-icon';
import { ELLIPSIS_VERTICAL_ICON } from '../icon/headless/ellipsis-vertical-icon';
import { provideIcons } from '../icon/headless/icon-provider';
import { IconDirective } from '../icon/headless/icon.directive';
import { ROTATE_RIGHT_ICON } from '../icon/headless/rotate-right-icon';
import { TIMES_ICON } from '../icon/headless/times-icon';
import { MenuComponent, MenuDirective, MenuItemComponent, MenuSeparatorComponent, MenuSurfaceDirective } from '../menu';
import { MenuTriggerDirective } from '../menu/headless';
import { TableColumnMenuDirective } from './table-column-menu.directive';
import { TableColumnMeta } from './headless/table-features';

/**
 * The `⋮` column menu for one header cell, stamped there by `etTableColumnMenu` (see
 * `registerHeaderAdornment`).
 *
 * This is where the menu system is actually referenced, and it is created with the feature's own
 * injector, so it reaches the feature - and the table's state - by plain DI.
 *
 * @internal
 */
@Component({
  selector: 'et-table-column-menu-trigger',
  templateUrl: './table-column-menu-trigger.component.html',
  styleUrl: './table-column-menu-trigger.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuComponent,
    MenuItemComponent,
    MenuSeparatorComponent,
    IconButtonComponent,
    IconDirective,
  ],
  providers: [
    provideIcons(
      ELLIPSIS_VERTICAL_ICON,
      ARROW_UP_ICON,
      ARROWS_LEFT_RIGHT_ICON,
      TIMES_ICON,
      ROTATE_RIGHT_ICON,
      EYE_SLASH_ICON,
    ),
  ],
})
export class TableColumnMenuTriggerComponent {
  protected menu = inject(TableColumnMenuDirective);

  /** The column this menu acts on. Set by the table (see {@link TableHeaderAdornment}). */
  public column = input.required<TableColumnMeta>();

  /** The host table's wording - every string here comes from there, never from this component. */
  protected labels = this.menu.table.resolvedLabels;
}
