import { SpecFiles, TimetrackSpecSource } from '@ethlete/timetrack';
import { invokeHost$ } from './invoke';

export const createTauriSpecSource = (): TimetrackSpecSource => ({
  read$: ({ repoPath, directories }) =>
    invokeHost$<SpecFiles | null>('read_spec', { request: { repoPath, directories: [...directories] } }),
});
