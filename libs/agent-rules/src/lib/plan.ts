import { existsSync, lstatSync, readFileSync, readlinkSync } from 'fs';
import { join } from 'path';
import {
  CONFIG_FILE_NAME,
  LOCAL_CONFIG_FILE_NAME,
  LOCAL_CONFIG_KEYS,
  readLocalConfig,
  SyncConfig,
  TOPOLOGY_CONFIG_FILE_NAME,
} from './config';
import { filterContent, SkippedItem } from './filter';
import { ContentItem, loadContent } from './load-content';
import { emitAgentsSkills } from './targets/agents-skills';
import { CLAUDE_SETTINGS_FILE, emitClaudeHooks } from './targets/claude-hooks';
import { emitClaude } from './targets/claude';
import { CODEX_FILE, emitCodex } from './targets/codex';
import { CODEX_HOOKS_FILE, emitCodexHooks } from './targets/codex-hooks';
import { assertKnownGitHooks, emitGitHooks, HUSKY_DIR, huskyHookPath, KNOWN_GIT_HOOKS } from './targets/git-hooks';
import { assertKnownHooks, KNOWN_HOOKS } from './targets/hooks-shared';
import { COPILOT_FILE, emitCopilot } from './targets/copilot';
import { emitCursor } from './targets/cursor';
import { EmitContext, EmittedFile } from './targets/shared';

export type SyncPlan = {
  files: EmittedFile[];
  skipped: SkippedItem[];
  /** Config/repo mismatches that won't fail the run but will silently lose content if ignored. */
  warnings: string[];
};

const SKILL_LINK_PATTERN = /\{%\s*skill:([a-zA-Z0-9_.-]+)\s*%\}/g;
const RESOURCE_LINK_PATTERN = /\{%\s*resource:([a-zA-Z0-9_.-]+)\s*%\}/g;

export const assertResolvedContentReferences = (options: {
  items: ContentItem[];
  kept: ContentItem[];
  skipped: SkippedItem[];
}) => {
  const { items, kept, skipped } = options;
  const knownSkills = new Set(
    items.filter((item) => item.frontmatter.kind === 'skill').map((item) => item.frontmatter.name),
  );
  const emittedSkills = new Set(
    kept.filter((item) => item.frontmatter.kind === 'skill').map((item) => item.frontmatter.name),
  );
  const skippedByName = new Map(skipped.map((item) => [item.name, item.reason]));

  for (const item of kept) {
    const origin = item.frontmatter.kind === 'skill' ? `skills/${item.frontmatter.name}/SKILL.md` : item.sourcePath;
    const skillLinks = [...item.body.matchAll(SKILL_LINK_PATTERN)].map((match) => match[1] as string);

    for (const target of skillLinks) {
      if (!knownSkills.has(target)) {
        throw new Error(`${origin}: references unknown package skill "${target}".`);
      }

      if (!emittedSkills.has(target)) {
        const reason = skippedByName.get(target) ?? 'it was not selected for emission';

        throw new Error(`${origin}: references package skill "${target}", but it is not emitted because ${reason}.`);
      }
    }

    const resources = new Set(item.resources.map((resource) => resource.fileName));

    for (const target of [...item.body.matchAll(RESOURCE_LINK_PATTERN)].map((match) => match[1] as string)) {
      if (!resources.has(target)) {
        throw new Error(`${origin}: references missing bundled resource "${target}".`);
      }
    }

    const withoutStructuredLinks = item.body.replace(SKILL_LINK_PATTERN, '');

    for (const target of knownSkills) {
      if (target === item.frontmatter.name) continue;

      const plainReference = new RegExp(
        '`(?:ethlete-)?' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '` (?:skill|guide)',
      );

      if (plainReference.test(withoutStructuredLinks)) {
        throw new Error(
          `${origin}: references package skill "${target}" as plain text; use "{% skill:${target} %}" so filtering can validate it.`,
        );
      }
    }
  }
};

const readExisting = (root: string, relativePath: string) => {
  const path = join(root, relativePath);

  return existsSync(path) ? readFileSync(path, 'utf8') : '';
};

/** `@AGENTS.md` on its own line (the documented import syntax), or a symlink pointing at it. */
export const claudeMdImportsAgentsMd = (root: string) => {
  const path = join(root, 'CLAUDE.md');

  if (!existsSync(path)) return false;

  if (lstatSync(path).isSymbolicLink()) return readlinkSync(path).endsWith('AGENTS.md');

  return /^@AGENTS\.md\s*$/m.test(readFileSync(path, 'utf8'));
};

/**
 * The local file only affects runtime behavior, never sync output — so the warnings here are about
 * the mistakes that would otherwise fail silently: a file the hooks can't parse, a key that
 * suggests someone expected sync-time overrides, a hook name nothing matches, or a checkout path
 * that no longer exists (the skills reading it would just report the checkout as missing).
 */
