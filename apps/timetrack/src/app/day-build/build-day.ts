import { DayRows, StreamDay, buildRows, streamDay } from '@ethlete/timetrack';
import { EMPTY, Observable, defer, filter, fromEvent, map, merge, take } from 'rxjs';
import { DayBuildMessage, DayBuildReply, DayBuildRequest } from './day-build';

let worker: Worker | undefined;
let nextId = 0;

const workerOf = () => (worker ??= new Worker(new URL('./day-build.worker', import.meta.url), { type: 'module' }));

const build$ = <T extends StreamDay | DayRows>(request: DayBuildRequest): Observable<T> =>
  defer(() => {
    const id = nextId++;
    const target = workerOf();
    const message: DayBuildMessage = { id, request };
    const reply$ = fromEvent<MessageEvent<DayBuildReply>>(target, 'message').pipe(
      map(({ data }) => data),
      filter((reply) => reply.id === id),
      take(1),
      map((reply) => {
        if ('error' in reply) throw new Error(reply.error);

        return reply.result as T;
      }),
    );

    return merge(
      reply$,
      defer(() => {
        target.postMessage(message);

        return EMPTY;
      }),
    );
  });

/** `streamDay`, built in the day build worker. The page only sends the inputs and receives the day. */
export const streamDay$ = (input: Parameters<typeof streamDay>[0]) => build$<StreamDay>({ kind: 'stream', input });

/** `buildRows`, built in the day build worker. The page only sends the inputs and receives the rows. */
export const buildRows$ = (input: Parameters<typeof buildRows>[0]) => build$<DayRows>({ kind: 'rows', input });
