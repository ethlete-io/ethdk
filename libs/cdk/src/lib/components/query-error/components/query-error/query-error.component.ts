import { NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TrackByFunction,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { extractQuery } from '@ethlete/query';
import { QUERY_ERROR_TOKEN, QueryErrorDirective } from '../../directives';
import { QueryErrorItem } from '../../types';

@Component({
  selector: 'et-query-error',
  templateUrl: './query-error.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-query-error',
    '[class.et-query-error--can-be-retried]': 'canBeRetried()',
    '[class.et-query-error--is-list]': 'isList()',
  },
  imports: [NgIf, NgFor],
  hostDirectives: [{ directive: QueryErrorDirective, inputs: ['error', 'query'] }],
})
export class QueryErrorComponent {
  protected readonly host = inject(QUERY_ERROR_TOKEN);
  protected readonly errorList = inject(QUERY_ERROR_TOKEN).errorList;

  protected readonly canBeRetried = computed(() => this.errorList()?.canBeRetried ?? false);
  protected readonly isList = computed(() => this.errorList()?.isList ?? false);

  protected trackByFn: TrackByFunction<QueryErrorItem> = (index, item) => item.message;

  protected retry() {
    extractQuery(this.host.query)?.execute({ skipCache: true });
  }
}
