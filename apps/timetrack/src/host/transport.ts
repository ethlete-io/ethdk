import { TimetrackRequest, TimetrackResponse, TimetrackTransport } from '@ethlete/timetrack';
import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

export const createTauriTransport = (): TimetrackTransport => ({
  request$: <T>(request: TimetrackRequest): Observable<TimetrackResponse<T>> =>
    invokeHost$<TimetrackResponse<T>>('http_request', { request }),
});
