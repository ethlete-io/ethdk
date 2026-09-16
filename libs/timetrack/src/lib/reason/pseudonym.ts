/**
 * The words a pseudonym is drawn from.
 *
 * Each is one word of letters only, so its uppercase form is also a valid Jira project key prefix and
 * `FIFAGG-12623` can go out as `ALDER-12623`. None of them reads as a real company: a user reviewing
 * the prompt must never have to work out whether a name in it was already masked.
 */
const PSEUDONYM_WORDS = [
  'Alder',
  'Amber',
  'Anvil',
  'Arbor',
  'Aspen',
  'Basalt',
  'Beacon',
  'Birch',
  'Bramble',
  'Cedar',
  'Cinder',
  'Clover',
  'Cobalt',
  'Copper',
  'Cypress',
  'Dahlia',
  'Delta',
  'Dune',
  'Ember',
  'Fennel',
  'Fjord',
  'Flint',
  'Garnet',
  'Ginger',
  'Granite',
  'Harbor',
  'Hazel',
  'Heron',
  'Indigo',
  'Ivory',
  'Juniper',
  'Kestrel',
  'Lantern',
  'Larch',
  'Laurel',
  'Linen',
  'Maple',
  'Marble',
  'Meadow',
  'Mesa',
  'Nectar',
  'Nimbus',
  'Nutmeg',
  'Onyx',
  'Opal',
  'Orchid',
  'Pebble',
  'Pewter',
  'Quarry',
  'Quartz',
  'Ridge',
  'Rowan',
  'Sable',
  'Saffron',
  'Slate',
  'Sorrel',
  'Spruce',
  'Summit',
  'Thistle',
  'Topaz',
  'Umber',
  'Verbena',
  'Willow',
  'Zinnia',
];

/** FNV-1a. It picks a word; nothing here needs it to resist anything. */
const fnv1a = (text: string) => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
};

const normal = (name: string) => name.trim().toLowerCase();

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Names the app recognises without being told, so they are not reported as something to mask. Every
 * one of them is a word a commit subject or a merge request title starts with, or a tool the whole
 * industry shares — reporting those would bury the one client name the list is missing.
 */
const COMMON_WORDS = new Set(
  `
  a add added after all allow an and android angular api app apply as at back be before bug build bump but by
  ci chore clean close css cli day delete demo dev do docker docs don draft drop end extract feat feature fix
  fixed fixes for from git github gitlab google handle html http i if in init into ios is issue it java jira
  js json keep let linux macos main make master merge move no not note of on only open or pr prep pull push
  python read refactor release remove rename request review revert rust sdk series set setup should show so
  split sql src stop store sync tempo test tests that the then this to try ts ui up update use ux we when why
  windows with wip work write you
`
    .split(/\s+/)
    .filter(Boolean)
    .map(normal),
);

/**
 * The two directions of the pseudonym rule, for one name list.
 *
 * Nothing here is ever stored. The list the user maintains is the map: the same list rebuilds the
 * same assignment, and that is what reads an answer back into real names.
 */
export type PseudonymMap = {
  /** The name as the user wrote it, by lowercased real name. */
  names: ReadonlyMap<string, string>;
  /** The pseudonym, by lowercased real name. */
  byName: ReadonlyMap<string, string>;
  /** The real name as the user wrote it, by lowercased pseudonym. */
  byPseudonym: ReadonlyMap<string, string>;
};

export const EMPTY_PSEUDONYM_MAP: PseudonymMap = { names: new Map(), byName: new Map(), byPseudonym: new Map() };

/**
 * Assigns one pseudonym to each name, by a fixed rule over the whole list.
 *
 * The list is sorted first, so the assignment does not depend on the order the user typed the names
 * in. A word already taken is resolved by walking the list forward from it, which makes the rule
 * total: a list longer than the word list keeps going with a numbered word rather than failing.
 *
 * A word that is itself a name on the list is never assigned. Without that, a client called `Mesa`
 * takes `Mesa` as its own pseudonym and leaves the prompt unmasked, and no warning catches it — the
 * word is on the list, so nothing reports it as unaccounted for.
 */
export const pseudonymMap = (names: readonly string[]): PseudonymMap => {
  const written = new Map<string, string>();

  for (const name of names) {
    const key = normal(name);

    if (key && !written.has(key)) written.set(key, name.trim());
  }

  const byName = new Map<string, string>();
  const byPseudonym = new Map<string, string>();

  for (const key of [...written.keys()].sort()) {
    const start = fnv1a(key) % PSEUDONYM_WORDS.length;
    let word = '';

    for (let step = 0; !word; step++) {
      const candidate =
        step < PSEUDONYM_WORDS.length
          ? PSEUDONYM_WORDS[(start + step) % PSEUDONYM_WORDS.length]
          : `${PSEUDONYM_WORDS[start]}${Math.floor(step / PSEUDONYM_WORDS.length) + 1}`;

      if (candidate && !byPseudonym.has(normal(candidate)) && !written.has(normal(candidate))) word = candidate;
    }

    byName.set(key, word);
    byPseudonym.set(normal(word), written.get(key) ?? key);
  }

  return { names: written, byName, byPseudonym };
};

