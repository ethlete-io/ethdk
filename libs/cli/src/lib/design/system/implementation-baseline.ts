import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { FileHashes } from './design-hash';

export const IMPLEMENTATION_BASELINE_FILE = 'implementation-baseline.json';

export const REMOVED_FILE = 'removed';

/**
 * A part whose IMPLEMENTATION-UNCOMPARED drift predates the gate (ADR 0205): the finding that tracks its fix, and the
 * hash of each drifted app file when it was baselined (`removed` for a file gone since its implemented record).
 */
export type BaselineEntry = { finding: string; app: FileHashes };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isEntry = (value: unknown): value is BaselineEntry =>
  isRecord(value) &&
  typeof value['finding'] === 'string' &&
  isRecord(value['app']) &&
  Object.values(value['app']).every((hash) => typeof hash === 'string');

const entriesOf = (text: string): Record<string, BaselineEntry> => {
  try {
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, BaselineEntry] => isEntry(entry[1])),
        )
      : {};
  } catch {
    return {};
  }
};

export const implementationBaselineFileOf = (productDir: string) => resolve(productDir, IMPLEMENTATION_BASELINE_FILE);

export const readImplementationBaseline = (productDir: string) => {
  const file = implementationBaselineFileOf(productDir);

  return existsSync(file) ? entriesOf(readFileSync(file, 'utf8')) : {};
};

/** The pin of a part's drift now: the hash of each drifted app file, `removed` for one that is gone. */
export const driftPinOf = (drifted: string[], now: FileHashes): FileHashes =>
  Object.fromEntries(drifted.map((path) => [path, now[path] ?? REMOVED_FILE]));

export const baselineLineOf = (part: string, entry: BaselineEntry) =>
  `baselined (ADR 0205): ${part} - finding ${entry.finding}`;

const keyOf = (part: string, entry: BaselineEntry) =>
  JSON.stringify([part, entry.finding, Object.entries(entry.app).sort(([a], [b]) => a.localeCompare(b))]);

/**
 * The parts of the baseline `file` whose entry is not in every committed version of it, so the list may only shrink:
 * an entry added, added back or re-pinned after the file was first committed counts. An uncommitted file adds none.
 */
export const addedBaselineEntriesOf = (options: { file: string }) => {
  const { file } = options;

  if (!existsSync(file)) return [];

  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: dirname(file), maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  const path = `./${basename(file)}`;
  let versions: string[];

  try {
    versions = git(['log', '--format=%H', '--', path]).split('\n').filter(Boolean);
  } catch {
    return [];
  }

  const committed = versions.map((sha) => {
    try {
      return new Set(
        Object.entries(entriesOf(git(['show', `${sha}:${path}`]))).map(([part, entry]) => keyOf(part, entry)),
      );
    } catch {
      return new Set<string>();
    }
  });

  return Object.entries(entriesOf(readFileSync(file, 'utf8')))
    .filter(([part, entry]) => committed.some((set) => !set.has(keyOf(part, entry))))
    .map(([part]) => part)
    .sort((a, b) => a.localeCompare(b));
};
