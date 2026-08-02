import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { SyncConfig } from './config';
import { filterContent, SkippedItem } from './filter';
import { ContentItem, loadContent } from './load-content';
import { emitClaude } from './targets/claude';
import { CODEX_FILE, emitCodex } from './targets/codex';
import { COPILOT_FILE, emitCopilot } from './targets/copilot';
import { emitCursor } from './targets/cursor';
import { emitNeutral } from './targets/neutral';
import { EmitContext, EmittedFile } from './targets/shared';

export type SyncPlan = {
  files: EmittedFile[];
  skipped: SkippedItem[];
  /** Cross-references whose target was filtered out of this repo; rendered as a bare name. */
  danglingLinks: { from: string; to: string }[];
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

/**
 * Resolves the full set of files a sync would write, without touching disk — `sync` writes the
 * result and `check` diffs it.
 */
export const buildPlan = (options: { config: SyncConfig; version: string }): SyncPlan => {
  const { config, version } = options;
  const { kept, skipped } = filterContent(loadContent(), config);

  const skills = kept.filter((item) => item.frontmatter.kind === 'skill');
  const emittedSkills = new Set(skills.map((item) => item.frontmatter.name));

  const context: EmitContext = {
    rules: kept.filter((item) => item.frontmatter.kind === 'rule'),
    skills,
    emittedSkills,
    vars: config.vars,
    version,
  };

  const files: EmittedFile[] = [];

  // Codex, Cursor and Copilot all resolve resource files (and, where they have no on-demand
  // mechanism, whole skills) out of the neutral tree.
  if (config.targets.some((target) => target !== 'claude')) {
    files.push(...emitNeutral(context));
  }

  if (config.targets.includes('claude')) files.push(...emitClaude(context));
  if (config.targets.includes('cursor')) files.push(...emitCursor(context));

  if (config.targets.includes('codex')) {
    files.push(...emitCodex({ context, existing: readExisting(config.root, CODEX_FILE) }));
  }

  if (config.targets.includes('copilot')) {
    files.push(...emitCopilot({ context, existing: readExisting(config.root, COPILOT_FILE) }));
  }

  return { files, skipped, danglingLinks: findDanglingLinks(kept, emittedSkills) };
};
