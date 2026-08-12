import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

/** Both lines arrive worded, so the tray never formats a duration the review UI formats differently. */
export type TrayReadout = {
  activity: string;
  total: string;
};

export type TauriTray = {
  setReadout$(readout: TrayReadout): Observable<void>;
};

export const createTauriTray = (): TauriTray => ({
  setReadout$: (readout) => invokeHost$<void>('tray_set_readout', readout),
});
