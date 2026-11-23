import { spawnSync } from 'child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, '../../content/hooks/design-live-check.py');

const FAKE_ET = `#!/usr/bin/env python3
import sys
text = open(sys.argv[-1], encoding="utf-8").read()
with open(sys.argv[-1] + ".argv", "w", encoding="utf-8") as f:
    f.write(" ".join(sys.argv[1:]))
if "#fff" in text:
    print("HARD-CODED-COLOUR " + sys.argv[-1] + ": #fff outside foundations - use a foundations token")
    sys.exit(1)
`;

const repo = (options: { mcp?: boolean; bin?: boolean; localConfig?: Record<string, unknown> } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-design-live-check-'));
  const et = join(root, 'fake-et.py');

  writeFileSync(et, FAKE_ET);
  chmodSync(et, 0o755);
  mkdirSync(join(root, '.ethlete/design/acme/elements/hero'), { recursive: true });

  if (options.mcp !== false)
    writeFileSync(
      join(root, '.mcp.json'),
      JSON.stringify({ mcpServers: { 'ethlete-design': { command: 'python3', args: [et, 'design', 'mcp'] } } }),
    );

  if (options.bin) {
    mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
    writeFileSync(join(root, 'node_modules/.bin/et'), FAKE_ET);
    chmodSync(join(root, 'node_modules/.bin/et'), 0o755);
  }

  if (options.localConfig)
    writeFileSync(join(root, 'ethlete-agents.config.local.json'), JSON.stringify(options.localConfig));

  return root;
};

const runHook = (options: { root: string; file: string; content: string; toolName?: string }) => {
  const { root, file, content, toolName = 'Edit' } = options;

  writeFileSync(join(root, file), content);

  const run = spawnSync('python3', [hookPath, '--agent', 'claude'], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({
      cwd: root,
      hook_event_name: 'PostToolUse',
      tool_name: toolName,
      tool_input: { file_path: join(root, file) },
    }),
  });

  return { code: run.status, stderr: run.stderr, stdout: run.stdout };
};

const CSS = '.ethlete/design/acme/elements/hero/hero.css';

describe('design-live-check', () => {
  it('hands each finding of a written design file back to the agent', () => {
    const root = repo();
    const result = runHook({ root, file: CSS, content: '.x { color: #fff; }' });

    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(`The design check finds this in ${CSS}. Fix each finding now`);
    expect(result.stderr).toContain('HARD-CODED-COLOUR');
  });

  it('stays silent on a clean file', () => {
    expect(runHook({ root: repo(), file: CSS, content: '.x { color: var(--c); }' })).toEqual({
      code: 0,
      stderr: '',
      stdout: '',
    });
  });

  it('runs the design server command with lint in place of mcp', () => {
    const root = repo();

    runHook({ root, file: CSS, content: '.x {}', toolName: 'Write' });

    expect(readFileSync(join(root, `${CSS}.argv`), 'utf8')).toBe(`design lint ${join(root, CSS)}`);
  });

  it('falls back to the installed et without a design server', () => {
    expect(runHook({ root: repo({ mcp: false, bin: true }), file: CSS, content: '#fff' }).code).toBe(2);
    expect(runHook({ root: repo({ mcp: false }), file: CSS, content: '#fff' }).code).toBe(0);
  });

  it('leaves files outside the design folder, other tools and a disabled hook alone', () => {
    const root = repo();

    expect(runHook({ root, file: 'hero.css', content: '#fff' }).code).toBe(0);
    expect(runHook({ root, file: CSS, content: '#fff', toolName: 'Read' }).code).toBe(0);
    expect(
      runHook({ root: repo({ localConfig: { disableHooks: ['design-live-check'] } }), file: CSS, content: '#fff' })
        .code,
    ).toBe(0);
  });
});
