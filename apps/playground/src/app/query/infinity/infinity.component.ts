import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import {
  EntityStore,
  InfinityQueryDirective,
  InfinityQueryTriggerDirective,
  QueryClient,
  createInfinityQueryConfig,
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

const store = new EntityStore<MediaView>({ name: 'media' });

const getMediaSearch = queryClient.get({
  route: '/media/search',
  types: {
    args: def<GetMediaSearchArgs>(),
    response: def<MediaView[]>(),
  },
});

const getMediaSearchNested = queryClient.get({
  route: '/media/search/nested',
  types: {
    args: def<GetMediaSearchArgs>(),
    response: def<{ nested: { response: MediaView[] } }>(),
  },
  entity: {
    store,
    id: ({ response }) => response.nested.response.map(({ uuid }) => uuid),
    get: ({ store, id }) => store.select(id),
    set: ({ response, store, id }) => store.set(id, response.nested.response),
  },
});

const getMediaSearchNested2 = queryClient.get({
  route: '/media/search/nested/2',
  types: {
    args: def<GetMediaSearchArgs>(),
    response: def<{ nested: { response: MediaView[] } }>(),
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

      @if (!loading && canLoadMore) {
        <button etInfinityQueryTrigger>More</button>
      }
    </ul>

    <ul
      *etInfinityQuery="
        config2 as response;
        currentQuery as currentQuery;
        canLoadMore as canLoadMore;
        loading as loading
      "
    >
      <li></li>

      @if (!loading && canLoadMore) {
        <button etInfinityQueryTrigger>More</button>
      }
    </ul>

    <ul
      *etInfinityQuery="
        config3 as response;
        currentQuery as currentQuery;
        canLoadMore as canLoadMore;
        loading as loading
      "
    >
      <li></li>

      @if (!loading && canLoadMore) {
        <button etInfinityQueryTrigger>More</button>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective],
})
export class QueryInfinityComponent {
  protected readonly config = createInfinityQueryConfig({
    queryCreator: getMediaSearch,
    defaultArgs: {
      queryParams: {
        limit: 10,
      },
    },
    response: {
      arrayType: def<MediaView[]>(),
      totalPagesExtractor: ({ args }) => args.queryParams.page ?? 1,
    },
  });

  protected readonly config2 = createInfinityQueryConfig({
    queryCreator: getMediaSearchNested,
    defaultArgs: {
      queryParams: {
        limit: 10,
      },
    },
    response: {
      arrayType: def<MediaView[]>(),
      totalPagesExtractor: ({ args }) => args.queryParams.page ?? 1,
    },
  });

  protected readonly config3 = createInfinityQueryConfig({
    queryCreator: getMediaSearchNested2,
    defaultArgs: {
      queryParams: {
        limit: 10,
      },
    },
    response: {
      arrayType: def<MediaView[]>(),
      valueExtractor: (response) => response.nested.response,
      totalPagesExtractor: ({ args }) => args.queryParams.page ?? 1,
    },
  });
}
