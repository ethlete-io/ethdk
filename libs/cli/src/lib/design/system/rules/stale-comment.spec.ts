import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { staleCommentsOf } from './stale-comment';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-stale-comment-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const comment = (target: string, id: string, body: object) => {
  const dir = join(target, DESIGN_DIR, 'acme/comments');

  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${id}.json`),
    JSON.stringify({
      part: 'pages/home',
      state: 'empty',
      preset: 'phone',
      text: 'x',
      createdAt: '2026-10-27T10:00:00Z',
      ...body,
    }),
  );

  return join(dir, `${id}.json`);
};

describe('staleCommentsOf', () => {
  it('passes a comment that still points at its part and state', () => {
    const target = acme();

    comment(target, 'ok', {});

    expect(staleCommentsOf(resolveAcme(target))).toEqual([]);
  });

  it('fails a comment whose part or state is gone', () => {
    const target = acme();
    const state = comment(target, 'state', { state: 'loading' });
    const part = comment(target, 'part', { part: 'elements/footer' });

    expect(staleCommentsOf(resolveAcme(target))).toEqual([
      { rule: 'COMMENT', file: part, message: 'part elements/footer no longer exists - answer or drop the comment' },
      { rule: 'COMMENT', file: state, message: 'pages/home has no state "loading" - answer or drop the comment' },
    ]);
  });

  it('fails once the part is deleted', () => {
    const target = acme();
    const file = comment(target, 'hero', { part: 'elements/hero', state: 'default' });

    expect(staleCommentsOf(resolveAcme(target))).toEqual([]);

    rmSync(join(target, DESIGN_DIR, 'acme/elements/hero'), { recursive: true });

    expect(staleCommentsOf(resolveAcme(target))).toEqual([
      expect.objectContaining({ file, message: expect.stringContaining('part elements/hero no longer exists') }),
    ]);
  });

  it('fails a comment file it cannot read', () => {
    const target = acme();
    const file = comment(target, 'bad', { text: '' });

    expect(staleCommentsOf(resolveAcme(target))).toEqual([
      { rule: 'COMMENT', file, message: 'text must be a non-empty string' },
    ]);
  });
});
