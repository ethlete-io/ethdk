import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { AGENT_RULES_CONFIG_FILE, planAgentRulesSync, runAgentRulesSync } from './agent-rules-sync';
import { PackageManager } from './package-manager';

const pnpm: PackageManager = { name: 'pnpm', install: ['pnpm', 'install'], run: ['pnpm', 'exec'] };

const makeRoot = (options: { configured: boolean }) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-agent-rules-sync-'));

  if (options.configured) writeFileSync(join(root, AGENT_RULES_CONFIG_FILE), '{}', 'utf8');

  return root;
};

const agentRules = { name: '@ethlete/agent-rules', from: '0.1.0-next.13', to: '0.1.0-next.17' };

describe('planAgentRulesSync', () => {
  it('syncs with the repo package manager when the update moved @ethlete/agent-rules', () => {
    expect(planAgentRulesSync({ root: makeRoot({ configured: true }), manager: pnpm, updates: [agentRules] })).toEqual({
      state: 'sync',
      command: ['pnpm', 'exec', 'ethlete-agents', 'sync'],
    });
  });

  it('does nothing when the update left @ethlete/agent-rules alone', () => {
    const updates = [{ name: '@ethlete/core', from: '5.0.0', to: '5.1.0' }];

    expect(planAgentRulesSync({ root: makeRoot({ configured: true }), manager: pnpm, updates })).toEqual({
      state: 'not-updated',
    });
  });

  it('only names the command in a repo without an agent rules config', () => {
    expect(
      planAgentRulesSync({ root: makeRoot({ configured: false }), manager: pnpm, updates: [agentRules] }),
    ).toMatchObject({ state: 'no-config' });
  });
});

describe('runAgentRulesSync', () => {
  it('reports a sync command that cannot start', () => {
    const outcome = runAgentRulesSync(
      { state: 'sync', command: ['et-no-such-binary-for-sync', 'sync'] },
      makeRoot({ configured: true }),
    );

    expect(outcome.state).toBe('failed');
  });
});
