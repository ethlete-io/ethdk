import { CDK_ROW_TEMPLATE, CdkHeaderRow, CdkTableModule } from '@angular/cdk/table';
import { Component, ViewEncapsulation } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-header-row, tr[et-header-row]',
  template: CDK_ROW_TEMPLATE,
  host: {
    class: 'et-header-row et-data-table__header-row et-legacy',
    role: 'row',
  },
  encapsulation: ViewEncapsulation.None,
  exportAs: 'etHeaderRow',
  providers: [{ provide: CdkHeaderRow, useExisting: HeaderRowComponent }],
  imports: [CdkTableModule],
})
export class HeaderRowComponent extends CdkHeaderRow {}
