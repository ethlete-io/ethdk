import { HttpErrorResponse, HttpHeaders, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { createGetQuery, createQueryClient } from '@ethlete/query';
import { Paginated } from '@ethlete/types';
import { delay, mergeMap, of, throwError } from 'rxjs';

export const QUERY_DEMO_API_URL = 'https://query-demo.ethlete.local';

const LATENCY_MS = 800;

export type ServerTimeView = {
  requestNumber: number;
  serverTime: string;
};

export type PostView = {
  id: number;
  title: string;
};

export type MatchView = {
  home: string;
  away: string;
  score: string;
  minute: number;
};

let requestNumber = 0;

/**
 * Fakes the demo API inside the browser: ~800ms latency, a `cache-control` header
 * (so the repository cache has a real freshness window) and a forced 500 when a
 * `fail` query param is present.
 */
export const queryDemoApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(QUERY_DEMO_API_URL)) return next(req);

  const url = new URL(req.url);

  if (url.searchParams.has('fail')) {
    return of(null).pipe(
      delay(LATENCY_MS),
      mergeMap(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 500,
              statusText: 'Internal Server Error',
              url: req.url,
              error: { message: 'Something went wrong (on purpose)' },
            }),
        ),
      ),
    );
  }

  const respond = (body: unknown) =>
    of(
      new HttpResponse({
        status: 200,
        url: req.url,
        body,
        // 20s max-age → the default cache adapter halves it into a 10s freshness window
        headers: new HttpHeaders({ 'cache-control': 'max-age=20' }),
      }),
    ).pipe(delay(LATENCY_MS));

  const archivePost = url.pathname.match(/^\/posts\/(\d+)$/);

  if (archivePost && req.method === 'PATCH') {
    const id = Number(archivePost[1]);

    // Uneven per-item cost, so a batch's remaining-time estimate has something to move around on.
    const latency = LATENCY_MS * (0.4 + (id % 5) * 0.2);

    if (id % 7 === 0) {
      return of(null).pipe(
        delay(latency),
        mergeMap(() =>
          throwError(
            () =>
              new HttpErrorResponse({
                status: 500,
                statusText: 'Internal Server Error',
                url: req.url,
                error: { message: `Post ${id} could not be archived` },
              }),
          ),
        ),
      );
    }

    return of(new HttpResponse({ status: 200, url: req.url, body: { id, archived: true } })).pipe(delay(latency));
  }

  switch (url.pathname) {
    case '/server-time': {
      const body: ServerTimeView = { requestNumber: ++requestNumber, serverTime: new Date().toLocaleTimeString() };
      return respond(body);
    }
    case '/posts': {
      const currentPage = Number(url.searchParams.get('page') ?? 1);
      const itemsPerPage = Number(url.searchParams.get('limit') ?? 5);
      const totalHits = 40;
      const totalPageCount = Math.ceil(totalHits / itemsPerPage);
      const body: Paginated<PostView> = {
        items: Array.from({ length: itemsPerPage }, (_, i) => {
          const id = (currentPage - 1) * itemsPerPage + i + 1;
          return { id, title: `Post #${id}` };
        }),
        currentPage,
        nextPage: currentPage < totalPageCount ? currentPage + 1 : null,
        itemsPerPage,
        totalPageCount,
        totalHits,
      };
      return respond(body);
    }
    case '/match': {
      const body: MatchView = { home: 'ETH FC', away: 'SDK United', score: '0:0', minute: 1 };
      return respond(body);
    }
  }

  return next(req);
};

export const queryDemoClient = createQueryClient({
  name: 'query-demo',
  baseUrl: QUERY_DEMO_API_URL,
});

export const demoGetQuery = createGetQuery(queryDemoClient);
