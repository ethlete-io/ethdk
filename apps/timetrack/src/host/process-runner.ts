import { ProcessResult, TimetrackProcessRunner } from '@ethlete/timetrack';
import { invokeHost$ } from './invoke';

export const createTauriProcessRunner = (): TimetrackProcessRunner => ({
  run$: (spec) => invokeHost$<ProcessResult>('run_process', { spec }),
});
