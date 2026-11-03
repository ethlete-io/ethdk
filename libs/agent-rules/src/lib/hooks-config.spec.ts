import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { CONFIG_FILE_NAME, loadConfig } from './config';
import { mergeHookSettings } from './targets/hooks-shared';

describe('mergeHookSettings ownership', () => {
  it('keeps a hand-written hook that only shares the directory prefix', () => {
    const handWritten = { type: 'command', command: 'python3 .claude/hooks/ethlete-notify.py' };
    const existing = JSON.stringify({ hooks: { Stop: [{ hooks: [handWritten] }] } });

    const merged = mergeHookSettings({
      agent: 'claude',
      existing,
      hooks: [],
      hooksDir: '.claude/hooks/ethlete',
      commandFor: (file) => `.claude/hooks/ethlete/${file}`,
    });

    expect(merged).toContain('ethlete-notify.py');
  });
});

describe('mergeHookSettings order', () => {
  const dir = '.claude/hooks/ethlete';
  const commandFor = (file: string) => `${dir}/${file}`;
  const entry = (command: string, matcher?: string) => ({
    ...(matcher ? { matcher } : {}),
    hooks: [{ type: 'command', command, timeout: 10 }],
  });
  const foreign = entry('python3 foreign.py');
  const warning = entry(commandFor('context-warning.py'));
  const safety = entry(commandFor('git-safety.py'), 'Bash');
  const run = (existing: unknown, hooks: string[]) =>
    mergeHookSettings({
      agent: 'claude',
      existing: JSON.stringify(existing, null, 2) + '\n',
      hooks,
      hooksDir: dir,
      commandFor,
    });
  const text = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

  it('is a no-op on custom key order and foreign entries around managed ones', () => {
    const input = {
      permissions: { allow: [] },
      hooks: {
        Stop: [foreign, { ...warning }],
        PreToolUse: [safety],
        UserPromptSubmit: [warning, foreign],
        SessionStart: [warning],
        PostToolBatch: [warning],
        SubagentStop: [warning],
      },
    };
    const once = run(input, ['context-warning', 'git-safety']);

    expect(once).toBe(text(input));
    expect(run(JSON.parse(once), ['context-warning', 'git-safety'])).toBe(once);
  });

  it('appends a newly managed hook and removes a dropped one without moving the rest', () => {
    const input = { hooks: { Stop: [warning, foreign], PreToolUse: [foreign, safety] } };

    const added = JSON.parse(run(input, ['context-warning', 'git-safety']));

    expect(added.hooks.PreToolUse).toEqual([foreign, safety]);

    const removed = JSON.parse(run(input, []));

    expect(Object.keys(removed.hooks)).toEqual(['Stop', 'PreToolUse']);
    expect(removed.hooks.Stop).toEqual([foreign]);
    expect(removed.hooks.PreToolUse).toEqual([foreign]);

    const appended = JSON.parse(run({ hooks: { Stop: [foreign, warning] } }, ['context-warning', 'git-safety']));

    expect(appended.hooks.Stop).toEqual([foreign, warning]);
    expect(Object.keys(appended.hooks).pop()).toBe('PreToolUse');
  });
});

describe('loadConfig shape validation', () => {
  it('names the key whose value has the wrong type', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-config-'));

    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, CONFIG_FILE_NAME), JSON.stringify({ targets: 'claude' }), 'utf8');

    expect(() => loadConfig({ root })).toThrow(/"targets" must be/);
  });
});
