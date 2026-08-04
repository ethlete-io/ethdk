import { CdkHeaderCell } from '@angular/cdk/table';
import { Directive } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'et-header-cell, th[et-header-cell]',
  host: {
    class: 'et-header-cell et-data-table__header-cell et-legacy',
    role: 'columnheader',
  },
})
export class HeaderCellDirective extends CdkHeaderCell {}
