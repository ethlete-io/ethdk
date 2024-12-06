import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { SortHeaderArrowPosition } from '../../partials/sort';
import { SortImports } from '../../sort.imports';
import { SortDirection } from '../../types';

@Component({
  selector: 'et-sb-sort',
  template: `
    <div [etSortStart]="start" etSort>
      <p
        [arrowPosition]="arrowPosition"
        [sortActionDescription]="sortActionDescription"
        [disableClear]="disableClear"
        et-sort-header
      >
        Sort header
      </p>
    </div>
  `,
  imports: [SortImports],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortStorybookComponent {
  @Input()
  arrowPosition: SortHeaderArrowPosition = 'after';

  @Input()
  start!: SortDirection;

  @Input()
  sortActionDescription = 'Sort';

  @Input()
  disableClear = false;
}
