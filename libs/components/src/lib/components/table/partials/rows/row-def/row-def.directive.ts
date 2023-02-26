import { CdkRowDef, CDK_TABLE } from '@angular/cdk/table';
import { Directive, Inject, IterableDiffers, Optional, TemplateRef } from '@angular/core';

@Directive({
  selector: '[etRowDef]',
  providers: [{ provide: CdkRowDef, useExisting: RowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etRowDefColumns', 'when: etRowDefWhen'],
  standalone: true,
})
export class RowDefDirective<T> extends CdkRowDef<T> {
  constructor(
    template: TemplateRef<unknown>,
    _differs: IterableDiffers,
    @Inject(CDK_TABLE) @Optional() _table?: unknown,
  ) {
    super(template, _differs, _table);
  }
}
