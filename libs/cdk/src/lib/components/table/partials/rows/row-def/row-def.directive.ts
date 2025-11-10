import { CDK_TABLE, CdkRowDef } from '@angular/cdk/table';
import { Directive, IterableDiffers, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: '[etRowDef]',
  providers: [{ provide: CdkRowDef, useExisting: RowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etRowDefColumns', 'when: etRowDefWhen'],
})
export class RowDefDirective<T> extends CdkRowDef<T> {
  constructor() {
    const template = inject<TemplateRef<unknown>>(TemplateRef);
    const _differs = inject(IterableDiffers);
    const _table = inject(CDK_TABLE, { optional: true });

    super(template, _differs, _table);
  }
}
