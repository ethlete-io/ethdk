import { CdkFooterCell } from '@angular/cdk/table';
import { Directive } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'et-footer-cell, td[et-footer-cell]',
  host: {
    class: 'et-footer-cell et-data-table__cell et-legacy',
  },
})
export class FooterCellDirective extends CdkFooterCell {}
