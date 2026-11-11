import { createHash } from 'node:crypto';
import hashes from './person-name-hashes.json';

const KNOWN = new Set<string>(hashes);

const hash = (word: string) => createHash('sha256').update(word).digest('hex').slice(0, 16);

/** True when the text holds a word or camel-case part that `yarn lint:person-names` refuses. */
export const hasPersonName = (text: string) =>
  (text.match(/\p{L}+/gu) ?? []).some((token) =>
    token
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(/[^\p{L}]+/u)
      .filter(Boolean)
      .some((word) => KNOWN.has(hash(word.toLowerCase()))),
  );

export const PERSON_NAME_REFUSAL =
  'is a person name, which the repo does not commit: use the role "human" (for pick, e.g. "human in chat: take b")';
