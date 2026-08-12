import { TimetrackSecretStore } from '@ethlete/timetrack';
import { invokeHost$ } from './invoke';

export const createTauriSecretStore = (): TimetrackSecretStore => ({
  read$: (key) => invokeHost$<string | null>('secret_read', { account: key }),
  write$: (key, value) => invokeHost$<void>('secret_write', { account: key, value }),
});
