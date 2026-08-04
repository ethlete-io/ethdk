import { CDK_ROW_TEMPLATE, CdkRow, CdkTableModule } from '@angular/cdk/table';
import { Component, ViewEncapsulation } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-row, [et-row], [et-row]',
  template: CDK_ROW_TEMPLATE,
  host: {
    class: 'et-row et-data-table__row et-legacy',
    role: 'row',
  },
  encapsulation: ViewEncapsulation.None,
  exportAs: 'etRow',
  providers: [{ provide: CdkRow, useExisting: RowComponent }],
  imports: [CdkTableModule],
})
export class RowComponent extends CdkRow {}
