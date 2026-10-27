import { Observable, fromEvent, map, switchMap } from 'rxjs';
import { ProductAddress, designAnswer$ } from './design';

type Point = { x: number; y: number };

/** A note on a state of a part, `<product>/notes/<id>.json`. Without `point` it is on the whole state. */
export type ListedNote = {
  id: string;
  /** `<layer>/<name>`. */
  part: string;
  state: string;
  /** CSS pixels from the frame's top left corner. */
  point?: Point;
  text: string;
  file: string;
  /** Why the note points at nothing any more, or `null`. */
  stale: string | null;
};

export type ListedNotes = { notes: ListedNote[]; unreadable: { file: string; problem: string }[] };

/** A free note of a flow; `at` is its top left corner on the flow canvas. */
export type FlowNote = { id: string; text: string; at?: Point };

/** A product and one of its flows. */
export type FlowAddress = ProductAddress & { flow: string };

const noteUrl = ({ port, product, flow }: ProductAddress & { flow?: string }, path: string) =>
  `http://localhost:${port}/__design/${path}?product=${encodeURIComponent(product)}${
    flow === undefined ? '' : `&flow=${encodeURIComponent(flow)}`
  }`;

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

const done = map(() => undefined);

export const listedNotes$ = (address: ProductAddress): Observable<ListedNotes> =>
  designAnswer$<ListedNotes>(noteUrl(address, 'notes'));

export const writeNote$ = (
  address: ProductAddress,
  note: { part: string; state: string; text: string; point?: Point },
): Observable<void> => designAnswer$<unknown>(noteUrl(address, 'note'), post(note)).pipe(done);

/** Changes a note on a state; `point: null` puts it on the whole state. */
export const changeNote$ = (
  address: ProductAddress,
  change: { id: string; text?: string; point?: Point | null },
): Observable<void> => designAnswer$<unknown>(noteUrl(address, 'note-change'), post(change)).pipe(done);

export const deleteNote$ = (address: ProductAddress, id: string): Observable<void> =>
  designAnswer$<unknown>(noteUrl(address, 'note-delete'), post({ id })).pipe(done);

export const writeFlowNote$ = (address: FlowAddress, note: { text: string; at?: Point }): Observable<void> =>
  designAnswer$<unknown>(noteUrl(address, 'flow-note'), post(note)).pipe(done);

/** Changes a free note of a flow; `at: null` lets Studio place it. */
export const changeFlowNote$ = (
  address: FlowAddress,
  change: { id: string; text?: string; at?: Point | null },
): Observable<void> => designAnswer$<unknown>(noteUrl(address, 'flow-note-change'), post(change)).pipe(done);

export const deleteFlowNote$ = (address: FlowAddress, id: string): Observable<void> =>
  designAnswer$<unknown>(noteUrl(address, 'flow-note-delete'), post({ id })).pipe(done);

/** Emits whenever a note file of the checkout changes, from the design server's own event stream. */
export const noteChanges$ = (port: number): Observable<void> =>
  new Observable<EventSource>((subscriber) => {
    const events = new EventSource(`http://localhost:${port}/__design/comment-events`);

    subscriber.next(events);

    return () => events.close();
  }).pipe(
    switchMap((events) => fromEvent(events, 'notes')),
    map(() => undefined),
  );
