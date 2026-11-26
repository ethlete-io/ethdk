import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

/** Reads `git status --short` of the repository the host runs in. */
export const workspaceStatus$ = (): Observable<string> => invokeHost$<string>('workspace_status');

/** Reads `git diff --stat` of the repository the host runs in. */
export const workspaceDiff$ = (): Observable<string> => invokeHost$<string>('workspace_diff');

/** Runs `git diff --check` of the repository the host runs in. */
export const workspaceCheck$ = (): Observable<string> => invokeHost$<string>('workspace_check');

/** The top level of the repository the host runs in, or an empty string outside one. */
export const workspaceRoot$ = (): Observable<string> => invokeHost$<string>('workspace_root');
