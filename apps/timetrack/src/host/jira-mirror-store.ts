import { JiraMirror, parseJiraMirror } from '@ethlete/timetrack';
import { Observable, map } from 'rxjs';
import { invokeHost$ } from './invoke';

/** The Jira issue mirrors in the encrypted store, one document per project. */
export type TauriJiraMirrorStore = {
  read$(): Observable<JiraMirror[]>;
  save$(mirror: JiraMirror): Observable<void>;
};

export const createTauriJiraMirrorStore = (): TauriJiraMirrorStore => ({
  read$: () =>
    invokeHost$<unknown[]>('jira_mirrors').pipe(
      map((documents) => documents.flatMap((doc) => parseJiraMirror(doc) ?? [])),
    ),
  save$: (mirror) => invokeHost$<void>('set_jira_mirror', { projectKey: mirror.projectKey, mirror }),
});
