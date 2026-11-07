import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { basename, dirname } from 'path';
import { linkFieldTextOf, withLinkFieldOf, withoutLinkFieldOf } from './sketch/part-definition';

const mayLink = (file: string, text: string) =>
  file.endsWith('.ts') && text.includes('definePart') && text.includes('implements');

/** The bytes a design hash reads for `file`: its content without the `implements` field of its `definePart`. */
export const linkFreeContentOf = (file: string, bytes: Buffer): Buffer | string => {
  const text = bytes.toString('utf8');

  return mayLink(file, text) ? withoutLinkFieldOf(text) : bytes;
};

const earlierFields = new Map<string, { digest: string; fields: string[] }>();

const committedLinkFieldsOf = (file: string) => {
  const git = (args: string[]) =>
    execFileSync('git', ['-C', dirname(file), ...args], {
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();

  try {
    const name = basename(file);
    const commits = git(['log', '--format=%H', '-G', 'implements', '--', name]).split('\n').filter(Boolean);

    return commits.flatMap((commit) => {
      try {
        const field = linkFieldTextOf(git(['show', `${commit}:./${name}`]));

        return field === null ? [] : [field];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
};

/**
 * The contents a design hash that still covered the `implements` link read for `file`: the current content, and the
 * current content with each other link the file held in git history. `null` for a file without a link.
 */
export const linkedContentsOf = (file: string, bytes: Buffer): { current: string; older: string[] } | null => {
  const text = bytes.toString('utf8');
  const current = mayLink(file, text) ? linkFieldTextOf(text) : null;

  if (current === null) return null;

  const digest = createHash('sha256').update(bytes).digest('hex');
  const known = earlierFields.get(file);
  const fields = known?.digest === digest ? known.fields : committedLinkFieldsOf(file);

  earlierFields.set(file, { digest, fields });

  return {
    current: text,
    older: [...new Set(fields.filter((field) => field !== current).map((field) => withLinkFieldOf(text, field)))],
  };
};
