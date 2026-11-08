import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import { linkFieldTextOf, withLinkFieldOf, withoutLinkFieldOf } from './sketch/part-definition';

const mayLink = (file: string, text: string) =>
  file.endsWith('.ts') && text.includes('definePart') && text.includes('implements');

/** The bytes a design hash reads for `file`: its content without the `implements` field of its `definePart`. */
export const linkFreeContentOf = (file: string, bytes: Buffer): Buffer | string => {
  const text = bytes.toString('utf8');

  return mayLink(file, text) ? withoutLinkFieldOf(text) : bytes;
};

const earlierFields = new Map<string, { digest: string; fields: string[] }>();

const repoRootOf = (file: string): string | null => {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.git'))) return dir;
    if (dirname(dir) === dir) return null;
  }
};

const gitIn = ({ root, args, input }: { root: string; args: string[]; input?: string }) =>
  execFileSync('git', ['-C', root, '-c', 'core.quotePath=false', ...args], {
    input,
    maxBuffer: 1 << 28,
    stdio: ['pipe', 'pipe', 'ignore'],
    env: { ...process.env, GIT_LITERAL_PATHSPECS: '1' },
  });

const blobsOf = (output: Buffer): (Buffer | null)[] => {
  const blobs: (Buffer | null)[] = [];

  for (let at = 0; at < output.length;) {
    const end = output.indexOf(0x0a, at);
    const found = /^[0-9a-f]+ (\S+) (\d+)$/.exec(output.subarray(at, end).toString('utf8'));
    const size = found ? Number(found[2]) : -1;

    blobs.push(found?.[1] === 'blob' ? output.subarray(end + 1, end + 1 + size) : null);
    at = found ? end + 2 + size : end + 1;
  }

  return blobs;
};

const committedLinkFieldsIn = (root: string, files: string[]): Map<string, string[]> => {
  const fields = new Map(files.map((file) => [file, [] as string[]]));
  const byPath = new Map(files.map((file) => [relative(root, file).split(sep).join('/'), file]));

  try {
    const log = gitIn({
      root,
      args: ['log', '--format=%x00%H', '--name-only', '-G', 'implements', '--', ...byPath.keys()],
    });
    const revisions = log
      .toString()
      .split('\0')
      .flatMap((entry) => {
        const [commit = '', ...paths] = entry.split('\n').filter(Boolean);

        return paths.flatMap((path) => {
          const file = byPath.get(path);

          return file ? [{ commit, path, file }] : [];
        });
      });

    if (revisions.length === 0) return fields;

    const blobs = blobsOf(
      gitIn({
        root,
        args: ['cat-file', '--batch'],
        input: revisions.map(({ commit, path }) => `${commit}:${path}\n`).join(''),
      }),
    );

    revisions.forEach(({ file }, index) => {
      const blob = blobs[index];
      const field = blob ? linkFieldTextOf(blob.toString('utf8')) : null;

      if (field !== null) fields.get(file)?.push(field);
    });
  } catch {
    return new Map(files.map((file) => [file, []]));
  }

  return fields;
};

const digestOf = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

type Pending = { file: string; digest: string };

const recordHistoryOf = (pending: Pending[]) => {
  const byRoot = new Map<string | null, Pending[]>();

  for (const entry of pending) {
    const root = repoRootOf(entry.file);

    byRoot.set(root, [...(byRoot.get(root) ?? []), entry]);
  }

  for (const [root, entries] of byRoot) {
    const files = entries.map(({ file }) => file);
    const history = root ? committedLinkFieldsIn(root, files) : new Map<string, string[]>();

    for (const { file, digest } of entries) earlierFields.set(file, { digest, fields: history.get(file) ?? [] });
  }
};

/** Reads the link history `linkedContentsOf` needs for each of `files` up front, with two git calls per repository. */
export const primeLinkedContents = (files: string[]) =>
  recordHistoryOf(
    [...new Set(files)].flatMap((file) => {
      const bytes = readFileSync(file);
      const digest = digestOf(bytes);

      return mayLink(file, bytes.toString('utf8')) && earlierFields.get(file)?.digest !== digest
        ? [{ file, digest }]
        : [];
    }),
  );

/**
 * The contents a design hash that still covered the `implements` link read for `file`: the current content, and the
 * current content with each other link the file held in git history. `null` for a file without a link.
 */
export const linkedContentsOf = (file: string, bytes: Buffer): { current: string; older: string[] } | null => {
  const text = bytes.toString('utf8');
  const current = mayLink(file, text) ? linkFieldTextOf(text) : null;

  if (current === null) return null;

  const digest = digestOf(bytes);

  if (earlierFields.get(file)?.digest !== digest) recordHistoryOf([{ file, digest }]);

  const fields = earlierFields.get(file)?.fields ?? [];

  return {
    current: text,
    older: [...new Set(fields.filter((field) => field !== current).map((field) => withLinkFieldOf(text, field)))],
  };
};
