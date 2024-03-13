import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { LetDirective } from '@ethlete/core';
import { QueryDirective } from '@ethlete/query';
import { ButtonDirective } from '../../directives/button';
import { QueryButtonDirective } from '../../directives/query-button';

@Component({
  selector: '[et-query-button]',
  templateUrl: './query-button.component.html',
  styleUrls: ['./query-button.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    { directive: QueryButtonDirective, inputs: ['query', 'skipSuccess', 'skipFailure', 'skipLoading'] },
    { directive: ButtonDirective, inputs: ['disabled', 'type', 'pressed'] },
  ],
  imports: [QueryDirective, AsyncPipe, LetDirective],
  host: {
    class: 'et-query-button',
  },
})
export class QueryButtonComponent {
  protected queryButton = inject(QueryButtonDirective);
}
