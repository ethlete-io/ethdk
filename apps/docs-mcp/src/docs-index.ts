/**
 * Parses the `llms-full.txt` the docs site already publishes into a searchable index.
 *
 * The file is a concatenation of every page, each introduced by a frontmatter block:
 *
 * ```
 * ---
 * url: /components/button.md
 * ---
 * # Button
 * ```
 */

export type DocSection = {
  /** Heading text, or the page title for the block above the first `##`. */
  heading: string;
  /** GitHub-style anchor for the heading, empty for the intro block. */
  anchor: string;
  markdown: string;
};

export type DocPage = {
  /** Site-relative path without the `.md` suffix, e.g. `/components/button`. */
  path: string;
  title: string;
  markdown: string;
  sections: DocSection[];
};

type SearchRecord = {
  page: DocPage;
  section: DocSection;
  terms: Map<string, number>;
  length: number;
  haystack: string;
};

export type DocsIndex = {
  pages: DocPage[];
  pageByPath: Map<string, DocPage>;
  records: SearchRecord[];
  documentFrequency: Map<string, number>;
  averageLength: number;
};

export type SearchHit = {
  path: string;
  title: string;
  heading: string;
  anchor: string;
  snippet: string;
  score: number;
};

const PAGE_DELIMITER = /^---\nurl: (.+)\n---\n/gm;
const FENCE = /^\s*(?:```|~~~)/;
const HEADING = /^(#{1,3})\s+(.+?)\s*$/;

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'can',
  'do',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'them',
  'then',
  'this',
  'to',
  'use',
  'used',
  'using',
  'was',
  'what',
  'when',
  'which',
  'with',
  'you',
  'your',
]);

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const TITLE_BOOST = 2.2;
const HEADING_BOOST = 1.6;
const PHRASE_BOOST = 1.5;
const MAX_HITS_PER_PAGE = 2;
const SNIPPET_RADIUS = 130;

export const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));

/** Strips the `.md` suffix and guarantees a single leading slash. */
export const normalizeDocPath = (path: string) => {
  const withoutExtension = path.trim().replace(/\.md$/i, '');
  const withoutIndex = withoutExtension.replace(/\/index$/i, '/');
  const leading = withoutIndex.startsWith('/') ? withoutIndex : `/${withoutIndex}`;

  return leading.length > 1 ? leading.replace(/\/$/, '/') : leading;
};

const toAnchor = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const titleFromPath = (path: string) => {
  const last = path.split('/').filter(Boolean).pop() ?? 'Overview';

  return last.replace(/-/g, ' ').replace(/^./, (char) => char.toUpperCase());
};

/**
 * Splits a page into its `##` sections. Heading detection skips fenced code blocks so a
 * `## ` comment inside a bash sample does not start a new section.
 */
const splitSections = (markdown: string, title: string): DocSection[] => {
  const sections: DocSection[] = [];
  let heading = title;
  let anchor = '';
  let buffer: string[] = [];
  let inFence = false;

  const flush = () => {
    const text = buffer.join('\n').trim();

    if (text) {
      sections.push({ heading, anchor, markdown: text });
    }
  };

  for (const line of markdown.split('\n')) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      buffer.push(line);
      continue;
    }

    const match = inFence ? null : HEADING.exec(line);

    if (match && match[1]?.length === 2) {
      flush();
      heading = match[2] ?? '';
      anchor = toAnchor(heading);
      buffer = [line];
      continue;
    }

    buffer.push(line);
  }

  flush();

  return sections;
};

const parsePage = (url: string, markdown: string): DocPage => {
  const path = normalizeDocPath(url);
  const body = markdown.trim();
  const firstHeading = /^#\s+(.+)$/m.exec(body);
  const title = firstHeading?.[1]?.trim() ?? titleFromPath(path);

  return { path, title, markdown: body, sections: splitSections(body, title) };
};

const toRecord = (page: DocPage, section: DocSection): SearchRecord => {
  const tokens = tokenize(`${page.title} ${section.heading} ${section.markdown}`);
  const terms = new Map<string, number>();

  for (const token of tokens) {
    terms.set(token, (terms.get(token) ?? 0) + 1);
  }

  return {
    page,
    section,
    terms,
    length: tokens.length,
    haystack: section.markdown.toLowerCase(),
  };
};

