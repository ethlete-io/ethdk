import { Observable } from 'rxjs';
import { ProductAddress, designAnswer$, postJson } from './design';

/** A free note of a flow; `at` is its top left corner on the flow canvas. */
export type FlowNote = { id: string; text: string; at?: { x: number; y: number } };

export type FlowAddress = ProductAddress & { flow: string };

const flowNoteUrl = ({ port, product, flow }: FlowAddress, path: string) =>
  `http://localhost:${port}/__design/${path}?${new URLSearchParams({ product, flow }).toString()}`;

/** Adds a free note to `<product>/flows/<flow>.json` and answers it with its new id. */
export const addFlowNote$ = (address: FlowAddress, note: Omit<FlowNote, 'id'>): Observable<FlowNote> =>
  designAnswer$<FlowNote>(flowNoteUrl(address, 'flow-note'), postJson(note));

/** Changes the text or the canvas point of a free note; `at: null` lets Studio place it. */
export const changeFlowNote$ = (
  address: FlowAddress,
  change: { id: string; text?: string; at?: FlowNote['at'] | null },
): Observable<FlowNote> => designAnswer$<FlowNote>(flowNoteUrl(address, 'flow-note-change'), postJson(change));

/** Deletes a free note of a flow. */
export const deleteFlowNote$ = (address: FlowAddress, id: string): Observable<FlowNote> =>
  designAnswer$<FlowNote>(flowNoteUrl(address, 'flow-note-delete'), postJson({ id }));
