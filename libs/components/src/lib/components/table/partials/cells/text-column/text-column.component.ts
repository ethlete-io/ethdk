import { CdkTextColumn } from '@angular/cdk/table';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
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
        <!-- eslint-disable-next-line @angular-eslint/template/no-call-expression -->
        {{ dataAccessor(data, name) }}
      </td>
    </ng-container>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Default,
  standalone: true,
  imports: [ColumnDefDirective, HeaderCellDefDirective, HeaderCellDirective, CellDefDirective, CellDirective],
})
export class TextColumnComponent<T> extends CdkTextColumn<T> {}
