import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Component, ViewEncapsulation } from '@angular/core';
import { createPostQuery, createQueryClient, queryErrorMessage } from '@ethlete/query';
import { delay, firstValueFrom, map, mergeMap, of, throwError, timer } from 'rxjs';
import { BUTTON_IMPORTS } from '../../../button';
import { injectNotificationManager, provideNotificationManager } from '../../notification-manager';

const DEMO_API_URL = 'https://notification-promise-demo.ethlete.local';
const LATENCY_MS = 1500;

type SaveResponse = { name: string };

/** Fakes the demo API in-browser: ~1.5s latency, and a 500 for the `/fail` route. */
export const notificationPromiseDemoInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(DEMO_API_URL)) return next(req);

  if (req.url.endsWith('/fail')) {
    return of(null).pipe(
      delay(LATENCY_MS),
      mergeMap(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 500,
              statusText: 'Internal Server Error',
              url: req.url,
              error: { message: 'The server is having a moment' },
            }),
        ),
      ),
    );
  }

  return of(new HttpResponse<SaveResponse>({ status: 200, url: req.url, body: { name: 'report-q4.pdf' } })).pipe(
    delay(LATENCY_MS),
  );
};

const demoClient = createQueryClient({ name: 'notification-promise-demo', baseUrl: DEMO_API_URL });

const postSave = createPostQuery(demoClient)<{ response: SaveResponse; body: { name: string } }>('/save');
const postFail = createPostQuery(demoClient)<{ response: SaveResponse; body: { name: string } }>('/fail');

@Component({
  selector: 'et-sb-notification-promise',
  template: `
    <div class="flex flex-col gap-4 p-8 font-sans">
      <p class="m-0 text-xs font-semibold uppercase tracking-widest text-slate-500">manager.promise()</p>

      <div class="flex flex-wrap gap-2">
        <button (click)="fromPromise(true)" et-button size="sm" variant="outline">Promise resolves</button>
        <button (click)="fromPromise(false)" et-button size="sm" variant="outline">Promise rejects</button>
        <button (click)="fromObservable()" et-button size="sm" variant="outline">Observable</button>
      </div>

      <div class="flex flex-wrap gap-2">
        <button (click)="fromQuery(true)" et-button size="sm" variant="tonal">Query succeeds</button>
        <button (click)="fromQuery(false)" et-button size="sm" variant="tonal">Query fails</button>
        <button (click)="manager.dismissAll()" et-button size="sm" variant="transparent">Dismiss all</button>
      </div>

      <p class="m-0 text-xs text-slate-500">
        Every button opens one notification that turns into its own result - the loading toast is never replaced by a
        second one.
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  providers: [
    provideNotificationManager({
      position: 'bottom-end',
      statusColorMapping: { info: 'brand', error: 'danger', success: 'brand', loading: 'brand' },
    }),
  ],
})
export class NotificationPromiseStorybookComponent {
  protected manager = injectNotificationManager();

  // Queries live in an injection context, so they are created here and only executed per click.
  private saveQuery = postSave();
  private failQuery = postFail();

  public fromPromise(succeeds: boolean) {
    const work = firstValueFrom(
      timer(LATENCY_MS).pipe(
        map((): SaveResponse => {
          if (!succeeds) throw new Error('Disk full');

          return { name: 'report-q4.pdf' };
        }),
      ),
    );

    this.manager.promise(work, {
      loading: 'Saving…',
      success: (saved) => ({ title: 'Saved', message: `${saved.name} is safe.` }),
      error: (error) => ({ title: 'Could not save', message: (error as Error).message }),
    });
  }

  public fromObservable() {
    this.manager.promise(timer(LATENCY_MS).pipe(mergeMap(() => of(3))), {
      loading: { title: 'Counting files…', message: 'Walking the directory.' },
      success: (count) => `Found ${count} files`,
      error: 'Could not count the files',
    });
  }

  /**
   * The query is executed here and only followed by the notification - which is why the failing case
   * shows the API's own error, straight off the `QueryErrorResponse`.
   */
  public fromQuery(succeeds: boolean) {
    const query = succeeds ? this.saveQuery : this.failQuery;

    query.execute({ args: { body: { name: 'report-q4.pdf' } } });

    this.manager.promise(query, {
      loading: 'Uploading…',
      success: (saved) => ({ title: 'Upload complete', message: `${saved.name} is on the server.` }),
      error: (error) => ({
        title: `Upload failed (${error.code})`,
        message: queryErrorMessage(error) ?? 'Unknown error',
      }),
    });
  }
}
