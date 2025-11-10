import { CdkHeaderCellDef } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: '[etHeaderCellDef]',
  providers: [{ provide: CdkHeaderCellDef, useExisting: HeaderCellDefDirective }],
})
export class HeaderCellDefDirective extends CdkHeaderCellDef {}
