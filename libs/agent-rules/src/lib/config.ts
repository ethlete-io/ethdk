import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { commitMessageVars, findCommitlintConfig } from './commitlint';
import { ContentScope } from './frontmatter';
import { GitFlowConfig, RawGitFlowConfig, resolveGitFlowConfig } from './git-flow';
import { loadDefaultVars } from './load-content';

export const AGENT_TARGETS = ['claude', 'codex', 'cursor', 'copilot'] as const;

export type AgentTarget = (typeof AGENT_TARGETS)[number];

export const CONFIG_FILE_NAME = 'ethlete-agents.config.json';

export const LOCAL_CONFIG_FILE_NAME = 'ethlete-agents.config.local.json';

/**
 * How this repo reads a Jira issue into a branch name. The instance, the credentials and the subject
 * field are not here and cannot be: the Timetrack app holds them, and `git-flow start` asks it.
 */
export type JiraSettings = {
  /** Branch type per Jira issue type, e.g. `{ "Bug": "fix" }`. Anything unlisted becomes `feat`. */
  typeByIssueType?: Record<string, string>;
};

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
  /** Opt-in git hooks, appended to the repo's own husky hooks. Same reason they never default. */
  gitHooks: string[];
  /** The branch grammar, resolved against its defaults — see `@ethlete/agent-rules/git-flow`. */
  gitFlow: GitFlowConfig;
  jira: JiraSettings;
};

type RawConfig = {
  targets?: AgentTarget[] | 'auto';
  profile?: 'consumer' | 'sdk';
  vars?: Record<string, string | string[]>;
  exclude?: string[];
  claudeMdImportsAgentsMd?: boolean;
  hooks?: string[];
  gitHooks?: string[];
  gitFlow?: RawGitFlowConfig;
  jira?: JiraSettings;
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
 *
 * Where the sibling checkouts live (`sdkSourcePath`, `apiRepoPaths`, `apiRepoBranches`) is not here:
 * it moved to `@ethlete/cli`'s `ethlete.config.local.json`, because `et` reads the same values.
 *
 * No secret belongs here any more. Jira is reached through the Timetrack app, which holds the token
 * in the machine's keychain — one secret per machine rather than one per checkout.
 */
export type LocalConfig = {
  disableHooks?: boolean | string[];
  disableAutoHandoffSave?: boolean;
};

export type LocalConfigState =
  | { exists: false }
  | { exists: true; valid: false }
  | { exists: true; valid: true; config: LocalConfig; unknownKeys: string[]; movedKeys: string[] };

export const LOCAL_CONFIG_KEYS: (keyof LocalConfig)[] = ['disableHooks', 'disableAutoHandoffSave'];

/**
 * Repo topology moved to `@ethlete/cli`'s `ethlete.config.local.json`, because `et` needs it too.
 * Still recognised here so a checkout that has not moved them yet gets told where they went
 * instead of an "unsupported key" warning.
 */
export const MOVED_LOCAL_CONFIG_KEYS = ['sdkSourcePath', 'apiRepoPaths', 'apiRepoBranches'];

/** Named only to point a migration at it. `@ethlete/cli` owns the file and validates its values. */
export const TOPOLOGY_CONFIG_FILE_NAME = 'ethlete.config.local.json';

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
  const keys = Object.keys(config);
  const movedKeys = keys.filter((key) => MOVED_LOCAL_CONFIG_KEYS.includes(key));
  const unknownKeys = keys.filter(
    (key) => !LOCAL_CONFIG_KEYS.includes(key as keyof LocalConfig) && !movedKeys.includes(key),
  );

  return { exists: true, valid: true, config, unknownKeys, movedKeys };
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

/**
 * The git-flow skill interpolates the grammar it teaches from the same `gitFlow` block the
 * validator reads, so the documented convention cannot drift from the enforced one. A repo can
 * still override any of these through `vars`.
 */
const gitFlowVars = (gitFlow: GitFlowConfig): Record<string, string | string[]> => ({
  gitFlowDevelopmentBranch: gitFlow.baseBranches.development,
  gitFlowProductionBranch: gitFlow.baseBranches.production,
  gitFlowTypes: gitFlow.types,
  gitFlowEnforcement: gitFlow.enforcement,
  gitFlowSubPrefix: gitFlow.subPrefix,
});

export const loadConfig = (options: { root: string; targetOverride?: AgentTarget[] }): SyncConfig => {
  const { root, targetOverride } = options;
  const raw = readRawConfig(root);
  const configured = raw.targets && raw.targets !== 'auto' ? raw.targets : undefined;
  const targets = targetOverride ?? configured ?? detectTargets(root);
  const gitFlow = resolveGitFlowConfig(raw.gitFlow);

  assertKnownTargets(targets);

  return {
    root,
    targets,
    scopes: raw.profile === 'sdk' ? ['both'] : ['consumer', 'both'],
    vars: {
      ...loadDefaultVars(),
      ...gitFlowVars(gitFlow),
      ...commitMessageVars(findCommitlintConfig(root)),
      ...(raw.vars ?? {}),
    },
    exclude: raw.exclude ?? [],
    claudeMdImportsAgentsMd: raw.claudeMdImportsAgentsMd ?? false,
    hooks: raw.hooks ?? [],
    gitHooks: raw.gitHooks ?? [],
    gitFlow,
    jira: raw.jira ?? {},
  };
};
