import { CdkNoDataRow } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: 'ng-template[etNoDataRow]',
  providers: [{ provide: CdkNoDataRow, useExisting: NoDataRowDirective }],
  standalone: true,
})
export class NoDataRowDirective extends CdkNoDataRow {
  override _contentClassName = 'et-no-data-row';
}
