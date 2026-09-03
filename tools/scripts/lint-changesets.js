/**
 * Lints changeset notes against the hard bar in the `changeset` skill: one to two sentences,
 * under 40 words, no second paragraph, at most three bullets.
 *
 * Only *unreleased* changesets are checked. An entry listed in `.changeset/pre.json` has already
 * been versioned and published as a prerelease, so its file is locked - rewriting it would change
 * a changelog that consumers have already read. Those files are consumed and deleted when the repo
 * leaves prerelease mode, at the same moment `pre.json` goes away, so "no pre.json" correctly means
 * "everything here is new".
 *
 * Usage:
 *   node tools/scripts/lint-changesets.js              # every unreleased changeset
 *   node tools/scripts/lint-changesets.js <paths...>   # only these files (still skips locked ones)
 */

const { readFileSync, readdirSync, existsSync } = require('fs');
const { join, basename, resolve } = require('path');

const CHANGESET_DIR = resolve(__dirname, '../../.changeset');

const WORD_LIMIT = 40;
const MAX_PROSE_PARAGRAPHS = 1;
const MAX_BULLETS = 3;

const PACKAGES = [
  '@ethlete/agent-rules',
  '@ethlete/bracket',
  '@ethlete/cdk',
  '@ethlete/cli',
  '@ethlete/components',
  '@ethlete/contentful',
  '@ethlete/core',
  '@ethlete/eslint-plugin',
  '@ethlete/query',
  '@ethlete/query-devtools',
  '@ethlete/timetrack',
  '@ethlete/types',
];

const LEVELS = ['major', 'minor', 'patch'];

const SKILL_HINT =
  'The bar is in the `changeset` skill (.agents/skills/changeset/SKILL.md): the note is the line a\n' +
  'consumer skims to decide whether the release affects them, not a summary of the work. Mechanism,\n' +
  'API inventories and caveats belong in apps/docs; causes belong in the commit body.';

/** Entries already versioned in prerelease mode - their files must not be rewritten. */
const readLockedNames = () => {
  const preJson = join(CHANGESET_DIR, 'pre.json');

  if (!existsSync(preJson)) return new Set();

  try {
    return new Set(JSON.parse(readFileSync(preJson, 'utf8')).changesets ?? []);
  } catch {
    return new Set();
  }
};

/** Splits a changeset into its frontmatter lines and its note, or reports why it cannot be read. */
const parse = (raw) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);

  if (!match) return { error: 'no `---` frontmatter block followed by the note' };

  return {
    frontmatter: match[1].split(/\r?\n/).filter((line) => line.trim().length > 0),
    note: match[2].trim(),
  };
};

const checkFrontmatter = (lines) => {
  const problems = [];

  if (lines.length === 0) problems.push('frontmatter lists no packages');

  for (const line of lines) {
    const entry = /^'([^']+)'\s*:\s*(\S+)$/.exec(line) ?? /^"([^"]+)"\s*:\s*(\S+)$/.exec(line);

    if (!entry) {
      problems.push(`frontmatter line is not \`'@ethlete/<pkg>': <level>\`: ${line.trim()}`);
      continue;
    }

    const [, pkg, level] = entry;

    if (!PACKAGES.includes(pkg)) problems.push(`unknown package \`${pkg}\``);
    if (!LEVELS.includes(level)) problems.push(`invalid bump level \`${level}\` for \`${pkg}\``);
  }

  return problems;
};

const isBullet = (line) => /^\s*([-*+]|\d+\.)\s/.test(line);

const checkNote = (note) => {
  const problems = [];

  if (note.length === 0) return ['the note is empty'];

  const words = note.split(/\s+/).length;

  if (words > WORD_LIMIT) {
    problems.push(
      `${words} words - the bar is ${WORD_LIMIT}. Delete it and write the TL;DR rather than trimming ` +
        `it down: one sentence, two at most.`,
    );
  }

  const blocks = note.split(/\r?\n\s*\r?\n/).filter((block) => block.trim().length > 0);
  const prose = blocks.filter((block) => !block.split(/\r?\n/).every(isBullet));

  if (prose.length > MAX_PROSE_PARAGRAPHS) {
    problems.push(
      `${prose.length} paragraphs - a changeset gets one. The paragraphs after the first are almost ` +
        `always mechanism or an API inventory; those belong in apps/docs.`,
    );
  }

  const bullets = note.split(/\r?\n/).filter(isBullet).length;

  if (bullets > MAX_BULLETS) {
    problems.push(
      `${bullets} bullets - the ceiling is ${MAX_BULLETS}. More than that means this should have been ` +
        `several changesets.`,
    );
  }

  return problems;
};

const lint = (paths) => {
  const locked = readLockedNames();

  const files = (
    paths.length > 0 ? paths.map((path) => basename(path)) : readdirSync(CHANGESET_DIR).filter((f) => f.endsWith('.md'))
  ).filter((file) => file !== 'README.md' && !locked.has(file.replace(/\.md$/, '')));

  const failures = [];

  for (const file of files) {
    const path = join(CHANGESET_DIR, file);

    if (!existsSync(path)) continue;

    const { error, frontmatter, note } = parse(readFileSync(path, 'utf8'));
    const problems = error ? [error] : [...checkFrontmatter(frontmatter), ...checkNote(note)];

    if (problems.length > 0) failures.push({ file, problems });
  }

  return { checked: files.length, failures };
};

const { checked, failures } = lint(process.argv.slice(2));

if (failures.length === 0) {
  if (process.argv.length === 2) console.log(`✔ ${checked} unreleased changeset(s) within the bar.`);
  process.exit(0);
}

for (const { file, problems } of failures) {
  console.error(`\n✖ .changeset/${file}`);
  for (const problem of problems) console.error(`  - ${problem}`);
}

console.error(`\n${SKILL_HINT}\n`);
process.exit(1);
