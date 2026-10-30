import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_FILE_NAME } from './config';
import { sync } from './sync';

const repo = (options: { cli: boolean; targets?: string[]; packageManager?: string }) => {
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-mcp-'));

  writeFileSync(
    join(root, CONFIG_FILE_NAME),
    JSON.stringify({ targets: options.targets ?? ['claude', 'codex'] }),
    'utf8',
  );
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      packageManager: options.packageManager,
      dependencies: options.cli ? { '@ethlete/cli': '1.0.0' } : {},
    }),
    'utf8',
  );

  return root;
};

const run = (root: string) => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  sync({ root });
};

afterEach(() => vi.restoreAllMocks());

describe('et design mcp registration', () => {
  it('writes nothing without @ethlete/cli', () => {
    const root = repo({ cli: false });

    run(root);

    expect(existsSync(join(root, '.mcp.json'))).toBe(false);
    expect(existsSync(join(root, '.codex/config.toml'))).toBe(false);
  });

  it('registers the server for Claude Code and Codex', () => {
    const root = repo({ cli: true });

    run(root);

    expect(JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8'))).toEqual({
      mcpServers: { 'ethlete-design': { command: 'npx', args: ['et', 'design', 'mcp'] } },
    });
    expect(readFileSync(join(root, '.codex/config.toml'), 'utf8')).toBe(
      '[mcp_servers.ethlete-design]\ncommand = "npx"\nargs = ["et", "design", "mcp"]\n',
    );
  });

  it('starts the server with the package runner of the repo', () => {
    const root = repo({ cli: true, packageManager: 'pnpm@9.0.0' });

    run(root);

    expect(JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')).mcpServers['ethlete-design']).toEqual({
      command: 'pnpm',
      args: ['exec', 'et', 'design', 'mcp'],
    });
    expect(readFileSync(join(root, '.codex/config.toml'), 'utf8')).toContain(
      'command = "pnpm"\nargs = ["exec", "et", "design", "mcp"]',
    );
  });

  it('skips a target that is not enabled', () => {
    const root = repo({ cli: true, targets: ['claude'] });

    run(root);

    expect(existsSync(join(root, '.mcp.json'))).toBe(true);
    expect(existsSync(join(root, '.codex/config.toml'))).toBe(false);
  });

  it('keeps other servers and tables, and is idempotent', () => {
    const root = repo({ cli: true });

    mkdirSync(join(root, '.codex'));
    writeFileSync(join(root, '.mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'x' } }, extra: 1 }));
    writeFileSync(
      join(root, '.codex/config.toml'),
      'model = "m"\n\n[mcp_servers.ethlete-design]\ncommand = "old"\n\n[mcp_servers.other]\ncommand = "x"\n',
    );

    run(root);
    const first = [
      readFileSync(join(root, '.mcp.json'), 'utf8'),
      readFileSync(join(root, '.codex/config.toml'), 'utf8'),
    ];
    run(root);

    expect(readFileSync(join(root, '.mcp.json'), 'utf8')).toBe(first[0]);
    expect(readFileSync(join(root, '.codex/config.toml'), 'utf8')).toBe(first[1]);
    const json = JSON.parse(first[0] ?? '');

    expect(json.extra).toBe(1);
    expect(Object.keys(json.mcpServers)).toEqual(['other', 'ethlete-design']);
    expect(first[1]).toBe(
      'model = "m"\n\n[mcp_servers.ethlete-design]\ncommand = "npx"\nargs = ["et", "design", "mcp"]\n\n[mcp_servers.other]\ncommand = "x"\n',
    );
  });
});
