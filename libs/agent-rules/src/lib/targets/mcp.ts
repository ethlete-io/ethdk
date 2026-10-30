import { EmittedFile } from './shared';

export const CLAUDE_MCP_FILE = '.mcp.json';

export const CODEX_CONFIG_FILE = '.codex/config.toml';

export const DESIGN_MCP_SERVER = 'ethlete-design';

const serverCommand = (runner = 'npx') => {
  const [command = 'npx', ...prefix] = runner.split(' ').filter(Boolean);

  return { command, args: [...prefix, 'et', 'design', 'mcp'] };
};

const parseObject = (existing: string, file: string): Record<string, unknown> => {
  if (existing.trim() === '') return {};

  let parsed: unknown;

  try {
    parsed = JSON.parse(existing);
  } catch {
    throw new Error(
      `${file} is not valid JSON — fix or remove it so the ${DESIGN_MCP_SERVER} MCP server can be merged.`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `${file} is not a JSON object — fix or remove it so the ${DESIGN_MCP_SERVER} MCP server can be merged.`,
    );
  }

  return parsed as Record<string, unknown>;
};

export const emitClaudeMcp = (options: { existing: string; runner: string | undefined }): EmittedFile => {
  const settings = parseObject(options.existing, CLAUDE_MCP_FILE);
  const servers = (settings['mcpServers'] ?? {}) as Record<string, unknown>;
  const merged = { ...settings, mcpServers: { ...servers, [DESIGN_MCP_SERVER]: serverCommand(options.runner) } };

  return { path: CLAUDE_MCP_FILE, contents: `${JSON.stringify(merged, null, 2)}\n` };
};

const tomlSection = (runner: string | undefined) => {
  const { command, args } = serverCommand(runner);

  return [
    `[mcp_servers.${DESIGN_MCP_SERVER}]`,
    `command = "${command}"`,
    `args = [${args.map((arg) => `"${arg}"`).join(', ')}]`,
  ].join('\n');
};

/**
 * Replaces only the `[mcp_servers.ethlete-design]` table (up to the next table header) and appends it
 * when absent, so every other table in the project's Codex config stays as written.
 */
export const emitCodexMcp = (options: { existing: string; runner: string | undefined }): EmittedFile => {
  const { existing, runner } = options;
  const header = `[mcp_servers.${DESIGN_MCP_SERVER}]`;
  const lines = existing.split('\n');
  const start = lines.findIndex((line) => line.trim() === header);
  const section = tomlSection(runner);

  if (start === -1) {
    const base = existing.trimEnd();

    return { path: CODEX_CONFIG_FILE, contents: `${base === '' ? '' : `${base}\n\n`}${section}\n` };
  }

  let end = lines.findIndex((line, index) => index > start && /^\s*\[/.test(line));

  if (end === -1) end = lines.length;

  const before = lines
    .slice(0, start)
    .map((line) => `${line}\n`)
    .join('');
  const after = lines.slice(end).join('\n').trimStart();
  const contents = `${before}${section}\n${after === '' ? '' : `\n${after}`}`;

  return { path: CODEX_CONFIG_FILE, contents: contents.endsWith('\n') ? contents : `${contents}\n` };
};
