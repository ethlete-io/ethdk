import { AgentApiAnswer } from '@ethlete/timetrack';
import { Observable } from 'rxjs';
import { AGENT_REQUEST_EVENT, hostEventWith$ } from './events';
import { invokeHost$ } from './invoke';

/** One request as the host hands it over. What is in `body` is the caller's, uninterpreted. */
export type AgentRequestEvent = { id: number; body: unknown };

/** The loopback endpoint's two halves: the requests the host hands over, and the answer to each. */
export type TauriAgentChannel = {
  requests$(): Observable<AgentRequestEvent>;
  reply$(id: number, answer: AgentApiAnswer): Observable<void>;
};

export const createTauriAgentChannel = (): TauriAgentChannel => ({
  requests$: () => hostEventWith$<AgentRequestEvent>(AGENT_REQUEST_EVENT),
  reply$: (id, answer) => invokeHost$<void>('agent_reply', { id, answer }),
});
