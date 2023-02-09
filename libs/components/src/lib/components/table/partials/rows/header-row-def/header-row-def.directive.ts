import { CdkHeaderRowDef, CDK_TABLE } from '@angular/cdk/table';
import { Directive, Inject, IterableDiffers, Optional, TemplateRef } from '@angular/core';

@Directive({
  selector: '[etHeaderRowDef]',
  providers: [{ provide: CdkHeaderRowDef, useExisting: HeaderRowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etHeaderRowDef', 'sticky: etHeaderRowDefSticky'],
  standalone: true,
})
export class HeaderRowDefDirective extends CdkHeaderRowDef {
  constructor(
    template: TemplateRef<unknown>,
    _differs: IterableDiffers,
    @Inject(CDK_TABLE) @Optional() _table?: unknown,
  ) {
    super(template, _differs, _table);
  }
}
