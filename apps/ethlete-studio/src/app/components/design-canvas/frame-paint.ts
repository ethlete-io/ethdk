import { Observable, filter, fromEvent, map, merge, of, scan, startWith, switchMap, take, timer } from 'rxjs';
import { FrameMessage, frameMessageOf } from './canvas-frame';

export const UNREPORTED_PAINT_MS = 1000;

type PaintEvent = Extract<FrameMessage, { type: 'height' | 'loading' }> | { type: 'fallback' };

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

export const paintedFrame$ = (iframe: HTMLIFrameElement) => {
  const host = iframe.ownerDocument.defaultView;

  if (!host) return of(true);

  const messages$ = fromEvent<MessageEvent>(host, 'message').pipe(
    filter((event) => event.source === iframe.contentWindow),
    map((event) => frameMessageOf(event.data)),
    filter(
      (message): message is Extract<FrameMessage, { type: 'height' | 'loading' }> =>
        message?.type === 'height' || message?.type === 'loading',
    ),
  );
  const fallback$ = fromEvent(iframe, 'load').pipe(
    switchMap(() => timer(UNREPORTED_PAINT_MS)),
    map((): PaintEvent => ({ type: 'fallback' })),
  );

  return merge(messages$, fallback$).pipe(
    scan(
      (state, event) => ({
        loading: state.loading || event.type === 'loading',
        painted: event.type === 'height' || (event.type === 'fallback' && !state.loading),
      }),
      { loading: false, painted: false },
    ),
    filter(({ painted }) => painted),
    take(1),
    switchMap(() => nextPaint$(host)),
    map(() => true),
    startWith(false),
  );
};
