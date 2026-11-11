import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { readConfig } from './design-config';
import { createDesignServer, linkedRootsOf } from './serve';
import { createServedHashes, reachableBaseOf, ServedRequest } from './system/served-cache';
import { fsUrl } from './vite-paths';

const dirs: string[] = [];
const cwd = process.cwd();

afterEach(() => {
  process.chdir(cwd);

  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const tempDir = (prefix: string) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));

  dirs.push(dir);

  return dir;
};

/** An acme checkout whose `kit` directory is a symlink into another directory, with a module that inlines a stylesheet. */
const linkedCheckout = () => {
  const store = tempDir('design-linked-store-');
  const target = tempDir('design-linked-checkout-');

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
  mkdirSync(join(store, 'kit'));
  writeFileSync(join(store, 'kit', 'kit.css'), '.kit { color: red; }\n');
  writeFileSync(join(store, 'kit', 'kit.ts'), "import styles from './kit.css?inline';\n\nexport default styles;\n");
  symlinkSync(join(store, 'kit'), join(target, 'kit'));

  return { target, store };
};

const servedOn = async <T>(target: string, use: (base: string) => Promise<T>) => {
  const server = await createDesignServer({ target, config: readConfig(target) ?? {}, listen: true, port: 0 });

  try {
    await server.listen();

    const address = server.httpServer?.address();

    if (!address || typeof address === 'string') throw new Error('the design server has no address');

    return await use(reachableBaseOf(address));
  } finally {
    await server.close();
  }
};

describe('linkedRootsOf', () => {
  it('allows the real directory of each symlinked entry of the checkout, and the checkout itself', () => {
    const { target, store } = linkedCheckout();

    expect(linkedRootsOf(target)).toEqual(expect.arrayContaining([target, join(store, 'kit')]));
  });
});

describe('a stylesheet inlined from a symlinked directory', () => {
  it('answers the same on a fresh server as on the server whose drawing loaded it', async () => {
    const { target, store } = linkedCheckout();
    const stylesheet: ServedRequest = { url: `${fsUrl(join(store, 'kit', 'kit.css'))}?inline`, accept: null };

    const drawn = await servedOn(target, async (base) => {
      await fetch(new URL(fsUrl(join(target, 'kit', 'kit.ts')), base));

      return createServedHashes(base).inputsOf([stylesheet]);
    });
    const fresh = await servedOn(target, (base) => createServedHashes(base).inputsOf([stylesheet]));

    expect(drawn[0]?.hash).toEqual(expect.any(String));
    expect(fresh).toEqual(drawn);
  }, 60_000);
});
