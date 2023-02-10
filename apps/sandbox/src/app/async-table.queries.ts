import { CustomHeaderAuthProvider, def, QueryClient } from '@ethlete/query';

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

client.setAuthProvider(
  new CustomHeaderAuthProvider({
    name: 'Authorization',
    value:
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1NDFiZjZlMDJhM2I4MWJiMGEzNTNjYTc3OWRmZjllYSIsInN1YiI6IjU3OGY0NTI3YzNhMzY4MTc5NjAwYjIwZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.AfjPjVomOAvWHnh8GP1i9-dtNhG4JEg8X_X5mK1_MIs',
  }),
);

export const searchMovies = client.get({
  route: '/search/movie',
  types: {
    args: def<SearchMovieQuery>(),
    response: def<Paginated<Movie>>(),
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
  types: {
    args: def<{ body: FormData }>(),
    response: def<{ id: string }>(),
  },
});

// const data = new FormData();
// data.append('file', new Blob(['test'], { type: 'text/plain' }), 'test.txt');

// uploadFile
//   .prepare({
//     body: data,
//   })
//   .execute();
