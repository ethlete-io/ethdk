import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** The stable key of a finding: its seen text without the variant list, which changes between runs. */
export const findingKey = (seen) =>
  seen
    .replace(/,? ?Variante [a-z](, [a-z])*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Reads the finding keys from a `findings.md` the judge wrote. */
export const keysOfMarkdown = (markdown) =>
  markdown
    .split('\n## ')[0]
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => findingKey(line.slice(2).split(' Verdacht: ')[0]));

/** The newest run dir before `runDir` that holds a `findings.md`, or null. */
export const previousRunOf = (runDir) => {
  const parent = dirname(runDir);
  const earlier = readdirSync(parent)
    .filter((name) => /^\d{4}-\d{2}-\d{2}-\d{4}$/.test(name) && name < basename(runDir))
    .filter((name) => existsSync(join(parent, name, 'findings.md')))
    .sort();
  return earlier.length ? join(parent, earlier.at(-1)) : null;
};

/** The short head of `findings.md`: the verdict and the diff against the previous run. */
export const headOf = ({ findings, previous }) => {
  const keys = [...new Set(findings.map((f) => findingKey(f.seen)))];
  const verdict = keys.length === 0 ? 'BESTANDEN' : 'DURCHGEFALLEN';
  const lines = [`Urteil: ${verdict} (${keys.length} Befunde).`];
  if (!previous) return [...lines, 'Vorheriger Lauf: keiner.'].join('\n');
  const before = new Set(keysOfMarkdown(readFileSync(join(previous, 'findings.md'), 'utf8')));
  const now = new Set(keys);
  const added = keys.filter((k) => !before.has(k));
  const gone = [...before].filter((k) => !now.has(k));
  const open = keys.filter((k) => before.has(k));
  return [
    ...lines,
    `Gegenüber ${basename(previous)}: ${added.length} neu, ${gone.length} weg, ${open.length} weiter offen.`,
    ...added.map((k) => `  neu: ${k}`),
    ...gone.map((k) => `  weg: ${k}`),
  ].join('\n');
};

if (import.meta.main) {
  const [runDir] = process.argv.slice(2);
  const previous = previousRunOf(runDir);
  const keys = keysOfMarkdown(readFileSync(join(runDir, 'findings.md'), 'utf8'));
  console.log(headOf({ findings: keys.map((seen) => ({ seen })), previous }));
}
