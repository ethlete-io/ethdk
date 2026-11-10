import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

export type PushState = { unpushed: number; oldestAgeHours: number | null };

export type StudioCodeState = {
  cli: { running: string | null; latest: string | null; dirty: boolean };
  frontend: { latest: string | null };
  host: { running: string | null; latest: string | null };
  push?: PushState | null;
};

export const studioCodeState$ = (): Observable<StudioCodeState | null> =>
  invokeHost$<StudioCodeState | null>('studio_code_state');

export const quitForRebuild$ = (): Observable<void> => invokeHost$<void>('studio_quit_for_rebuild');
