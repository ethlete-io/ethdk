import { describe, expect, it } from 'vitest';
import { normalizeDocPath, parseDocsIndex, searchDocs, suggestPaths, tokenize } from './docs-index';

const page = (url: string, body: string) => `---\nurl: ${url}\n---\n${body}\n`;

const FIXTURE = [
  page(
    '/components/button.md',
    `# Button

The button component renders a clickable control.

## Sizes

Set the size with the \`data-size\` attribute.

\`\`\`bash
## not a heading, it is a shell comment
\`\`\`

## Disabled state

A disabled button stops emitting click events.`,
  ),
  page(
    '/query/caching.md',
    `# Caching & deduplication

Responses are cached per query key.

## keepUnusedFor

Cache entries outlive their last consumer.`,
  ),
].join('\n');

describe('normalizeDocPath', () => {
  it('strips the .md suffix and adds a leading slash', () => {
    expect(normalizeDocPath('components/button.md')).toBe('/components/button');
    expect(normalizeDocPath('/components/button')).toBe('/components/button');
    expect(normalizeDocPath('/eslint.MD')).toBe('/eslint');
  });
});

describe('tokenize', () => {
  it('lowercases, splits on punctuation and drops stopwords and single characters', () => {
    expect(tokenize('The `data-size` attribute is used for X overlays')).toEqual([
      'data',
      'size',
      'attribute',
      'overlays',
    ]);
  });
});

describe('parseDocsIndex', () => {
  const index = parseDocsIndex(FIXTURE);

  it('reads every page with its title', () => {
    expect(index.pages.map((entry) => entry.path)).toEqual(['/components/button', '/query/caching']);
    expect(index.pageByPath.get('/components/button')?.title).toBe('Button');
    expect(index.pageByPath.get('/query/caching')?.title).toBe('Caching & deduplication');
  });

  it('splits sections on level-2 headings and derives anchors', () => {
    const sections = index.pageByPath.get('/components/button')?.sections ?? [];

    expect(sections.map((section) => section.heading)).toEqual(['Button', 'Sizes', 'Disabled state']);
    expect(sections.map((section) => section.anchor)).toEqual(['', 'sizes', 'disabled-state']);
  });

  it('ignores heading-like lines inside fenced code blocks', () => {
    const sizes = index.pageByPath.get('/components/button')?.sections.find((s) => s.heading === 'Sizes');

    expect(sizes?.markdown).toContain('not a heading, it is a shell comment');
  });
});

describe('searchDocs', () => {
  const index = parseDocsIndex(FIXTURE);

  it('ranks the matching section first and returns a snippet', () => {
    const [hit] = searchDocs(index, { query: 'disabled click events', limit: 5 });

    expect(hit?.path).toBe('/components/button');
    expect(hit?.heading).toBe('Disabled state');
    expect(hit?.snippet).toContain('disabled button');
  });

  it('matches on a heading term that does not appear in the body', () => {
    const [hit] = searchDocs(index, { query: 'keepUnusedFor', limit: 5 });

    expect(hit?.path).toBe('/query/caching');
    expect(hit?.anchor).toBe('keepunusedfor');
  });

  it('honours the limit and returns nothing for a stopword-only query', () => {
    expect(searchDocs(index, { query: 'button', limit: 1 })).toHaveLength(1);
    expect(searchDocs(index, { query: 'the and of', limit: 5 })).toEqual([]);
  });
});

describe('suggestPaths', () => {
  it('suggests a close path for a typo', () => {
    const index = parseDocsIndex(FIXTURE);

    expect(suggestPaths(index, { path: '/components/buttons' })).toContain('/components/button');
  });
});
