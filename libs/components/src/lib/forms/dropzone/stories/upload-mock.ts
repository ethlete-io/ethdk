import { HttpErrorResponse, HttpEvent, HttpEventType, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { concat, interval, mergeMap, of, take, throwError } from 'rxjs';

export const MOCK_UPLOAD_BASE_URL = 'https://dropzone.demo';

const PROGRESS_STEPS = 10;
const PROGRESS_INTERVAL_MS = 250;

const failedOnce = new Set<string>();

/**
 * Story-only interceptor that simulates a multipart upload endpoint including
 * upload progress events. Requests to the `/upload-flaky` route fail on the
 * first attempt per file name and succeed on retries.
 */
export const mockUploadInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(MOCK_UPLOAD_BASE_URL)) {
    return next(request);
  }

  const file = request.body instanceof FormData ? (request.body.get('file') as File | null) : null;
  const isFlaky = request.url.includes('/upload-flaky');
  const shouldFail = isFlaky && !!file && !failedOnce.has(file.name);

  if (shouldFail && file) {
    failedOnce.add(file.name);
  }

  // pretend a decent file size so the progress animation is visible
  const total = Math.max(file?.size ?? 0, 400_000);

  return concat(
    of<HttpEvent<unknown>>({ type: HttpEventType.Sent }),
    interval(PROGRESS_INTERVAL_MS).pipe(
      take(PROGRESS_STEPS),
      mergeMap((tick) => {
        const step = tick + 1;

        if (step < PROGRESS_STEPS) {
          return of<HttpEvent<unknown>>({
            type: HttpEventType.UploadProgress,
            loaded: Math.round((step / PROGRESS_STEPS) * total),
            total,
          });
        }

        if (shouldFail) {
          return throwError(
            () =>
              new HttpErrorResponse({
                status: 500,
                statusText: 'Server Error',
                url: request.url,
                error: { message: 'Simulated upload failure. Retrying will succeed.' },
              }),
          );
        }

        return of<HttpEvent<unknown>>(
          new HttpResponse({
            body: {
              uuid: crypto.randomUUID(),
              name: file?.name ?? 'unknown',
            },
          }),
        );
      }),
    ),
  );
};
