/* eslint-disable @angular-eslint/no-inputs-metadata-property */
import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { LetDirective } from '@ethlete/core';
import { QueryDirective } from '@ethlete/query';
import { ButtonDirective, QueryButtonDirective } from '../../directives';

@Component({
  selector: '[et-query-button]',
  templateUrl: './query-button.component.html',
  styleUrls: ['./query-button.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    { directive: QueryButtonDirective, inputs: ['etQuery'] },
    { directive: ButtonDirective, inputs: ['disabled', 'type', 'pressed'] },
  ],
  imports: [QueryDirective, AsyncPipe, NgIf, LetDirective],
  host: {
    class: 'et-query-button',
  },
})
export class QueryButtonComponent {
  protected queryButton = inject(QueryButtonDirective);
}
