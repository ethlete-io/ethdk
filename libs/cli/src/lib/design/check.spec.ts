import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { checkDesign } from './check';

const close = vi.fn(async () => undefined);

vi.mock('playwright', () => ({
  chromium: {
    launch: async () => ({
      close,
      newPage: async () => ({
        on: () => undefined,
        goto: async () => {
          throw new Error('net::ERR_CONNECTION_REFUSED');
        },
      }),
    }),
  },
}));

describe('checkDesign', () => {
  it('closes the browser when the page cannot be reached', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-check-'));

    await expect(checkDesign({ target, argv: ['--call', 'app/one'], invocation: 'et design' })).rejects.toThrow(
      'ERR_CONNECTION_REFUSED',
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