export const parseDocsIndex = (llmsFull: string): DocsIndex => {
  const parts = llmsFull.split(PAGE_DELIMITER);
  const pages: DocPage[] = [];

  // parts is [preamble, url, body, url, body, …]
  for (let i = 1; i < parts.length; i += 2) {
    const url = parts[i];
    const body = parts[i + 1];

    if (url && body?.trim()) {
      pages.push(parsePage(url, body));
    }
  }

  const records = pages.flatMap((page) => page.sections.map((section) => toRecord(page, section)));
  const documentFrequency = new Map<string, number>();

  for (const record of records) {
    for (const term of record.terms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const totalLength = records.reduce((sum, record) => sum + record.length, 0);

  return {
    pages,
    pageByPath: new Map(pages.map((page) => [page.path, page])),
    records,
    documentFrequency,
    averageLength: records.length ? totalLength / records.length : 1,
  };
};

const buildSnippet = (record: SearchRecord, terms: string[]) => {
  const source = record.section.markdown;
  const firstHit = terms.map((term) => record.haystack.indexOf(term)).filter((index) => index >= 0);
  const center = firstHit.length ? Math.min(...firstHit) : 0;
  const start = Math.max(0, center - SNIPPET_RADIUS);
  const end = Math.min(source.length, center + SNIPPET_RADIUS);
  const slice = source.slice(start, end).replace(/\s+/g, ' ').trim();

  return `${start > 0 ? '…' : ''}${slice}${end < source.length ? '…' : ''}`;
};

export const searchDocs = (index: DocsIndex, { query, limit }: { query: string; limit: number }): SearchHit[] => {
  const terms = [...new Set(tokenize(query))];

  if (!terms.length) {
    return [];
  }

  const phrase = query.trim().toLowerCase();
  const total = Math.max(index.records.length, 1);
  const scored: SearchHit[] = [];

  for (const record of index.records) {
    const titleTerms = new Set(tokenize(record.page.title));
    const headingTerms = new Set(tokenize(record.section.heading));
    let score = 0;

    for (const term of terms) {
      const frequency = record.terms.get(term) ?? 0;

      if (!frequency && !titleTerms.has(term) && !headingTerms.has(term)) {
        continue;
      }

      const documentFrequency = index.documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (total - documentFrequency + 0.5) / (documentFrequency + 0.5));
      const normalization = BM25_K1 * (1 - BM25_B + (BM25_B * record.length) / index.averageLength);

      score += idf * ((frequency * (BM25_K1 + 1)) / (frequency + normalization));

      if (titleTerms.has(term)) {
        score += idf * TITLE_BOOST;
      }

      if (headingTerms.has(term)) {
        score += idf * HEADING_BOOST;
      }
    }

    if (score <= 0) {
      continue;
    }

    if (phrase.length > 3 && record.haystack.includes(phrase)) {
      score *= PHRASE_BOOST;
    }

    scored.push({
      path: record.page.path,
      title: record.page.title,
      heading: record.section.heading,
      anchor: record.section.anchor,
      snippet: buildSnippet(record, terms),
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  const perPage = new Map<string, number>();
  const hits: SearchHit[] = [];

  for (const hit of scored) {
    const seen = perPage.get(hit.path) ?? 0;

    if (seen >= MAX_HITS_PER_PAGE) {
      continue;
    }

    perPage.set(hit.path, seen + 1);
    hits.push(hit);

    if (hits.length >= limit) {
      break;
    }
  }

  return hits;
};

/** Paths whose last segment is closest to `path`, used to help an agent recover from a typo. */
export const suggestPaths = (index: DocsIndex, { path, limit = 5 }: { path: string; limit?: number }): string[] => {
  const needle = normalizeDocPath(path).replace(/^\//, '').toLowerCase();

  return index.pages
    .map((page) => {
      const candidate = page.path.replace(/^\//, '').toLowerCase();
      const contains = candidate.includes(needle) || needle.includes(candidate);
      const sharedPrefix = [...candidate].findIndex((char, i) => char !== needle[i]);

      return { path: page.path, score: (contains ? 100 : 0) + (sharedPrefix < 0 ? candidate.length : sharedPrefix) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.path);
};
