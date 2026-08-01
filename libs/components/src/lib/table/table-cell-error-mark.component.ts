import { Component, inject, input, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { provideIcons } from '../icon/headless/icon-provider';
import { IconDirective } from '../icon/headless/icon.directive';
import { TRIANGLE_EXCLAMATION_ICON } from '../icon/headless/triangle-exclamation-icon';
import { TooltipDirective } from '../tooltip/headless/tooltip.directive';
import { TableCellErrorTooltipDirective } from './table-cell-error-tooltip.directive';

/**
 * The mark drawn in a failed cell when `etTableCellErrorTooltip` is imported: the same glyph the base
 * table draws, with the cell's message on a real tooltip instead of a native `title`.
 *
 * This is where the tooltip - and with it the overlay runtime and floating-ui - is actually referenced,
 * which is the whole reason the feature is separate. Stamped only into cells that are in the error
 * state, so even with the feature imported a healthy table creates none of these.
 *
 * @internal
 */
@Component({
  selector: 'et-table-cell-error-mark',
  template: `
    <i
      [etProvideColor]="feature.table.errorColorTheme"
      [etTooltip]="message()"
      [etTooltipDisabled]="!message()"
      [attr.aria-label]="message()"
      [attr.aria-hidden]="message() ? null : 'true'"
      [attr.tabindex]="message() ? 0 : null"
      class="et-table-cell-error-icon"
      etIcon="et-triangle-exclamation"
    ></i>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective, TooltipDirective, ProvideColorDirective],
  providers: [provideIcons(TRIANGLE_EXCLAMATION_ICON)],
})
export class TableCellErrorMarkComponent {
  protected feature = inject(TableCellErrorTooltipDirective);

  /** What went wrong, from the cell's `cellState`. Set by the table. */
  public message = input<string | null>(null);
}
