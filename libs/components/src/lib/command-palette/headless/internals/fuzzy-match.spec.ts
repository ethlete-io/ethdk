import { fuzzyMatch } from './fuzzy-match';

const matchedText = (haystack: string, query: string) => {
  const match = fuzzyMatch(query, haystack);

  if (!match) return null;

  return match.ranges.map(([start, end]) => haystack.slice(start, end));
};

const scoreOf = (query: string, haystack: string) => {
  const match = fuzzyMatch(query, haystack);

  if (!match) throw new Error(`expected "${query}" to match "${haystack}"`);

  return match.score;
};

describe('fuzzyMatch', () => {
  it('matches an empty query with no ranges', () => {
    expect(fuzzyMatch('', 'Create table')).toEqual({ score: 0, ranges: [] });
  });

  it('returns null when a query character is missing', () => {
    expect(fuzzyMatch('xyz', 'Create table')).toBeNull();
    expect(fuzzyMatch('tablet', 'Create table')).toBeNull();
  });

  it('returns null when the query is longer than the haystack', () => {
    expect(fuzzyMatch('create table', 'table')).toBeNull();
  });

  it('reports a contiguous match as one range', () => {
    expect(fuzzyMatch('table', 'Create table')?.ranges).toEqual([[7, 12]]);
  });

  it('prefers word starts over an earlier mid-word character', () => {
    // Greedy first-fit would take the "t" of "Create"; the word start is what a reader means.
    expect(matchedText('Create table', 'ct')).toEqual(['C', 't']);
  });

  it('matches the initials of each word', () => {
    expect(matchedText('Open user settings', 'ous')).toEqual(['O', 'u', 's']);
  });

  it('is case-insensitive', () => {
    expect(fuzzyMatch('TABLE', 'Create table')).not.toBeNull();
    expect(fuzzyMatch('cReAtE', 'Create table')).not.toBeNull();
  });

  it('ranks a prefix above a match further into the label', () => {
    expect(scoreOf('user', 'User settings')).toBeGreaterThan(scoreOf('user', 'Delete user'));
  });

  it('ranks a contiguous match above a scattered one', () => {
    expect(scoreOf('user', 'Add user')).toBeGreaterThan(scoreOf('user', 'Unset serial'));
  });

  it('ranks a word-start match above a mid-word one', () => {
    expect(scoreOf('set', 'Open settings')).toBeGreaterThan(scoreOf('set', 'Unset value'));
  });

  it('scores two labels sharing the same matched prefix equally', () => {
    // Length is not part of the score; a shorter label wins as a tie-break when results are ranked.
    expect(scoreOf('add', 'Add')).toBe(scoreOf('add', 'Add a very long thing indeed'));
  });

  it('rewards a match that agrees in case', () => {
    expect(scoreOf('AU', 'Add User')).toBeGreaterThan(scoreOf('AU', 'Add user'));
  });

  it('treats a non-alphanumeric character as a word boundary', () => {
    expect(matchedText('add-user-tag', 'aut')).toEqual(['a', 'u', 't']);
  });

  it('treats a camelCase hump as a word boundary', () => {
    expect(matchedText('addUserTag', 'aut')).toEqual(['a', 'U', 'T']);
  });

  it('treats a digit after a letter as a word boundary', () => {
    expect(matchedText('Heading 1 style', 'h1')).toEqual(['H', '1']);
  });

  it('merges adjacent matched characters into one range', () => {
    expect(fuzzyMatch('crea', 'Create table')?.ranges).toEqual([[0, 4]]);
  });

  it('reports one range per run', () => {
    expect(fuzzyMatch('crtab', 'Create table')?.ranges).toEqual([
      [0, 2],
      [7, 10],
    ]);
  });

  it('reports ranges in ascending order that never overlap', () => {
    const haystack = 'Duplicate the selected row below';
    const match = fuzzyMatch('dtsrb', haystack);

    expect(match).not.toBeNull();

    const ranges = match?.ranges ?? [];

    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]![0]).toBeGreaterThanOrEqual(ranges[i - 1]![1]);
    }
  });

  it('matches every query character exactly once', () => {
    const match = fuzzyMatch('ceta', 'Create table');
    const matchedCount = (match?.ranges ?? []).reduce((total, [start, end]) => total + (end - start), 0);

    expect(matchedCount).toBe(4);
  });
});
