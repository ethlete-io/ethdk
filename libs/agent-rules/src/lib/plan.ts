import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { SyncConfig } from './config';
import { filterContent, SkippedItem } from './filter';
import { loadContent } from './load-content';
import { emitClaude } from './targets/claude';
import { CODEX_FILE, emitCodex } from './targets/codex';
import { COPILOT_FILE, emitCopilot } from './targets/copilot';
import { emitCursor } from './targets/cursor';
import { emitNeutral } from './targets/neutral';
import { EmitContext, EmittedFile } from './targets/shared';

export type SyncPlan = {
  files: EmittedFile[];
  skipped: SkippedItem[];
};

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

  const context: EmitContext = {
    rules: kept.filter((item) => item.frontmatter.kind === 'rule'),
    skills: kept.filter((item) => item.frontmatter.kind === 'skill'),
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

  return { files, skipped };
};
