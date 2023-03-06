import {
  castQueryCreator as castQueryCreatorTypes,
  CustomHeaderAuthProvider,
  def,
  filterSuccess,
  ignoreAutoRefresh,
  QueryClient,
} from '@ethlete/query';

export interface SearchMovieQuery {
  queryParams: {
    page?: number;
    query: string;
    language?: string;
    include_adult?: boolean;
    region?: string;
    year?: string;
    primary_release_year?: string;
  };
}

export interface Paginated<T> {
  page: number;
  results: T[];
  total_results: number;
  total_pages: number;
}

export interface Movie {
  poster_path: null | string;
  adult: boolean;
  overview: string;
  release_date: Date;
  genre_ids: number[];
  id: number;
  original_title: string;
  original_language: string;
  title: string;
  backdrop_path: null | string;
  popularity: number;
  vote_count: number;
  video: boolean;
  vote_average: number;
}

export const client = new QueryClient({
  baseRoute: 'https://api.themoviedb.org/3',
});

export const client2 = new QueryClient({
  baseRoute: 'https://api.themoviedb.org/3',
});

export const jsonClient = new QueryClient({
  baseRoute: 'https://jsonplaceholder.typicode.com',
  request: {
    cacheAdapter: () => 1,
  },
});

client.setAuthProvider(
  new CustomHeaderAuthProvider({
    name: 'Authorization',
    value:
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1NDFiZjZlMDJhM2I4MWJiMGEzNTNjYTc3OWRmZjllYSIsInN1YiI6IjU3OGY0NTI3YzNhMzY4MTc5NjAwYjIwZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.AfjPjVomOAvWHnh8GP1i9-dtNhG4JEg8X_X5mK1_MIs',
  }),
);

client.setDefaultHeaders({
  refreshQueriesInUse: true,
  headers: {
    'X-Stuff': 'stuff',
  },
});

export const searchMovies = client.get({
  route: '/search/movie',
  types: {
    args: def<SearchMovieQuery>(),
    response: def<Paginated<Movie>>(),
  },
  autoRefreshOn: {
    queryClientDefaultHeadersChange: false,
  },
});

export interface DiscoverMovieQuery {
  queryParams: {
    page?: number;
    with_keywords?: string;
    language?: string;
    include_adult?: boolean;
    region?: string;
    year?: string;
    primary_release_year?: string;
    sort_by?: string;
    'vote_average.gte'?: number;
  };
}

export const discoverMovies = client.get({
  route: '/discover/movie',
  reportProgress: true,
  types: {
    args: def<DiscoverMovieQuery>(),
    response: def<Paginated<Movie>>(),
  },
});

export const testCall = client.get({
  route: '/discover/movie',
  types: {
    response: def<Paginated<{ id: string; name: string; someValue: string }>>(),
  },
});

export const uploadFile = client.post({
  route: '/upload',
  reportProgress: true,
  types: {
    args: def<{ body: FormData }>(),
    response: def<{ id: string }>(),
  },
});

// <Arguments, Method, Response, Route, ResponseTransformer>

const uploadFile2 = castQueryCreatorTypes({
  creator: uploadFile,
  args: def<{ body: FormData; queryParams: { x: string } }>(),
});

export const getPosts = jsonClient.get({
  route: '/posts',
  types: {
    response: def<{ id: string; title: string; body: string }[]>(),
  },
});

export const getPost = jsonClient.get({
  route: (p) => `/posts/${p.id}`,
  types: {
    args: def<{ pathParams: { id: string } }>(),
    response: def<{ id: string; title: string; body: string }>(),
  },
});

getPosts
  .prepare()
  .execute()
  .state$.pipe(filterSuccess(), ignoreAutoRefresh())
  .subscribe((state) => {
    console.log('getPosts', state);

    const isAutoRefresh = state.meta.triggeredVia === 'auto';

    getPost
      .prepare({ pathParams: { id: '1' } })
      .execute()
      .state$.subscribe(console.log);
  });

// const uploadFile: QueryCreator<{
//   body: FormData;
// }, "POST", {
//   id: string;
// }, "/upload", DefaultResponseTransformer<{
//   id: string;
// }>>

// const uploadFile2: QueryCreator<{
//   body: FormData;
// }, "POST", {
//   id: string;
// }, `/${string}`, DefaultResponseTransformer<{
//   id: string;
// }>>

// const data = new FormData();
// data.append('file', new Blob(['test'], { type: 'text/plain' }), 'test.txt');

// uploadFile
//   .prepare({
//     body: data,
//   })
//   .execute();
