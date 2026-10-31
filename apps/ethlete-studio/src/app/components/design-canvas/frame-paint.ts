import { Observable, filter, fromEvent, map, merge, of, scan, startWith, switchMap, take, timer } from 'rxjs';
import { FrameMessage, frameMessageOf } from './canvas-frame';

export const UNREPORTED_PAINT_MS = 1000;

type PaintMessage = Extract<FrameMessage, { type: 'height' | 'loading' | 'painted' }>;

type PaintEvent = PaintMessage | { type: 'fallback' };

type PaintState = { loading: boolean; height: boolean; late: boolean; painted: boolean };

const paintStateOf = (state: PaintState, event: PaintEvent): PaintState => {
  const next = {
    loading: state.loading || event.type === 'loading',
    height: state.height || event.type === 'height',
    late: state.late || event.type === 'fallback',
  };

  return {
    ...next,
    painted: event.type === 'painted' || (next.late && (next.height || !next.loading)),
  };
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

export const paintedFrame$ = (iframe: HTMLIFrameElement) => {
  const host = iframe.ownerDocument.defaultView;

  if (!host) return of(true);

  const messages$ = fromEvent<MessageEvent>(host, 'message').pipe(
    filter((event) => event.source === iframe.contentWindow),
    map((event) => frameMessageOf(event.data)),
    filter(
      (message): message is PaintMessage =>
        message?.type === 'height' || message?.type === 'loading' || message?.type === 'painted',
    ),
  );
  const fallback$ = fromEvent(iframe, 'load').pipe(
    switchMap(() => timer(UNREPORTED_PAINT_MS)),
    map((): PaintEvent => ({ type: 'fallback' })),
  );

  return merge(messages$, fallback$).pipe(
    scan(paintStateOf, { loading: false, height: false, late: false, painted: false }),
    filter(({ painted }) => painted),
    take(1),
    switchMap(() => nextPaint$(host)),
    map(() => true),
    startWith(false),
  );
};
