/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { SortHeaderArrowPosition } from '../../partials';
import { SortModule } from '../../sort.module';
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
  standalone: true,
  imports: [SortModule],

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
