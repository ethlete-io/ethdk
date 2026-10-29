import { CdkRowDef } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: '[etRowDef]',
  providers: [{ provide: CdkRowDef, useExisting: RowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etRowDefColumns', 'when: etRowDefWhen'],
  standalone: true,
})
export class RowDefDirective<T> extends CdkRowDef<T> {}
