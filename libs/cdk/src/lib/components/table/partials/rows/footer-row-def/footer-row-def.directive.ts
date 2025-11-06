import { CdkFooterRowDef, CDK_TABLE } from '@angular/cdk/table';
import { Directive, IterableDiffers, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: '[etFooterRowDef]',
  providers: [{ provide: CdkFooterRowDef, useExisting: FooterRowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etFooterRowDef', 'sticky: etFooterRowDefSticky'],
  standalone: true,
})
export class FooterRowDefDirective extends CdkFooterRowDef {
  constructor() {
    const template = inject<TemplateRef<unknown>>(TemplateRef);
    const _differs = inject(IterableDiffers);
    const _table = inject(CDK_TABLE, { optional: true });

    super(template, _differs, _table);
  }
}
