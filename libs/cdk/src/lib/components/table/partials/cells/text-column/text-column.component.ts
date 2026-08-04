import { CdkTextColumn } from '@angular/cdk/table';
import { Component, ViewEncapsulation } from '@angular/core';
import { CellDirective } from '../cell';
import { CellDefDirective } from '../cell-def';
import { ColumnDefDirective } from '../column-def';
import { HeaderCellDirective } from '../header-cell';
import { HeaderCellDefDirective } from '../header-cell-def';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
  imports: [ColumnDefDirective, HeaderCellDefDirective, HeaderCellDirective, CellDefDirective, CellDirective],
})
export class TextColumnComponent<T> extends CdkTextColumn<T> {}
