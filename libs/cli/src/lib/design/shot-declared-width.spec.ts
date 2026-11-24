import { cpSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { pngSizeOf } from './contact-sheet';
import { readConfig } from './design-config';
import { createDesignServer } from './serve';
import { reachableBaseOf } from './system/served-cache';

const dirs: string[] = [];
const cwd = process.cwd();

afterEach(() => {
  process.chdir(cwd);

  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const checkout = () => {
  const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-design-shot-width-')));

  dirs.push(target);
  cpSync(join(__dirname, '__fixtures__/b687-title-card'), target, { recursive: true });
  symlinkSync(resolve(__dirname, '../../../../../node_modules'), join(target, 'node_modules'), 'dir');

  return { target, config: readConfig(target) ?? {} };
};

describe('the shot route', () => {
  it('draws a sketch part with widths at its first width when the ask names no width or preset', async (context) => {
    const { target, config } = checkout();
    const server = await createDesignServer({ target, config, listen: true, port: 0 });

    try {
      await server.listen();

      const address = server.httpServer?.address();

      if (!address || typeof address === 'string') throw new Error('the design server has no address');

      const query = new URLSearchParams({
        product: 'tomflix',
        part: 'components/title-card',
        sketch: 'components/title-card',
        variant: 'b',
        state: 'logo',
        priority: 'low',
      });
      const answer = await fetch(new URL(`/__design/shot?${query}`, reachableBaseOf(address)));

      if (!answer.ok) {
        const text = await answer.text();

        if (/chromium|playwright/i.test(text)) return context.skip(text);

        throw new Error(`${answer.status} ${text}`);
      }

      expect(pngSizeOf(Buffer.from(await answer.arrayBuffer())).width).toBe(200);
    } finally {
      await server.close();
    }
  }, 120_000);
});
