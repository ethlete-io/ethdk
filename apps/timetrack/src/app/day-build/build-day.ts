import { DayRows, StreamDay, buildRows, streamDay } from '@ethlete/timetrack';
import { EMPTY, Observable, defer, filter, fromEvent, map, merge, of, race, switchMap, take, tap } from 'rxjs';
import { DayBuildMessage, DayBuildReply, DayBuildRequest, runDayBuild } from './day-build';

let worker: Worker | undefined;
let unreachable = false;
let nextId = 0;

const workerOf = () => (worker ??= new Worker(new URL('./day-build.worker', import.meta.url), { type: 'module' }));

/**
 * Builds on the page once the worker failed to load. Workaround: a long-running Angular dev server
 * (@angular/build 22.2) can stop serving the worker chunk after a rebuild while the page still names
 * it, and without this the day screen waits for a reply forever.
 */
const onPage$ = <T extends StreamDay | DayRows>(request: DayBuildRequest) => of(runDayBuild(request) as T);

const build$ = <T extends StreamDay | DayRows>(request: DayBuildRequest): Observable<T> =>
  defer(() => {
    if (unreachable) return onPage$<T>(request);

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

    const failed$ = fromEvent(target, 'error').pipe(
      take(1),
      tap(() => {
        if (!unreachable) console.warn('The day build worker failed to load; building the day on the page.');

        unreachable = true;
      }),
      switchMap(() => onPage$<T>(request)),
    );

    return merge(
      race(reply$, failed$),
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
