import { CdkHeaderCellDef } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: '[etHeaderCellDef]',
  providers: [{ provide: CdkHeaderCellDef, useExisting: HeaderCellDefDirective }],
  standalone: true,
})
export class HeaderCellDefDirective extends CdkHeaderCellDef {}
