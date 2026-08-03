import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, join, relative } from 'path';
import { AgentTarget, CONFIG_FILE_NAME } from './config';
import { claudeMdImportsAgentsMd } from './plan';
import { END_MARKER, START_MARKER } from './render';
import { RunOptions, sync } from './sync';

const CLAUDE_MD = 'CLAUDE.md';
const AGENTS_MD = 'AGENTS.md';
const CLAUDE_SKILLS = '.claude/skills';
const AGENTS_SKILLS = '.agents/skills';

const log = (message: string) => console.log(`  ${message}`);

/**
 * `AGENTS.md` becomes the canonical instruction file: whatever `CLAUDE.md` held moves to the top
 * of `AGENTS.md`, and `CLAUDE.md` shrinks to the `@AGENTS.md` import Claude Code documents for
 * exactly this setup.
 */
const migrateClaudeMd = (options: { root: string; dryRun: boolean }) => {
  const { root, dryRun } = options;
  const claudePath = join(root, CLAUDE_MD);
  const agentsPath = join(root, AGENTS_MD);

  if (claudeMdImportsAgentsMd(root)) {
    log(`keep   ${CLAUDE_MD} — already imports ${AGENTS_MD}`);

    return;
  }

  if (!existsSync(claudePath)) {
    log(`create ${CLAUDE_MD} — "@${AGENTS_MD}" import`);

    if (!dryRun) writeFileSync(claudePath, `@${AGENTS_MD}\n`, 'utf8');

    return;
  }

  const claudeContent = readFileSync(claudePath, 'utf8').trim();
  const agentsContent = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8').trim() : '';
  const merged = [claudeContent, agentsContent].filter((part) => part.length > 0).join('\n\n');

  log(`move   ${CLAUDE_MD} content into ${AGENTS_MD}`);
  log(`write  ${CLAUDE_MD} — "@${AGENTS_MD}" import`);

  if (dryRun) return;

  writeFileSync(agentsPath, `${merged}\n`, 'utf8');
  writeFileSync(claudePath, `@${AGENTS_MD}\n`, 'utf8');
};

/**
 * Hand-written skills move to the cross-tool `.agents/skills/` location; a symlink stays behind
 * because Claude Code only scans `.claude/skills/` (and follows symlinks there). Generated
 * `ethlete-` entries are left to `sync`, which owns them.
 */
const migrateSkills = (options: { root: string; dryRun: boolean }) => {
  const { root, dryRun } = options;
  const claudeSkills = join(root, CLAUDE_SKILLS);

  if (!existsSync(claudeSkills)) return;

  for (const entry of readdirSync(claudeSkills)) {
    const source = join(claudeSkills, entry);

    if (entry.startsWith('ethlete-') || lstatSync(source).isSymbolicLink() || !lstatSync(source).isDirectory()) {
      continue;
    }

    const destination = join(root, AGENTS_SKILLS, entry);

    if (existsSync(destination)) {
      log(`skip   ${CLAUDE_SKILLS}/${entry} — ${AGENTS_SKILLS}/${entry} already exists`);
      continue;
    }

    log(`move   ${CLAUDE_SKILLS}/${entry} → ${AGENTS_SKILLS}/${entry} (symlink stays behind)`);

    if (dryRun) continue;

    mkdirSync(dirname(destination), { recursive: true });
    renameSync(source, destination);

    try {
      symlinkSync(relative(dirname(source), destination), source, 'dir');
    } catch (error) {
      renameSync(destination, source);
      log(`undo   ${CLAUDE_SKILLS}/${entry} — creating the symlink failed (${(error as Error).message})`);
    }
  }
};

const LAYOUT_NOTE = `## Agent file layout

\`AGENTS.md\` is canonical; \`CLAUDE.md\` is just an \`@AGENTS.md\` import. Skills live in
\`.agents/skills/<name>/\`; the entries in \`.claude/skills/\` are symlinks to them (Claude Code
only scans there) - same file, not a duplicate. Edit and create skills under \`.agents/skills/\`,
plus a symlink for new ones. \`ethlete-*\` skills and the marker block in this file are generated
by \`npx ethlete-agents sync\` - never edit them by hand.`;

const withoutMarkedBlock = (content: string) => {
  const start = content.indexOf(START_MARKER);
  const end = content.indexOf(END_MARKER);

  if (start === -1 || end === -1 || end < start) return content;

  return content.slice(0, start) + content.slice(end + END_MARKER.length);
};

/**
 * Without this note an agent that lists both skill directories reads the symlinked entries as
 * duplicated files. Skipped when the repo's own `AGENTS.md` prose already explains the layout.
 */
const addLayoutNote = (options: { root: string; dryRun: boolean }) => {
  const { root, dryRun } = options;
  const path = join(root, AGENTS_MD);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';

  if (withoutMarkedBlock(existing).includes(AGENTS_SKILLS)) {
    log(`keep   ${AGENTS_MD} — already documents the ${AGENTS_SKILLS} layout`);

    return;
  }

  log(`write  ${AGENTS_MD} — add the agent file layout note`);

  if (dryRun) return;

  const start = existing.indexOf(START_MARKER);
  const contents =
    start === -1
      ? `${[existing.trimEnd(), LAYOUT_NOTE].filter((part) => part.length > 0).join('\n\n')}\n`
      : `${existing.slice(0, start).trimEnd()}\n\n${LAYOUT_NOTE}\n\n${existing.slice(start)}`;

  writeFileSync(path, contents, 'utf8');
};

const migrateConfig = (options: { root: string; dryRun: boolean }) => {
  const { root, dryRun } = options;
  const path = join(root, CONFIG_FILE_NAME);
  const raw = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>)
    : { targets: 'auto', vars: {}, exclude: [] };

  const targets = raw['targets'];
  const explicit = Array.isArray(targets) ? (targets as AgentTarget[]) : undefined;
  const missingCodex = explicit !== undefined && !explicit.includes('codex');
  const missingFlag = raw['claudeMdImportsAgentsMd'] !== true;

  if (!missingCodex && !missingFlag) {
    log(`keep   ${CONFIG_FILE_NAME} — already migrated`);

    return;
  }

  if (missingCodex && explicit) raw['targets'] = [...explicit, 'codex'];

  raw['claudeMdImportsAgentsMd'] = true;

  log(`write  ${CONFIG_FILE_NAME} — codex target + claudeMdImportsAgentsMd`);

  if (!dryRun) writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
};

/**
 * Converts a repo to the `AGENTS.md`-canonical layout and re-syncs. Safe to re-run: every step
 * detects the migrated state and skips itself.
 */
export const migrate = (options: RunOptions) => {
  const { root, dryRun = false } = options;

  console.log(dryRun ? 'Migration plan (dry run):' : 'Migrating to the AGENTS.md + .agents/skills layout:');

  migrateClaudeMd({ root, dryRun });
  migrateSkills({ root, dryRun });
  addLayoutNote({ root, dryRun });
  migrateConfig({ root, dryRun });

  if (dryRun) {
    console.log('\nRe-run without --dry-run to apply, then a sync runs automatically.');

    return 0;
  }

  console.log('\nRunning sync:');

  const result = sync(options);

  console.log(
    '\nDone. Commit the result. Note: the .claude/skills symlinks need symlink support on checkout (Windows: Developer Mode).',
  );

  return result;
};
