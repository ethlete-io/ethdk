import { CdkCellDef } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: '[etCellDef]',
  providers: [{ provide: CdkCellDef, useExisting: CellDefDirective }],
})
export class CellDefDirective extends CdkCellDef {}
