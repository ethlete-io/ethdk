import { CDK_TABLE, CdkHeaderRowDef } from '@angular/cdk/table';
import { Directive, IterableDiffers, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: '[etHeaderRowDef]',
  providers: [{ provide: CdkHeaderRowDef, useExisting: HeaderRowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etHeaderRowDef', 'sticky: etHeaderRowDefSticky'],
})
export class HeaderRowDefDirective extends CdkHeaderRowDef {
  constructor() {
    const template = inject<TemplateRef<unknown>>(TemplateRef);
    const _differs = inject(IterableDiffers);
    const _table = inject(CDK_TABLE, { optional: true });

    super(template, _differs, _table);
  }
}
