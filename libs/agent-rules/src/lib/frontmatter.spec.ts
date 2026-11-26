import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from './frontmatter';

const parse = (head: string) =>
  parseFrontmatter(`---\nname: x\ndescription: d\nkind: skill\n${head}\n---\nbody\n`, 'x.md');

describe('parseFrontmatter', () => {
  it('rejects a key that appears twice', () => {
    expect(() => parse('name: y')).toThrow('frontmatter key "name" appears more than once');
  });

  it('keeps a comma inside a quoted inline list entry', () => {
    expect(parse(`paths: ["a, b", 'c', d]`).frontmatter.paths).toEqual(['a, b', 'c', 'd']);
  });

  it('rejects a list item that belongs to no key', () => {
    expect(() => parse('- stray')).toThrow('does not belong to a key');
  });

  it('reads modelInvocation as a strict boolean', () => {
    expect(parse('').frontmatter.modelInvocation).toBe(true);
    expect(parse('modelInvocation: false').frontmatter.modelInvocation).toBe(false);
    expect(parse('modelInvocation: true').frontmatter.modelInvocation).toBe(true);
    expect(() => parse('modelInvocation: no')).toThrow('"modelInvocation" must be true or false');
  });
});
