import { TimetrackReporterBundle } from '@ethlete/timetrack';
import { invokeHost$ } from './invoke';

export const createTauriReporterBundle = (): TimetrackReporterBundle => ({
  vsix$: () => invokeHost$<string | null>('reporter_vsix_path'),
});
