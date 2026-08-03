import { existsSync, lstatSync, readFileSync, readlinkSync } from 'fs';
import { join } from 'path';
import { LOCAL_CONFIG_FILE_NAME, readLocalConfig, SyncConfig } from './config';
import { filterContent, SkippedItem } from './filter';
import { ContentItem, loadContent } from './load-content';
import { emitAgentsSkills } from './targets/agents-skills';
import { assertKnownHooks, CLAUDE_HOOKS, CLAUDE_SETTINGS_FILE, emitClaudeHooks } from './targets/claude-hooks';
import { emitClaude } from './targets/claude';
import { CODEX_FILE, emitCodex } from './targets/codex';
import { COPILOT_FILE, emitCopilot } from './targets/copilot';
import { emitCursor } from './targets/cursor';
import { EmitContext, EmittedFile } from './targets/shared';

export type SyncPlan = {
  files: EmittedFile[];
  skipped: SkippedItem[];
  /** Cross-references whose target was filtered out of this repo; rendered as a bare name. */
  danglingLinks: { from: string; to: string }[];
  /** Config/repo mismatches that won't fail the run but will silently lose content if ignored. */
  warnings: string[];
};

const SKILL_LINK_PATTERN = /\{%\s*skill:([a-zA-Z0-9_.-]+)\s*%\}/g;

const findDanglingLinks = (items: ContentItem[], emittedSkills: Set<string>) =>
  items.flatMap((item) =>
    [...item.body.matchAll(SKILL_LINK_PATTERN)]
      .map((match) => match[1] as string)
      .filter((name) => !emittedSkills.has(name))
      .map((name) => ({ from: item.frontmatter.name, to: name })),
  );

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
 * The local file only affects hook runtime, never sync output — so the warnings here are about
 * the mistakes that would otherwise fail silently: a file the hooks can't parse, a key that
 * suggests someone expected sync-time overrides, or a hook name nothing matches.
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
      `${LOCAL_CONFIG_FILE_NAME} contains unsupported key(s): ${local.unknownKeys.join(', ')} — the local file only supports "disableHooks"; it never changes what sync writes.`,
    );
  }

  const disable = local.config.disableHooks;

  if (disable !== undefined && typeof disable !== 'boolean' && !Array.isArray(disable)) {
    warnings.push(
      `${LOCAL_CONFIG_FILE_NAME} has an invalid "disableHooks" value — use true or an array of hook names; hooks stay enabled.`,
    );
  }

  if (Array.isArray(disable)) {
    const unknown = disable.filter((name) => !(name in CLAUDE_HOOKS));

    if (unknown.length > 0) {
      warnings.push(
        `${LOCAL_CONFIG_FILE_NAME} disables unknown hook(s): ${unknown.join(', ')}. Known hooks: ${Object.keys(CLAUDE_HOOKS).join(', ')}.`,
      );
    }
  }

  return warnings;
};

const collectWarnings = (config: SyncConfig) => {
  const warnings: string[] = collectLocalConfigWarnings(config.root);

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
export const buildPlan = (options: { config: SyncConfig; version: string }): SyncPlan => {
  const { config, version } = options;

  assertKnownHooks(config.hooks);

  const { kept, skipped } = filterContent(loadContent(), config);

  const skills = kept.filter((item) => item.frontmatter.kind === 'skill');
  const emittedSkills = new Set(skills.map((item) => item.frontmatter.name));

  const context: EmitContext = {
    rules: kept.filter((item) => item.frontmatter.kind === 'rule'),
    skills,
    emittedSkills,
    vars: config.vars,
    version,
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
  );

  return { files, skipped, danglingLinks: findDanglingLinks(kept, emittedSkills), warnings: collectWarnings(config) };
};
