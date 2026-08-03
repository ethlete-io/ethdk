import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ContentScope } from './frontmatter';
import { loadDefaultVars } from './load-content';

export const AGENT_TARGETS = ['claude', 'codex', 'cursor', 'copilot'] as const;

export type AgentTarget = (typeof AGENT_TARGETS)[number];

export const CONFIG_FILE_NAME = 'ethlete-agents.config.json';

export type SyncConfig = {
  root: string;
  targets: AgentTarget[];
  /** Scopes to emit: a consumer repo wants `consumer` + `both`, the SDK repo only `both`. */
  scopes: ContentScope[];
  vars: Record<string, string | string[]>;
  exclude: string[];
  /**
   * Declares that the repo's `CLAUDE.md` is an `@AGENTS.md` import (or symlink). The claude
   * target then skips `.claude/rules/ethlete/` — the rules already reach Claude through the
   * `AGENTS.md` marker block, and a second copy would load twice.
   */
  claudeMdImportsAgentsMd: boolean;
};

type RawConfig = {
  targets?: AgentTarget[] | 'auto';
  profile?: 'consumer' | 'sdk';
  vars?: Record<string, string | string[]>;
  exclude?: string[];
  claudeMdImportsAgentsMd?: boolean;
};

const readRawConfig = (root: string) => {
  const path = join(root, CONFIG_FILE_NAME);

  if (!existsSync(path)) return {};

  return JSON.parse(readFileSync(path, 'utf8')) as RawConfig;
};

/**
 * Emit for the agents a repo already uses. `codex` is always included: `AGENTS.md` is the
 * cross-tool standard that Cursor, Copilot and most other agents read as well, and gating it on
 * an existing `AGENTS.md` would mean the file that triggers Codex output is the very file the
 * sync is supposed to create.
 */
export const detectTargets = (root: string): AgentTarget[] => {
  const detected: AgentTarget[] = ['codex'];

  if (existsSync(join(root, '.claude'))) detected.push('claude');
  if (existsSync(join(root, '.cursor'))) detected.push('cursor');
  if (existsSync(join(root, '.github'))) detected.push('copilot');

  return detected;
};

const assertKnownTargets = (targets: AgentTarget[]) => {
  const unknown = targets.filter((target) => !AGENT_TARGETS.includes(target));

  if (unknown.length > 0) {
    throw new Error(`Unknown target(s): ${unknown.join(', ')}. Known targets: ${AGENT_TARGETS.join(', ')}.`);
  }
};

export const loadConfig = (options: { root: string; targetOverride?: AgentTarget[] }): SyncConfig => {
  const { root, targetOverride } = options;
  const raw = readRawConfig(root);
  const configured = raw.targets && raw.targets !== 'auto' ? raw.targets : undefined;
  const targets = targetOverride ?? configured ?? detectTargets(root);

  assertKnownTargets(targets);

  return {
    root,
    targets,
    scopes: raw.profile === 'sdk' ? ['both'] : ['consumer', 'both'],
    vars: { ...loadDefaultVars(), ...(raw.vars ?? {}) },
    exclude: raw.exclude ?? [],
    claudeMdImportsAgentsMd: raw.claudeMdImportsAgentsMd ?? false,
  };
};
