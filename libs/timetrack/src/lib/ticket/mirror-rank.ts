import { JiraMirrorIssue } from '../jira/mirror';
import { TicketCandidate } from './match-candidates';
import { projectKeyOf } from './project';
import { TicketWritingRequest } from './write';

/** How many mirror issues one ask offers, best first. */
export const DEFAULT_RANKED_CANDIDATE_LIMIT = 25;

const STOP_WORDS = new Set(
  [
    'and',
    'the',
    'for',
    'with',
    'from',
    'into',
    'not',
    'are',
    'was',
    'this',
    'that',
    'feat',
    'fix',
    'chore',
    'refactor',
    'feature',
    'bugfix',
    'hotfix',
    'release',
    'main',
    'develop',
    'und',
    'der',
    'die',
    'das',
    'mit',
    'von',
    'für',
    'auf',
    'ein',
    'eine',
    'nicht',
  ].map((word) => word.slice(0, 6)),
);

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const EPIC_FACTOR = 1.5;
const EPIC_BONUS = 1;
const KEY_BONUS = 100;

/** Lower-cased word stems: camel case split, words under 3 letters and stop words dropped, cut to 6 letters. */
export const rankingTokensOf = (text: string): string[] =>
  text
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word))
    .map((word) => word.replace(/s$/, '').slice(0, 6))
    .filter((stem) => stem.length >= 3 && !STOP_WORDS.has(stem));

const stringsOf = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(stringsOf);

  return [];
};

/** The words of an ask a mirror issue is ranked against: branch, notes, stand-in and spec. */
export const ticketRequestText = (request: Pick<TicketWritingRequest, 'branch' | 'notes' | 'standIn' | 'spec'>) =>
  stringsOf([request.branch, request.notes, request.standIn?.name, request.standIn?.description, request.spec]).join(
    ' ',
  );

const documentOf = (issue: JiraMirrorIssue) =>
  rankingTokensOf([issue.summary, issue.parentSummary ?? '', issue.subject ?? ''].join(' '));

/**
 * The open issues of `projectKey` in the mirror a ticket call offers, best first: BM25 over summary,
 * parent summary and subject against `text`, a child of `epicKeys` boosted and marked `inEpic`, an issue
 * whose key `text` names first of all. Ties go to the most recently updated, so a project nothing in
 * `text` matches still offers what moved last. No sub-task, no done issue.
 */
export const rankMirrorCandidates = (options: {
  issues: readonly JiraMirrorIssue[];
  projectKey: string;
  text: string;
  epicKeys?: readonly string[];
  limit?: number;
}): TicketCandidate[] => {
  const projectKey = options.projectKey.trim().toUpperCase();
  const epicKeys = new Set((options.epicKeys ?? []).map((key) => key.trim().toUpperCase()));
  const pool = options.issues.filter(
    (issue) => !issue.done && !issue.isSubtask && projectKeyOf(issue.key) === projectKey,
  );
  const documents = pool.map(documentOf);
  const averageLength = documents.reduce((sum, tokens) => sum + tokens.length, 0) / Math.max(1, documents.length);
  const frequency = new Map<string, number>();

  for (const tokens of documents) {
    for (const token of new Set(tokens)) frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }

  const query = new Set(rankingTokensOf(options.text));
  const named = new Set(options.text.toUpperCase().match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? []);

  const scored = pool.map((issue, index) => {
    const tokens = documents[index] ?? [];
    let score = 0;

    for (const term of query) {
      const count = tokens.filter((token) => token === term).length;

      if (!count) continue;

      const held = frequency.get(term) ?? 0;
      const idf = Math.log(1 + (pool.length - held + 0.5) / (held + 0.5));

      score +=
        (idf * count * (BM25_K1 + 1)) /
        (count + BM25_K1 * (1 - BM25_B + (BM25_B * tokens.length) / Math.max(1, averageLength)));
    }

    const inEpic = !!issue.parentKey && epicKeys.has(issue.parentKey.toUpperCase());

    if (inEpic) score = score * EPIC_FACTOR + EPIC_BONUS;
    if (named.has(issue.key.toUpperCase())) score += KEY_BONUS;

    return { issue, inEpic, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.issue.updatedMs - a.issue.updatedMs)
    .slice(0, options.limit ?? DEFAULT_RANKED_CANDIDATE_LIMIT)
    .map(({ issue, inEpic }): TicketCandidate => {
      const { done: _done, updatedMs: _updatedMs, ...plain } = issue;

      return inEpic ? { ...plain, inEpic: true } : plain;
    });
};
