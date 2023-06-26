import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import {
  InfinityQueryConfigType,
  InfinityQueryDirective,
  InfinityQueryTriggerDirective,
  QueryClient,
  def,
} from '@ethlete/query';

export interface GetMediaSearchArgs {
  queryParams: {
    query?: string;
    page?: number;
    limit?: number;
  };
}

export interface MediaView {
  uuid: string;
}

const queryClient = new QueryClient({ baseRoute: 'http://localhost:3333' });

const getMediaSearch = queryClient.get({
  route: '/media/search',
  types: {
    args: def<GetMediaSearchArgs>(),
    response: def<MediaView[]>(),
  },
});

@Component({
  selector: 'ethlete-query-infinity',
  template: `
    <ul
      *etInfinityQuery="
        config as response;
        currentQuery as currentQuery;
        canLoadMore as canLoadMore;
        loading as loading
      "
    >
      <li></li>

      <button *ngIf="!loading && canLoadMore" etInfinityQueryTrigger>More</button>
    </ul>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective, NgIf],
  hostDirectives: [],
})
export class QueryInfinityComponent {
  protected readonly config: InfinityQueryConfigType<typeof getMediaSearch, MediaView[]> = {
    queryCreator: getMediaSearch,
    defaultArgs: {
      queryParams: {
        limit: 10,
      },
    },
    response: {
      arrayType: def<MediaView[]>(),
      valueExtractor: (response) => response,
      totalPagesExtractor: ({ args }) => args.queryParams.page ?? 1,
    },
  };
}
