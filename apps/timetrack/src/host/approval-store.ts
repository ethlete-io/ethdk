import { AgentApproval, parseApprovalQueue } from '@ethlete/timetrack';
import { Observable, map } from 'rxjs';
import { invokeHost$ } from './invoke';

/** The approval queue in the encrypted store. The host refuses both halves while the window is locked. */
export type TauriApprovalStore = {
  read$(): Observable<AgentApproval[]>;
  save$(queue: readonly AgentApproval[]): Observable<void>;
};

export const createTauriApprovalStore = (): TauriApprovalStore => ({
  read$: () => invokeHost$<unknown>('approval_queue').pipe(map(parseApprovalQueue)),
  save$: (queue) => invokeHost$<void>('set_approval_queue', { queue }),
});