const collectLocalConfigWarnings = (root: string) => {
  const local = readLocalConfig(root);

  if (!local.exists) return [];

  if (!local.valid) {
    return [`${LOCAL_CONFIG_FILE_NAME} is not a JSON object — hooks ignore it and stay enabled.`];
  }

  const warnings: string[] = [];

  if (local.unknownKeys.length > 0) {
    warnings.push(
      `${LOCAL_CONFIG_FILE_NAME} contains unsupported key(s): ${local.unknownKeys.join(', ')} — the local file supports ${LOCAL_CONFIG_KEYS.map((key) => `"${key}"`).join(' and ')}; it never changes what sync writes.`,
    );
  }

  if (local.movedKeys.length > 0) {
    warnings.push(
      `${LOCAL_CONFIG_FILE_NAME} still holds ${local.movedKeys.map((key) => `"${key}"`).join(', ')} — move ` +
        `${local.movedKeys.length === 1 ? 'it' : 'them'} to ${TOPOLOGY_CONFIG_FILE_NAME}, which \`et\` reads too.`,
    );
  }

  const disable = local.config.disableHooks;

  if (disable !== undefined && typeof disable !== 'boolean' && !Array.isArray(disable)) {
    warnings.push(
      `${LOCAL_CONFIG_FILE_NAME} has an invalid "disableHooks" value — use true or an array of hook names; hooks stay enabled.`,
    );
  }

  if (Array.isArray(disable)) {
    const unknown = disable.filter((name) => !(name in KNOWN_HOOKS));

    if (unknown.length > 0) {
      warnings.push(
        `${LOCAL_CONFIG_FILE_NAME} disables unknown hook(s): ${unknown.join(', ')}. Known hooks: ${Object.keys(KNOWN_HOOKS).join(', ')}.`,
      );
    }
  }

  const disableAutoHandoffSave = local.config.disableAutoHandoffSave;

  if (disableAutoHandoffSave !== undefined && typeof disableAutoHandoffSave !== 'boolean') {
    warnings.push(`${LOCAL_CONFIG_FILE_NAME} has an invalid "disableAutoHandoffSave" value — use true or false.`);
  }

  return warnings;
};

/**
 * Only `.husky/` is written into, never `.git/hooks/`: the generated files are committed and CI's
 * `check` diffs them, so a hook that lives outside the working tree could never be in sync.
 */
const collectGitHookWarnings = (config: SyncConfig) => {
  if (config.gitHooks.length === 0 || existsSync(join(config.root, HUSKY_DIR))) return [];

  return [
    `gitHooks is set to ${config.gitHooks.join(', ')} but there is no ${HUSKY_DIR}/ directory — nothing was written. Install husky, or run \`npx ethlete-agents git-flow check\` from your own hooks.`,
  ];
};

const collectExcludeWarnings = (items: ContentItem[], exclude: string[]) => {
  const knownNames = new Set(items.map((item) => item.frontmatter.name));
  const unknownNames = exclude.filter((name) => !knownNames.has(name));

  if (unknownNames.length === 0) return [];

  return [
    `${CONFIG_FILE_NAME} excludes unknown content name(s): ${unknownNames.join(', ')} — check their spelling or remove them.`,
  ];
};

const collectWarnings = (config: SyncConfig, items: ContentItem[]) => {
  const warnings: string[] = [
    ...collectLocalConfigWarnings(config.root),
    ...collectGitHookWarnings(config),
    ...collectExcludeWarnings(items, config.exclude),
  ];

  if (!config.claudeMdImportsAgentsMd) return warnings;

  if (!config.targets.includes('codex')) {
    warnings.push(
      'claudeMdImportsAgentsMd is set but the codex target is off — no AGENTS.md is generated, so Claude gets no rules at all.',
    );
  }

  if (!claudeMdImportsAgentsMd(config.root)) {
    warnings.push(
      'claudeMdImportsAgentsMd is set but CLAUDE.md does not import AGENTS.md — add a line containing exactly "@AGENTS.md" (or symlink CLAUDE.md to AGENTS.md), or Claude gets no rules at all.',
    );
  }

  return warnings;
};

/**
 * Resolves the full set of files a sync would write, without touching disk — `sync` writes the
 * result and `check` diffs it.
 */
export const buildPlan = (options: { config: SyncConfig }): SyncPlan => {
  const { config } = options;

  assertKnownHooks(config.hooks);
  assertKnownGitHooks(config.gitHooks);

  const items = loadContent();
  const { kept, skipped } = filterContent(items, config);

  assertResolvedContentReferences({ items, kept, skipped });

  const skills = kept.filter((item) => item.frontmatter.kind === 'skill');

  const context: EmitContext = {
    rules: kept.filter((item) => item.frontmatter.kind === 'rule'),
    skills,
    vars: config.vars,
    claudeMdImportsAgentsMd: config.claudeMdImportsAgentsMd,
    hooks: config.hooks,
  };

  const files: EmittedFile[] = [];

  // Codex, Cursor and Copilot all discover skills from the shared `.agents/skills/` tree.
  if (config.targets.some((target) => target !== 'claude')) {
    files.push(...emitAgentsSkills(context));
  }

  if (config.targets.includes('claude')) files.push(...emitClaude(context));
  if (config.targets.includes('cursor')) files.push(...emitCursor(context));

  if (config.targets.includes('codex')) {
    files.push(...emitCodex({ context, existing: readExisting(config.root, CODEX_FILE) }));
  }

  if (config.targets.includes('copilot')) {
    files.push(...emitCopilot({ context, existing: readExisting(config.root, COPILOT_FILE) }));
  }

  files.push(
    ...emitClaudeHooks({
      context,
      claudeTarget: config.targets.includes('claude'),
      existingSettings: readExisting(config.root, CLAUDE_SETTINGS_FILE),
    }),
    ...emitCodexHooks({
      context,
      codexTarget: config.targets.includes('codex'),
      existingHooks: readExisting(config.root, CODEX_HOOKS_FILE),
    }),
    ...emitGitHooks({
      gitHooks: config.gitHooks,
      huskyExists: existsSync(join(config.root, HUSKY_DIR)),
      existing: Object.fromEntries(
        Object.keys(KNOWN_GIT_HOOKS).map((name) => [name, readExisting(config.root, huskyHookPath(name))]),
      ),
    }),
  );

  return {
    files,
    skipped,
    warnings: collectWarnings(config, items),
  };
};
