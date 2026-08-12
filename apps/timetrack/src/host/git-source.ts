import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

export type GitRepoDiscovery = {
  /** Every repository the host found, as working-tree roots. */
  repos: string[];
  /** `watching` while the watch is armed, `none` when nothing is reporting. */
  kind: string;
  detail: string | null;
};

export type GitRepoChanges = {
  /** The repositories whose HEAD or refs moved since the sequence that was asked from. */
  repos: string[];
  /** The sequence to ask from next time. */
  seq: number;
};

/**
 * The repositories on this machine, and which of them have moved since the collector last looked.
 *
 * Nothing is acknowledged here, unlike the window source: a notification that goes missing costs only
 * latency, because the reflog and the commit log are durable and the next scan reads them anyway.
 */
export type TauriGitSource = {
  /**
   * Discovers the repositories under `roots` and re-arms the watch over them. An empty list leaves the
   * host to decide, which is the home directory.
   */
  repos$(roots: string[]): Observable<GitRepoDiscovery>;
  changes$(afterSeq: number): Observable<GitRepoChanges>;
};

export const createTauriGitSource = (): TauriGitSource => ({
  repos$: (roots) => invokeHost$<GitRepoDiscovery>('git_repos', { roots }),
  changes$: (afterSeq) => invokeHost$<GitRepoChanges>('git_changes', { afterSeq }),
});
