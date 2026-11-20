import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { chromiumOf } from '../browser';
import { DESIGN_DIR, readConfig } from '../design-config';
import { createDesignServer } from '../serve';
import { createDrawQueue, INSPECT_BROWSER_ARGS } from '../thumb';
import { inventoryOf } from './inventory';
import { resolveProduct } from './resolve-product';
import { recordMerged } from './sketch/merged-parts';
import { createSystemModules } from './system-modules';

const BODY = [
  '<main>',
  '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M0 0h16v16z"/></svg>',
  '<div data-et-part="foundations/logo"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M0 0h8v8z"/></svg></div>',
  '<div role="dialog" aria-label="Mock" style="position:fixed;top:40px;left:40px;width:100px;height:60px;background:white">Mock</div>',
  '<div data-et-part="components/menu"><div role="menu" style="position:fixed;top:120px;left:40px;width:100px;height:60px;background:white">Menu</div></div>',
  '</main>',
].join('');

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-inventory-items-'));
  const design = join(target, DESIGN_DIR);
  const dir = join(design, 'app-a', 'pages', 'items');

  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(design, 'config.json'),
    JSON.stringify({ products: { 'app-a': { presets: { desktop: { width: 400, height: 300 } } } } }),
  );
  writeFileSync(
    join(dir, 'items.ts'),
    `import { definePart, drawing } from '@design-system';

export default definePart({
  note: 'A fixture.',
  describe: { rest: 'a state' },
  states: { rest: { state: 'rest' } },
  render: async () => drawing({ body: ${JSON.stringify(BODY)}, styles: '' }),
});
`,
  );

  const config = readConfig(target) ?? {};
  const product = resolveProduct({ target, name: 'app-a', config: config.products?.['app-a'] ?? {} });

  recordMerged({ product, parts: ['pages/items'] });

  return { target, config, product };
};

describe('inventory assets and overlays', () => {
  it('lists an inline svg and a mocked overlay as findings and the owned ones as owned', async (context) => {
    const { target, config, product } = checkout();

    const chromium = await chromiumOf(target);
    if (!chromium) return context.skip('no playwright');

    const queue = createDrawQueue({ target, chromiumOf, args: INSPECT_BROWSER_ARGS });
    const server = await createDesignServer({ target, config, listen: true, port: 0 });

    try {
      await server.listen();

      const { port } = server.httpServer?.address() as AddressInfo;
      const inventory = await inventoryOf({
        product,
        part: 'pages/items',
        system: createSystemModules({ target, config }),
        base: `http://localhost:${port}`,
        load: (id) => server.ssrLoadModule(id),
        draw: (job) => queue.run(job),
      });

      if (typeof inventory === 'string') throw new Error(inventory);

      const items = inventory.frames[0]?.items
        .map(({ number, kind, status, owner }) => [kind, number, status, owner] as const)
        .sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);

      expect(items).toEqual([
        ['asset', 1, 'finding', null],
        ['asset', 2, 'owned', 'foundations/logo'],
        ['overlay', 1, 'finding', null],
        ['overlay', 2, 'owned', 'components/menu'],
      ]);
      expect(inventory.findings).toBe(2);
    } finally {
      await server.close();
      await queue.close?.();
    }
  }, 120_000);
});
