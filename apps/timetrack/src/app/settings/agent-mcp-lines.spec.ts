import { describe, expect, it } from 'vitest';
import { agentMcpLines } from './agent-mcp-lines';

describe('agentMcpLines', () => {
  it('shows the real adapter path with no placeholder', () => {
    const lines = agentMcpLines('/opt/Timetrack/resources/timetrack-mcp.mjs');

    expect(lines.map((line) => line.command)).toEqual([
      'claude mcp add --scope user --transport stdio timetrack -- node /opt/Timetrack/resources/timetrack-mcp.mjs',
      'codex mcp add timetrack -- node /opt/Timetrack/resources/timetrack-mcp.mjs',
    ]);
    expect(JSON.stringify(lines)).not.toContain('/path/to');
  });

  it('quotes a path with spaces', () => {
    expect(agentMcpLines('/Applications/My Apps/timetrack-mcp.mjs')[1]?.command).toBe(
      'codex mcp add timetrack -- node "/Applications/My Apps/timetrack-mcp.mjs"',
    );
  });
});
