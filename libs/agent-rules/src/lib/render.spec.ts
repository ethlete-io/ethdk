import { describe, expect, it } from 'vitest';
import { END_MARKER, START_MARKER, replaceMarkedBlock } from './render';

const replace = (existing: string) => replaceMarkedBlock({ existing, block: 'new', file: 'AGENTS.md' });

describe('replaceMarkedBlock', () => {
  it('appends the block to a file without markers', () => {
    expect(replace('# Repo\n')).toBe(`# Repo\n\n${START_MARKER}\nnew\n${END_MARKER}\n`);
  });

  it('replaces the block between the markers and keeps the text around it', () => {
    expect(replace(`# Repo\n\n${START_MARKER}\nold\n${END_MARKER}\n\nOwn text\n`)).toBe(
      `# Repo\n\n${START_MARKER}\nnew\n${END_MARKER}\n\nOwn text\n`,
    );
  });

  it('refuses a start marker with no end marker, so the text after it survives the next sync', () => {
    expect(() => replace(`# Repo\n\n${START_MARKER}\nold\n\nOwn text\n`)).toThrow(
      'AGENTS.md has an ethlete marker block with no matching end marker',
    );
  });

  it('refuses an end marker with no start marker before it', () => {
    expect(() => replace(`# Repo\n\n${END_MARKER}\n\nOwn text\n\n${START_MARKER}\nold\n`)).toThrow(
      'AGENTS.md has an ethlete marker block with no matching end marker',
    );
    expect(() => replace(`# Repo\n\n${END_MARKER}\n`)).toThrow(
      'AGENTS.md has an ethlete marker block with no matching end marker',
    );
  });
});
