import { InjectionToken } from '@angular/core';
import {
  Observable,
  catchError,
  concatMap,
  defer,
  distinctUntilChanged,
  exhaustMap,
  filter,
  first,
  fromEvent,
  map,
  merge,
  of,
  scan,
  startWith,
  switchMap,
  takeWhile,
  timer,
} from 'rxjs';
import { DESIGN_STAMP_PATH } from '../../../host/design-server-pid';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { FrameMessage, frameMessageOf } from './canvas-frame';

export const UNREPORTED_PAINT_MS = 1000;

/** How long after its load event a frame page that sent no message counts as failed. */
export const FRAME_UNREPORTED_PAINT_MS = new InjectionToken<number>('FRAME_UNREPORTED_PAINT_MS', {
  factory: () => UNREPORTED_PAINT_MS,
});

export const SERVER_BACK_POLL_MS = 1000;

/** `failed` is a load without one message of the frame page, like the browser's error page; a failed page still paints when its messages come late or it reloads. */
export type FrameLoad = 'pending' | 'painted' | 'failed';

type PaintMessage = Extract<FrameMessage, { type: 'height' | 'loading' | 'painted' }>;

type PaintEvent = PaintMessage | { type: 'fallback' };

type PaintState = { heard: boolean; height: boolean; late: boolean; load: FrameLoad };

const paintStateOf = (state: PaintState, event: PaintEvent): PaintState => {
  const next = {
    heard: state.heard || event.type !== 'fallback',
    height: state.height || event.type === 'height',
    late: state.late || event.type === 'fallback',
  };
  const painted = event.type === 'painted' || (next.late && next.height);

  return { ...next, load: painted ? 'painted' : next.late && !next.heard ? 'failed' : 'pending' };
};

const nextPaint$ = (view: Window) =>
  new Observable<void>((subscriber) => {
    let frame = view.requestAnimationFrame(() => {
      frame = view.requestAnimationFrame(() => {
        subscriber.next();
        subscriber.complete();
      });
    });

    return () => view.cancelAnimationFrame(frame);
  });

/** Pass `loaded` when the iframe's load event already fired before the call, since a refused page can fire it before anyone listens. */
export const frameLoad$ = (
  iframe: HTMLIFrameElement,
  { unreportedMs = UNREPORTED_PAINT_MS, loaded = false } = {},
): Observable<FrameLoad> => {
  const host = iframe.ownerDocument.defaultView;

  if (!host) return of('painted');

  const messages$ = fromEvent<MessageEvent>(host, 'message').pipe(
    filter((event) => event.source === iframe.contentWindow),
    map((event) => frameMessageOf(event.data)),
    filter(
      (message): message is PaintMessage =>
        message?.type === 'height' || message?.type === 'loading' || message?.type === 'painted',
    ),
  );
  const load$ = fromEvent(iframe, 'load');
  const fallback$ = (loaded ? load$.pipe(startWith(null)) : load$).pipe(
    switchMap(() => timer(unreportedMs)),
    map((): PaintEvent => ({ type: 'fallback' })),
  );

  return merge(messages$, fallback$).pipe(
    scan(paintStateOf, { heard: false, height: false, late: false, load: 'pending' }),
    map(({ load }) => load),
    startWith<FrameLoad>('pending'),
    distinctUntilChanged(),
    takeWhile((load) => load !== 'painted', true),
    concatMap((load) => (load === 'painted' ? nextPaint$(host).pipe(map(() => load)) : of(load))),
  );
};

export const paintedFrame$ = (iframe: HTMLIFrameElement) => frameLoad$(iframe).pipe(map((load) => load === 'painted'));

const designServerOf = (src: string) => (URL.canParse(src) ? new URL(src) : null);

export const failedLoadReason$ = (src: string): Observable<string> => {
  const url = designServerOf(src);

  if (!url) return of('The page sent no frame message.');

  return defer(() => fetch(url, { cache: 'no-store' })).pipe(
    map((response) =>
      response.ok
        ? 'The page loaded but sent no frame message.'
        : `The design server answered ${response.status} ${response.statusText}`.trim() + '.',
    ),
    // eslint-disable-next-line ethlete/no-silent-catch-error -- a refused fetch is the reason the banner names
    catchError(() => of(STUDIO_LABELS.canvas.unanswered)),
  );
};

export const designServerBack$ = (src: string): Observable<void> => {
  const url = designServerOf(src);

  if (!url) return of(undefined);

  const stamp = new URL(DESIGN_STAMP_PATH, url);

  return timer(0, SERVER_BACK_POLL_MS).pipe(
    exhaustMap(() =>
      defer(() => fetch(stamp, { cache: 'no-store' })).pipe(
        map((response) => response.ok),
        // eslint-disable-next-line ethlete/no-silent-catch-error -- a refused stamp read is the not-yet-back answer the poll waits through
        catchError(() => of(false)),
      ),
    ),
    first(Boolean),
    map(() => undefined),
  );
};
