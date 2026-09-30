import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as utils from '../utils';
import { agentChoices, setUpAgentCommand } from './agent-setup';

vi.mock('../api/git', () => ({ ignoredByGit: () => false }));

const binDir = (...binaries: string[]) => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-agent-bin-'));

  for (const binary of binaries) {
    writeFileSync(join(dir, binary), '#!/bin/sh\n', 'utf8');
    chmodSync(join(dir, binary), 0o755);
  }

  return dir;
};

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('agentChoices', () => {
  it('offers the interactive and the headless command of each CLI on PATH, interactive first', () => {
    const env = { PATH: binDir('codex', 'claude') };

    expect(agentChoices({ env, platform: 'linux' }).map(({ command }) => command)).toEqual([
      'claude --permission-mode acceptEdits',
      'claude --permission-mode acceptEdits -p',
      'codex --sandbox workspace-write',
      'codex exec --sandbox workspace-write',
    ]);
  });

  it('skips a file on PATH that is not executable', () => {
    const dir = binDir();

    writeFileSync(join(dir, 'claude'), '', 'utf8');

    expect(agentChoices({ env: { PATH: dir }, platform: 'linux' })).toEqual([]);
  });
});

describe('setUpAgentCommand', () => {
  const setUp = (answer: string, root = mkdtempSync(join(tmpdir(), 'cli-agent-setup-'))) => {
    const asked = vi.spyOn(utils, 'askQuestion').mockResolvedValue(answer);
    const result = setUpAgentCommand({ root, env: { PATH: binDir('claude') }, platform: 'linux', isTTY: true });

    return { root, asked, result };
  };

  it('saves the first choice on Enter and gitignores the file', async () => {
    const { root, result } = setUp('');

    expect(await result).toBe('claude --permission-mode acceptEdits');
    expect(readJson(join(root, 'ethlete.config.local.json'))).toEqual({
      updateAgentCommand: 'claude --permission-mode acceptEdits',
    });
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe('ethlete.config.local.json\n');
  });

  it('saves a picked number next to the keys the file holds already', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-agent-setup-'));

    writeFileSync(join(root, 'ethlete.config.local.json'), JSON.stringify({ sdkSourcePath: '../sdk' }), 'utf8');

    expect(await setUp('2', root).result).toBe('claude --permission-mode acceptEdits -p');
    expect(readJson(join(root, 'ethlete.config.local.json'))).toEqual({
      sdkSourcePath: '../sdk',
      updateAgentCommand: 'claude --permission-mode acceptEdits -p',
    });
  });

  it('saves a typed command as it is', async () => {
    expect(await setUp('my-agent run').result).toBe('my-agent run');
  });

  it('writes to the legacy file when that is where the local config lives', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-agent-setup-'));

    writeFileSync(join(root, 'ethlete-agents.config.local.json'), JSON.stringify({ sdkSourcePath: '../sdk' }), 'utf8');
    await setUp('1', root).result;

    expect(readJson(join(root, 'ethlete-agents.config.local.json')).updateAgentCommand).toBe(
      'claude --permission-mode acceptEdits',
    );
  });

  it('saves nothing for a number outside the list', async () => {
    const { root, result } = setUp('9');

    expect(await result).toBeUndefined();
    expect(() => readFileSync(join(root, 'ethlete.config.local.json'))).toThrow();
  });

  it('leaves an unreadable config file alone and asks nothing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-agent-setup-'));

    writeFileSync(join(root, 'ethlete.config.local.json'), '{ broken', 'utf8');

    const { asked, result } = setUp('1', root);

    expect(await result).toBeUndefined();
    expect(asked).not.toHaveBeenCalled();
    expect(readFileSync(join(root, 'ethlete.config.local.json'), 'utf8')).toBe('{ broken');
  });

  it('names the key and the installed commands without a terminal', async () => {
    const asked = vi.spyOn(utils, 'askQuestion');
    const root = mkdtempSync(join(tmpdir(), 'cli-agent-setup-'));

    expect(
      await setUpAgentCommand({ root, env: { PATH: binDir('claude') }, platform: 'linux', isTTY: false }),
    ).toBeUndefined();
    expect(asked).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('claude --permission-mode acceptEdits -p'));
  });
});
