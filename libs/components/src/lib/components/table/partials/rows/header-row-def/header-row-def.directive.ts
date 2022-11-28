import { CdkHeaderRowDef } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: '[etHeaderRowDef]',
  providers: [{ provide: CdkHeaderRowDef, useExisting: HeaderRowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etHeaderRowDef', 'sticky: etHeaderRowDefSticky'],
  standalone: true,
})
export class HeaderRowDefDirective extends CdkHeaderRowDef {}
