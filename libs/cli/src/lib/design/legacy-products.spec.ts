import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { callsRootOf, DESIGN_DIR, readConfig } from './design-config';
import { createDesignServer } from './serve';
import { SYSTEM_PATH } from './system/list-system';
import { COMMENTS_PATH, EXCEPTIONS_PATH, FLOWS_PATH, SKETCHES_PATH } from './studio-api';

const CALL = `import { defineCall } from '@design-system';

export default defineCall({
  legacy: true,
  eyebrow: 'Old',
  headline: 'An old call',
  intro: '',
  frameWidth: 640,
  variants: [],
});
`;

const oldLayoutCheckout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-legacy-products-'));
  const design = join(target, DESIGN_DIR);
  const call = join(callsRootOf(target), 'app-a', 'pages', '01-home', 'call.ts');

  mkdirSync(join(call, '..'), { recursive: true });
  writeFileSync(call, CALL);
  writeFileSync(
    join(design, 'config.json'),
    JSON.stringify({ projects: { 'app-a': { styles: [] }, 'app-b': { styles: [] } } }),
  );

  return { target, config: readConfig(target) ?? {} };
};

describe('a checkout in the layout before products', () => {
  it('lists each project that has calls as a product, and none for a project without calls', async () => {
    const { target, config } = oldLayoutCheckout();
    const server = await createDesignServer({ target, config, listen: true, port: 0 });

    await server.listen();

    const { port, address, family } = server.httpServer?.address() as AddressInfo;
    const origin = `http://${family === 'IPv6' ? `[${address}]` : address}:${port}`;

    try {
      const all = await fetch(`${origin}${SYSTEM_PATH}`);
      const one = await fetch(`${origin}${SYSTEM_PATH}?product=app-a`);

      expect(all.status).toBe(200);
      expect(
        ((await all.json()) as { name: string; parts: unknown[]; problems: unknown[] }[]).map(
          ({ name, parts, problems }) => ({ name, parts, problems }),
        ),
      ).toEqual([{ name: 'app-a', parts: [], problems: [] }]);
      expect(one.status).toBe(200);
    } finally {
      await server.close();
    }
  }, 60_000);

  it('answers the Studio product requests for such a project', async () => {
    const { target, config } = oldLayoutCheckout();
    const server = await createDesignServer({ target, config, listen: true, port: 0 });

    await server.listen();

    const { port, address, family } = server.httpServer?.address() as AddressInfo;
    const origin = `http://${family === 'IPv6' ? `[${address}]` : address}:${port}`;

    try {
      const statuses = await Promise.all(
        [COMMENTS_PATH, EXCEPTIONS_PATH, FLOWS_PATH, SKETCHES_PATH].map(
          async (path) => [path, (await fetch(`${origin}${path}?product=app-a`)).status] as const,
        ),
      );

      expect(statuses).toEqual([
        [COMMENTS_PATH, 200],
        [EXCEPTIONS_PATH, 200],
        [FLOWS_PATH, 200],
        [SKETCHES_PATH, 200],
      ]);
    } finally {
      await server.close();
    }
  }, 60_000);
});
