import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Paginated } from '@ethlete/types';
import { delay, of } from 'rxjs';

export const MOCK_PAGED_QUERY_BASE_URL = 'https://paged-query.demo';

export const MOCK_PAGED_QUERY_TOTAL_PAGES = 4;

export type MockMatch = { id: number; home: string; away: string };

const TEAMS = ['Lions', 'Falcons', 'Rovers', 'Comets', 'Wolves', 'Harbour', 'United', 'Athletic'];

const createMatch = (id: number): MockMatch => ({
  id,
  home: TEAMS[id % TEAMS.length] ?? 'Home',
  away: TEAMS[(id * 3 + 1) % TEAMS.length] ?? 'Away',
});

export const mockPagedQueryInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(MOCK_PAGED_QUERY_BASE_URL)) {
    return next(request);
  }

  const params = new URL(request.urlWithParams).searchParams;
  const currentPage = Number(params.get('page') ?? 1);
  const itemsPerPage = Number(params.get('limit') ?? 6);
  const firstId = (currentPage - 1) * itemsPerPage + 1;

  const body: Paginated<MockMatch> = {
    items: Array.from({ length: itemsPerPage }, (_, index) => createMatch(firstId + index)),
    currentPage,
    nextPage: currentPage < MOCK_PAGED_QUERY_TOTAL_PAGES ? currentPage + 1 : null,
    totalPageCount: MOCK_PAGED_QUERY_TOTAL_PAGES,
    itemsPerPage,
    totalHits: MOCK_PAGED_QUERY_TOTAL_PAGES * itemsPerPage,
  };

  return of(new HttpResponse({ status: 200, body })).pipe(delay(Number(params.get('delay') ?? 600)));
};
