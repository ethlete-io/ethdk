import { CdkNoDataRow } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: 'ng-template[etNoDataRow]',
  providers: [{ provide: CdkNoDataRow, useExisting: NoDataRowDirective }],
})
export class NoDataRowDirective extends CdkNoDataRow {
  override _contentClassNames = ['et-no-data-row'];
}
