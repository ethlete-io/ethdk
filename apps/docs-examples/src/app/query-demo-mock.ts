import { HttpErrorResponse, HttpHeaders, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Paginated } from '@ethlete/types';
import { delay, mergeMap, of, throwError } from 'rxjs';

export const MOCK_QUERY_DEMO_BASE_URL = 'https://query-demo.ethlete.local';

const LATENCY_MS = 800;
const TOTAL_POSTS = 40;

let requestNumber = 0;

const failWith = (url: string, message: string) =>
  of(null).pipe(
    delay(LATENCY_MS),
    mergeMap(() =>
      throwError(
        () => new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error', url, error: { message } }),
      ),
    ),
  );

export const mockQueryDemoInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(MOCK_QUERY_DEMO_BASE_URL)) {
    return next(request);
  }

  const url = new URL(request.url);

  if (url.searchParams.has('fail')) {
    return failWith(request.url, 'Something went wrong (on purpose)');
  }

  const respond = (body: unknown) =>
    of(
      new HttpResponse({
        status: 200,
        url: request.url,
        body,
        headers: new HttpHeaders({ 'cache-control': 'max-age=20' }),
      }),
    ).pipe(delay(LATENCY_MS));

  switch (url.pathname) {
    case '/server-time':
      return respond({ requestNumber: ++requestNumber, serverTime: new Date().toLocaleTimeString() });
    case '/match':
      return respond({ home: 'ETH FC', away: 'SDK United', score: '0:0', minute: 1 });
    case '/posts': {
      const currentPage = Number(url.searchParams.get('page') ?? 1);
      const itemsPerPage = Number(url.searchParams.get('limit') ?? 5);
      const totalPageCount = Math.ceil(TOTAL_POSTS / itemsPerPage);
      const body: Paginated<{ id: number; title: string }> = {
        items: Array.from({ length: itemsPerPage }, (_, index) => {
          const id = (currentPage - 1) * itemsPerPage + index + 1;

          return { id, title: `Post #${id}` };
        }),
        currentPage,
        nextPage: currentPage < totalPageCount ? currentPage + 1 : null,
        itemsPerPage,
        totalPageCount,
        totalHits: TOTAL_POSTS,
      };

      return respond(body);
    }
  }

  const post = url.pathname.match(/^\/posts\/(\d+)$/);

  if (post) {
    const id = Number(post[1]);

    return respond({ id, title: `Post #${id}` });
  }

  return next(request);
};
