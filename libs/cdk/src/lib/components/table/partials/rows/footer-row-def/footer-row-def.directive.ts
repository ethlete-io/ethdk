import { CdkFooterRowDef, CDK_TABLE } from '@angular/cdk/table';
import { Directive, Inject, IterableDiffers, Optional, TemplateRef } from '@angular/core';

@Directive({
  selector: '[etFooterRowDef]',
  providers: [{ provide: CdkFooterRowDef, useExisting: FooterRowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etFooterRowDef', 'sticky: etFooterRowDefSticky'],
  standalone: true,
})
export class FooterRowDefDirective extends CdkFooterRowDef {
  constructor(
    template: TemplateRef<unknown>,
    _differs: IterableDiffers,
    @Inject(CDK_TABLE) @Optional() _table?: unknown,
  ) {
    super(template, _differs, _table);
  }
}
