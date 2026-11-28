import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { setFlagsFromString } from 'v8';
import { runInNewContext } from 'vm';
import { afterAll, describe, expect, it } from 'vitest';

setFlagsFromString('--expose-gc');
const gc = runInNewContext('gc') as () => void;

const root = mkdtempSync(join(tmpdir(), 'vite-release-'));

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('a closed Vite dev server', () => {
  it('frees its environments, so the slow-run worker does not keep every design server it closed', async () => {
    const { createServer } = await import('vite');

    writeFileSync(join(root, 'a.ts'), 'export const a = 1;\n');

    const environments: WeakRef<object>[] = [];

    for (let i = 0; i < 4; i++) {
      const server = await createServer({
        root,
        logLevel: 'silent',
        configFile: false,
        server: { middlewareMode: true, ws: false, watch: null },
      });

      await server.ssrLoadModule('/a.ts');
      environments.push(new WeakRef(server.environments.ssr));
      await server.close();
    }

    for (let i = 0; i < 5; i++) {
      gc();
      await new Promise((settle) => setTimeout(settle, 20));
    }

    expect(environments.filter((environment) => environment.deref() !== undefined).length).toBeLessThanOrEqual(1);
  }, 60_000);
});
