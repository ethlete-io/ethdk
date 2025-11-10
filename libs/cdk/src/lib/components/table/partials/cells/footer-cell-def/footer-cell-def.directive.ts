import { CdkFooterCellDef } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: '[etFooterCellDef]',
  providers: [{ provide: CdkFooterCellDef, useExisting: FooterCellDefDirective }],
})
export class FooterCellDefDirective extends CdkFooterCellDef {}
