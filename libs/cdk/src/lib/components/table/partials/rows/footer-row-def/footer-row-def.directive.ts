import { CdkFooterRowDef } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: '[etFooterRowDef]',
  providers: [{ provide: CdkFooterRowDef, useExisting: FooterRowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etFooterRowDef', 'sticky: etFooterRowDefSticky'],
  standalone: true,
})
export class FooterRowDefDirective extends CdkFooterRowDef {}
