import { Observable } from 'rxjs';
import { ProductAddress, SystemProblem, designAnswer$ } from './design';
import { FlowNote } from './design-notes';

export type FlowState = { part: string; state: string };

export type ListedFlow = {
  name: string;
  file: string;
  frames: (FlowState & { position?: { x: number; y: number } })[];
  lines: { from: FlowState; to: FlowState; label?: string }[];
  notes: FlowNote[];
  problems: SystemProblem[];
};

export type ListedFlows = { flows: ListedFlow[]; unreadable: { file: string; problem: string }[] };

/** The flows of a product, `<product>/flows/<name>.json`, by name. */
export const listedFlows$ = ({ port, product }: ProductAddress): Observable<ListedFlows> =>
  designAnswer$<ListedFlows>(`http://localhost:${port}/__design/flows?product=${encodeURIComponent(product)}`);
