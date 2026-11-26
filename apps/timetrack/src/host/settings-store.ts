import { TimetrackSettings, TimetrackSettingsStore, parseTimetrackSettings } from '@ethlete/timetrack';
import { map } from 'rxjs';
import { invokeHost$ } from './invoke';

/**
 * The settings document in the encrypted store. It holds no `Date` and no secret, so it crosses as the
 * plain JSON it already is — but it is still read through `parseTimetrackSettings`, because a document
 * an older version wrote is exactly what this store hands back.
 */
export const createTauriSettingsStore = (): TimetrackSettingsStore => ({
  read$: () =>
    invokeHost$<unknown>('app_settings').pipe(
      map((stored) => (stored === null ? null : parseTimetrackSettings(stored))),
    ),
  save$: (settings: TimetrackSettings) => invokeHost$<void>('set_app_settings', { settings }),
});
