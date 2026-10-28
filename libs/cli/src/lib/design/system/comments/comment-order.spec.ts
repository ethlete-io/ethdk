import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { createComment, DesignComment, listComments } from './comment';

const hex = vi.hoisted(() => ({ next: ['ffff', '8888', '0000'] }));

vi.mock('crypto', async (actual) => ({
  ...(await actual<typeof import('crypto')>()),
  randomBytes: () => Buffer.from(hex.next.shift() ?? '0000', 'hex'),
}));

afterEach(() => vi.useRealTimers());

describe('listComments order', () => {
  it('keeps the order comments were written in when they share a timestamp', () => {
    vi.useFakeTimers({ now: new Date('2026-10-28T09:00:00.000Z'), toFake: ['Date'] });

    const target = mkdtempSync(join(tmpdir(), 'cli-design-comment-order-'));

    cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const comment = { part: 'components/button', state: 'default', size: 'fitted', text: 'Too dark.' };
    const written = ['hover', 'rest', 'active'].map(
      (interaction) => (createComment({ product, comment: { ...comment, interaction } }) as DesignComment).id,
    );

    expect(listComments({ productDir: product.dir, product: 'acme' }).comments.map(({ id }) => id)).toEqual(written);
  });
});
