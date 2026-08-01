import { HttpErrorResponse, HttpEventType, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { createPostQuery, createQueryClient } from '@ethlete/query';
import { concat, delay, mergeMap, Observable, of, throwError } from 'rxjs';
import { RichTextEditorImageFailure } from '../tools/rich-text-editor-image-upload';

const DEMO_API_URL = 'https://rich-text-editor-image-demo.ethlete.local';

/** Served by Storybook from `apps/playground/src/assets` - a real URL, which is what the value needs
 *  (core's markdown pipeline deliberately refuses `data:` URLs, so a data URI would not round-trip). */
const UPLOADED_IMAGE_URL = '/assets/rich-text-editor-image.svg';

type UploadResponse = { url: string };

export type ImageUploadArgs = { response: UploadResponse; body: FormData };

let uploadCount = 0;

/**
 * Fakes the demo upload endpoint in-browser: it reports upload progress in five steps over ~1s and
 * then answers with the asset's URL, so the story exercises the same code path a real query-backed
 * upload does (including the placeholder's progress readout). `/fail` answers 413 instead.
 */
export const richTextEditorImageDemoInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(DEMO_API_URL)) return next(req);

  if (req.url.endsWith('/fail')) {
    return of(null).pipe(
      delay(900),
      mergeMap(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 413,
              statusText: 'Payload Too Large',
              url: req.url,
              error: { message: 'The image is too large for the demo endpoint' },
            }),
        ),
      ),
    );
  }

  const total = 100;
  const progress = [20, 45, 70, 90].map((loaded) =>
    of({ type: HttpEventType.UploadProgress as const, loaded, total }).pipe(delay(220)),
  );

  const response$ = of(
    new HttpResponse<UploadResponse>({
      status: 200,
      url: req.url,
      body: { url: `${UPLOADED_IMAGE_URL}?upload=${++uploadCount}` },
    }),
  ).pipe(delay(220));

  return concat(...progress, response$) as Observable<never>;
};

const demoClient = createQueryClient({ name: 'rich-text-editor-image-demo', baseUrl: DEMO_API_URL });

/** `reportProgress` is what makes the upload emit progress events - the dropzone upload reads them. */
export const postDemoImage = createPostQuery(demoClient)<ImageUploadArgs>('/images', { reportProgress: true });

export const postFailingDemoImage = createPostQuery(demoClient)<ImageUploadArgs>('/images/fail');

/**
 * What the tool reported through `onFailure`, rendered by the story so the callback is visible.
 * Module-level because the tool config is built outside an injection context - fine for a demo, where
 * only one of the image stories is on screen at a time.
 */
export const demoImageFailures = signal<string[]>([]);

export const recordDemoImageFailure = (failure: RichTextEditorImageFailure) =>
  demoImageFailures.update((failures) => [...failures, `${failure.file.name} (${failure.reason})`]);
