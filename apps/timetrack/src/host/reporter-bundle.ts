import { TimetrackReporterBundle } from '@ethlete/timetrack';
import { invokeHost$ } from './invoke';

export const createTauriReporterBundle = (): TimetrackReporterBundle => ({
  vsix$: () => invokeHost$<string | null>('reporter_vsix_path'),
  agentMcp$: () => invokeHost$<string | null>('agent_mcp_path'),
});
