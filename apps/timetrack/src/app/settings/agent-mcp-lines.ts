const quote = (path: string) => (/[\s"'\\]/.test(path) ? `"${path.replaceAll('"', '\\"')}"` : path);

export const agentMcpLines = (adapterPath: string) => {
  const adapter = `node ${quote(adapterPath)}`;

  return [
    { client: 'Claude Code', command: `claude mcp add --scope user --transport stdio timetrack -- ${adapter}` },
    { client: 'Codex', command: `codex mcp add timetrack -- ${adapter}` },
  ];
};