const matcher = (terms: readonly string[]) => {
  if (!terms.length) return null;

  const sorted = [...terms].sort((left, right) => right.length - left.length).map(escaped);

  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${sorted.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
};

const isShouting = (text: string) => text === text.toUpperCase() && /\p{Lu}{2}/u.test(text);

const replaceAll = (options: {
  text: string;
  terms: readonly string[];
  read: (found: string) => string | undefined;
}) => {
  const pattern = matcher(options.terms);

  if (!pattern) return options.text;

  return options.text.replace(pattern, (found) => {
    const replacement = options.read(normal(found));

    if (!replacement) return found;

    return isShouting(found) ? replacement.toUpperCase() : replacement;
  });
};

/**
 * Replaces every real name in a piece of free text with its pseudonym, and leaves the rest as
 * written. A payload stripped to tokens leaves the model nothing to reason about, so only the names
 * go.
 *
 * A match written in capitals comes back in capitals, which is what turns `FIFAGG-12623` inside a
 * branch name or a note into `ALDER-12623` without a rule of its own.
 */
export const maskNames = (options: { text: string; map: PseudonymMap }) =>
  replaceAll({
    text: options.text,
    terms: [...options.map.byName.keys()],
    read: (found) => options.map.byName.get(found),
  });

/** The same rule backwards, for reading an answer the model wrote in pseudonyms. */
export const unmaskNames = (options: { text: string; map: PseudonymMap }) =>
  replaceAll({
    text: options.text,
    terms: [...options.map.byPseudonym.keys()],
    read: (found) => options.map.byPseudonym.get(found),
  });

/**
 * Masks the project prefix of an issue key and keeps its number: `FIFAGG-12623` goes out as
 * `ALDER-12623`.
 *
 * A key whose prefix is in no name list is returned as written. That is a leak the name list has to
 * close, and `unmaskedWords` is what reports it before the first send.
 */
export const maskIssueKey = (options: { issueKey: string; map: PseudonymMap }) => {
  const parts = /^([A-Za-z][A-Za-z0-9]*)(-\d+)$/.exec(options.issueKey.trim());

  if (!parts) return maskNames({ text: options.issueKey, map: options.map });

  const masked = options.map.byName.get(normal(parts[1] ?? ''));

  return masked ? `${masked.toUpperCase()}${parts[2]}` : options.issueKey.trim();
};

const CAPITALISED = /(?<![\p{L}\p{N}])(\p{Lu}[\p{L}\p{N}]*)/gu;

const ISSUE_KEY_PREFIX = /(?<![\p{L}\p{N}])([A-Za-z][A-Za-z0-9]*)-\d+/gu;

/** A shape an ordinary word of prose does not take, whatever language the prose is in. */
const isNameShaped = (options: { word: string; keyPrefixes: ReadonlySet<string> }) => {
  const { word } = options;

  if (options.keyPrefixes.has(normal(word))) return true;
  if (/\d/.test(word)) return true;
  if (word === word.toUpperCase()) return true;

  return /\p{Ll}\p{Lu}/u.test(word);
};

export type UnmaskedWord = {
  word: string;
  /**
   * The word carries a shape a name has and prose does not, so it is worth reading first. False says
   * only that the app has no reason to single it out — never that the word is safe to send.
   */
  likelyName: boolean;
};

/**
 * Every capitalised word in a piece of text that the app cannot account for: not a name the user
 * listed, not a pseudonym it just wrote, and not a word the industry shares. Name-shaped words come
 * first, and each group is alphabetical.
 *
 * This is what makes "transparent" real. A new client shows up here before the first send, so it can
 * be added to the name list rather than found in a prompt afterwards.
 *
 * Nothing is dropped, and the order is the whole of the ranking. German capitalises every noun, so a
 * German payload puts a few hundred ordinary words in front of the one client name the list is
 * missing — which is the burial this function exists to prevent. A caller that shows only part of
 * the list has to say how much it is holding back.
 */
export const unmaskedWords = (options: { text: string; map: PseudonymMap }): UnmaskedWord[] => {
  const found = new Map<string, string>();
  const keyPrefixes = new Set(
    [...options.text.matchAll(ISSUE_KEY_PREFIX)].map((match) => normal(match[1] ?? '')).filter(Boolean),
  );

  for (const match of options.text.matchAll(CAPITALISED)) {
    const word = match[1] ?? '';
    const key = normal(word);

    if (word.length < 2 || found.has(key)) continue;
    if (COMMON_WORDS.has(key) || options.map.byName.has(key) || options.map.byPseudonym.has(key)) continue;

    found.set(key, word);
  }

  return [...found.values()]
    .map((word): UnmaskedWord => ({ word, likelyName: isNameShaped({ word, keyPrefixes }) }))
    .sort((left, right) =>
      left.likelyName === right.likelyName
        ? left.word.localeCompare(right.word)
        : Number(right.likelyName) - Number(left.likelyName),
    );
};
