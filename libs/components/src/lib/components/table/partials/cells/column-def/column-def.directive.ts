import { CdkColumnDef, CDK_TABLE } from '@angular/cdk/table';
import { Directive, Inject, InjectionToken, Input, Optional } from '@angular/core';

export const SORT_HEADER_COLUMN_DEF = new InjectionToken<ColumnDefDirective>('SortHeaderColumnDef');

@Directive({
  selector: '[etColumnDef]',
  providers: [
    { provide: CdkColumnDef, useExisting: ColumnDefDirective },
    { provide: SORT_HEADER_COLUMN_DEF, useExisting: ColumnDefDirective },
  ],
  standalone: true,
})
export class ColumnDefDirective extends CdkColumnDef {
  @Input('etColumnDef')
  override get name(): string {
    return this._name;
  }
  override set name(name: string) {
    this._setNameInput(name);
  }

  constructor(@Inject(CDK_TABLE) @Optional() _table?: unknown) {
    super(_table);
  }

  protected override _updateColumnCssClassName() {
    super._updateColumnCssClassName();
    this._columnCssClassName?.push(`et-column-${this.cssClassFriendlyName}`);
  }
}
