import { CdkColumnDef } from '@angular/cdk/table';
import { Directive, InjectionToken, Input } from '@angular/core';

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

  protected override _updateColumnCssClassName() {
    super._updateColumnCssClassName();
    this._columnCssClassName?.push(`et-column-${this.cssClassFriendlyName}`);
  }
}
