import { Observable, filter, fromEvent, map, merge, share, tap } from 'rxjs';

export type DesignStreamEvent = { name: string; data: unknown };

type DesignStream = { events$: Observable<DesignStreamEvent>; isOpen: () => boolean };

const STREAM_EVENTS = ['open', 'error', 'comments', 'parts', 'notes', 'flows', 'calls', 'sketches'];

const streams = new Map<number, DesignStream>();

const createStream = (port: number): DesignStream => {
  let open = false;

  const events$ = new Observable<DesignStreamEvent>((subscriber) => {
    const source = new EventSource(`http://localhost:${port}/__design/comment-events`);

    const subscription = merge(
      ...STREAM_EVENTS.map((name) =>
        fromEvent<MessageEvent>(source, name).pipe(map((event): DesignStreamEvent => ({ name, data: event.data }))),
      ),
    )
      .pipe(
        tap(({ name }) => {
          if (name === 'open') open = true;
          if (name === 'error') open = false;
        }),
      )
      .subscribe(subscriber);

    return () => {
      open = false;
      subscription.unsubscribe();
      source.close();
    };
  }).pipe(share());

  return { events$, isOpen: () => open };
};

const streamOf = (port: number) => {
  let stream = streams.get(port);

  if (!stream) {
    stream = createStream(port);
    streams.set(port, stream);
  }

  return stream;
};

/**
 * The events of the design server's one `comment-events` stream, shared by every subscriber of a port. The stream
 * opens with the first subscriber and closes with the last. A dropped stream arrives as an `error` event, not as an
 * error of the observable.
 */
export const designEvents$ = (port: number, name: string): Observable<DesignStreamEvent> =>
  streamOf(port).events$.pipe(filter((event) => event.name === name));

/** Whether the shared stream of the port is connected right now. */
export const designStreamIsOpen = (port: number): boolean => streamOf(port).isOpen();

export const resetDesignStreams = () => streams.clear();
