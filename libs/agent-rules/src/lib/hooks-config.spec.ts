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

describe('loadConfig shape validation', () => {
  it('names the key whose value has the wrong type', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-config-'));

    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, CONFIG_FILE_NAME), JSON.stringify({ targets: 'claude' }), 'utf8');

    expect(() => loadConfig({ root })).toThrow(/"targets" must be/);
  });
});
