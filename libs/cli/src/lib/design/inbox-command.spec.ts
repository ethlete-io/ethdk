import { cpSync, existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { designComment, designInbox } from './inbox-command';
import { DESIGN_DIR } from './paths';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-inbox-command-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  return target;
};

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

const invocation = 'et design';

describe('designComment and designInbox', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes a comment, lists it and deletes it once done', () => {
    const target = acme();
    const lines = output();
    const argv = ['pages/home', 'empty', '--size', 'phone', '--at', '10,20', '--product', 'acme', 'Say', 'why.'];

    expect(designComment({ target, argv, invocation })).toBe(0);

    const id = /^comment (\S+):/u.exec(lines.pop() ?? '')?.[1] ?? '';

    expect(designInbox({ target, argv: ['--json'], invocation })).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')).toEqual([
      expect.objectContaining({ kind: 'comment', id, part: 'pages/home', point: { x: 10, y: 20 }, text: 'Say why.' }),
    ]);
    expect(designInbox({ target, argv: ['done', id], invocation })).toBe(0);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/comments', `${id}.json`))).toBe(false);
    expect(designInbox({ target, argv: [], invocation })).toBe(0);
    expect(lines.pop()).toBe('inbox empty');
  });

  it('refuses a comment without a size, a bad point or a stale part', () => {
    const target = acme();
    const lines = output();

    expect(
      designComment({
        target,
        argv: ['pages/home', 'empty', 'x', '--product', 'acme'],
        invocation,
      }),
    ).toBe(2);
    expect(
      designComment({ target, argv: ['pages/home', 'empty', 'x', '--size', '0', '--product', 'acme'], invocation }),
    ).toBe(2);
    expect(
      designComment({ target, argv: ['pages/home', 'empty', 'x', '--size', 'phone', '--at', '1'], invocation }),
    ).toBe(2);
    expect(
      designComment({
        target,
        argv: ['pages/nope', 'empty', 'x', '--size', 'phone', '--product', 'acme'],
        invocation,
      }),
    ).toBe(1);
    expect(lines.pop()).toBe('part pages/nope no longer exists');
    expect(designInbox({ target, argv: ['done', 'nope'], invocation })).toBe(1);
    expect(lines.pop()).toBe('no open comment "nope"');
  });
});
