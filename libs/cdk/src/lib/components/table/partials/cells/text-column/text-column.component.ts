import { CdkTable, CdkTextColumn, TextColumnOptions, TEXT_COLUMN_OPTIONS } from '@angular/cdk/table';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { CellDirective } from '../cell';
import { CellDefDirective } from '../cell-def';
import { ColumnDefDirective } from '../column-def';
import { HeaderCellDirective } from '../header-cell';
import { HeaderCellDefDirective } from '../header-cell-def';

@Component({
  selector: 'et-text-column',
  template: `
    <ng-container etColumnDef>
      <th *etHeaderCellDef [style.text-align]="justify" et-header-cell>
        {{ headerText }}
      </th>
      <td *etCellDef="let data" [style.text-align]="justify" et-cell>
        {{ dataAccessor(data, name) }}
      </td>
    </ng-container>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [ColumnDefDirective, HeaderCellDefDirective, HeaderCellDirective, CellDefDirective, CellDirective],
})
export class TextColumnComponent<T> extends CdkTextColumn<T> {
  constructor() {
    const _table = inject<CdkTable<T>>(CdkTable, { optional: true });
    const _options = inject<TextColumnOptions<T>>(TEXT_COLUMN_OPTIONS, { optional: true });

    super(_table, _options);
  }
}
