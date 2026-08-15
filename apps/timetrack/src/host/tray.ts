import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

/** Every line arrives worded, so the tray never formats a duration the review UI formats differently. */
export type TrayReadout = {
  activity: string;
  total: string;
  /** What the timer entry should say, which is the action picking it performs. */
  timer: string;
  /** The same for the pause entry. */
  pause: string;
};

export type TauriTray = {
  setReadout$(readout: TrayReadout): Observable<void>;
};

export const createTauriTray = (): TauriTray => ({
  setReadout$: (readout) => invokeHost$<void>('tray_set_readout', readout),
});
