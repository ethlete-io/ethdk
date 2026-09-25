import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { PackageManager } from './package-manager';
import { UpdatedPackage } from './plan';

export const AGENT_RULES_PACKAGE = '@ethlete/agent-rules';
export const AGENT_RULES_CONFIG_FILE = 'ethlete-agents.config.json';

export type AgentRulesSyncPlan =
  { state: 'not-updated' } | { state: 'no-config'; command: string[] } | { state: 'sync'; command: string[] };

export type AgentRulesSyncOutcome =
  | { state: 'not-updated' }
  | { state: 'no-config'; command: string[] }
  | { state: 'synced'; command: string[] }
  | { state: 'failed'; command: string[]; reason: string };

export const agentRulesSyncCommand = (manager: PackageManager) => [...manager.run, 'ethlete-agents', 'sync'];

/**
 * Whether an update has to regenerate the repo's agent rules and skills: only when it moved
 * `@ethlete/agent-rules`, and only in a repo that configured them.
 */
export const planAgentRulesSync = (options: {
  root: string;
  manager: PackageManager;
  updates: readonly UpdatedPackage[];
}): AgentRulesSyncPlan => {
  const { root, manager, updates } = options;

  if (!updates.some((update) => update.name === AGENT_RULES_PACKAGE)) return { state: 'not-updated' };

  const command = agentRulesSyncCommand(manager);

  if (!existsSync(join(root, AGENT_RULES_CONFIG_FILE))) return { state: 'no-config', command };

  return { state: 'sync', command };
};

export const runAgentRulesSync = (plan: AgentRulesSyncPlan, root: string): AgentRulesSyncOutcome => {
  if (plan.state !== 'sync') return plan;

  const [binary, ...args] = plan.command;

  if (binary === undefined) return { state: 'failed', command: plan.command, reason: 'no command to run sync with' };

  const result = spawnSync(binary, args, { cwd: root, stdio: 'inherit' });

  if (result.error) return { state: 'failed', command: plan.command, reason: result.error.message };

  if (result.status !== 0) {
    return { state: 'failed', command: plan.command, reason: `${binary} exited with ${result.status}` };
  }

  return { state: 'synced', command: plan.command };
};
