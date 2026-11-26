import { GoogleOAuthClient } from '@ethlete/timetrack';
import { Observable, catchError, of } from 'rxjs';
import { invokeHost$ } from './invoke';

/** The shared OAuth client the build was made with. */
export type TauriGoogleClient = {
  /** The client, or `null` when the build carries none or no shell is running. */
  builtIn$(): Observable<GoogleOAuthClient | null>;
};

export const createTauriGoogleClient = (): TauriGoogleClient => ({
  builtIn$: () => invokeHost$<GoogleOAuthClient | null>('google_builtin_client').pipe(catchError(() => of(null))),
});
