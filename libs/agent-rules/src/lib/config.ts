import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ContentScope } from './frontmatter';
import { loadDefaultVars } from './load-content';

export const AGENT_TARGETS = ['claude', 'codex', 'cursor', 'copilot'] as const;

export type AgentTarget = (typeof AGENT_TARGETS)[number];

export const CONFIG_FILE_NAME = 'ethlete-agents.config.json';

export const LOCAL_CONFIG_FILE_NAME = 'ethlete-agents.config.local.json';

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
  /** Opt-in agent hooks (they run commands on the developer's machine, so never default). */
  hooks: string[];
};

type RawConfig = {
  targets?: AgentTarget[] | 'auto';
  profile?: 'consumer' | 'sdk';
  vars?: Record<string, string | string[]>;
  exclude?: string[];
  claudeMdImportsAgentsMd?: boolean;
  hooks?: string[];
};

const readRawConfig = (root: string) => {
  const path = join(root, CONFIG_FILE_NAME);

  if (!existsSync(path)) return {};

  return JSON.parse(readFileSync(path, 'utf8')) as RawConfig;
};

/**
 * The gitignored local config holds per-machine values, read at runtime — by the generated hook
 * scripts, and by the agent while following a skill — never by `sync`. Sync output must be
 * identical on every machine and in CI (the generated files are committed and `check` diffs them),
 * so nothing here may change what gets emitted:
 *
 * - `disableHooks: true` silences every generated hook, `["context-warning"]` just the named ones.
 * - `disableAutoHandoffSave: true` keeps the context-warning hook's normal tiered messages (including
 *   in auto mode), but at the critical tier in auto mode it falls back to just recommending
 *   a handoff instead of writing the handoff file automatically.
 * - `sdkSourcePath` points at a local `ethlete-sdk` checkout, which the SDK source and local-build
 *   skills read when they need the SDK's own sources instead of the published package.
 */
export type LocalConfig = {
  disableHooks?: boolean | string[];
  disableAutoHandoffSave?: boolean;
  sdkSourcePath?: string;
};

export type LocalConfigState =
  | { exists: false }
  | { exists: true; valid: false }
  | { exists: true; valid: true; config: LocalConfig; unknownKeys: string[] };

const LOCAL_CONFIG_KEYS: (keyof LocalConfig)[] = ['disableHooks', 'disableAutoHandoffSave', 'sdkSourcePath'];

export const readLocalConfig = (root: string): LocalConfigState => {
  const path = join(root, LOCAL_CONFIG_FILE_NAME);

  if (!existsSync(path)) return { exists: false };

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { exists: true, valid: false };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { exists: true, valid: false };

  const config = parsed as LocalConfig;
  const unknownKeys = Object.keys(config).filter((key) => !LOCAL_CONFIG_KEYS.includes(key as keyof LocalConfig));

  return { exists: true, valid: true, config, unknownKeys };
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
    hooks: raw.hooks ?? [],
  };
};
