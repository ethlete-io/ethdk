import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TrackByFunction,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { extractQuery } from '@ethlete/query';
import { QUERY_ERROR_TOKEN, QueryErrorDirective } from '../../directives/query-error';
import { QueryErrorItem } from '../../types';

@Component({
  selector: 'et-query-error',
  templateUrl: './query-error.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-query-error-host',
  },
  imports: [NgClass],
  hostDirectives: [{ directive: QueryErrorDirective, inputs: ['error', 'query', 'language'] }],
})
export class QueryErrorComponent {
  protected readonly host = inject(QUERY_ERROR_TOKEN);
  protected readonly errorList = inject(QUERY_ERROR_TOKEN).errorList;

  protected readonly canBeRetried = computed(() => this.errorList()?.canBeRetried ?? false);
  protected readonly isList = computed(() => this.errorList()?.isList ?? false);

  protected trackByFn: TrackByFunction<QueryErrorItem> = (index, item) => item.message;

  protected retry() {
    extractQuery(this.host.query())?.execute({ skipCache: true });
  }
}
